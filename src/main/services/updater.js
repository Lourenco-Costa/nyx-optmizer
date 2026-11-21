'use strict';

/**
 * Atualizacoes automaticas.
 *
 * O canal e um repositorio publico do GitHub configurado em
 * src/main/update-channel.json. O electron-builder publica o instalador,
 * o blockmap e o latest.yml no mesmo release.
 */

const { app } = require('electron');

const channel = require('../update-channel.json');

const CHECK_INTERVAL_MS = 50 * 60 * 1000;
const START_DELAY_MS = 10 * 1000;

let autoUpdater = null;
let initialized = false;
let checking = false;
let getWindow = () => null;
let timer = null;

const state = {
  status: 'idle',
  message: 'Ainda nao verificou atualizacoes.',
  progress: 0,
  version: app.getVersion(),
  updateVersion: null,
  releaseName: null,
  releaseNotes: null,
  channel: channel.owner ? `${channel.owner}/${channel.repo}` : null,
};

function snapshot() {
  return {
    ...state,
    ok: state.status === 'current' || state.status === 'ready',
    canCheck: Boolean(channel.owner) && state.status !== 'checking' && state.status !== 'downloading',
    canInstall: state.status === 'ready',
    dev: !app.isPackaged,
  };
}

function send() {
  const win = getWindow();
  if (!win || win.isDestroyed() || !win.webContents) return;
  win.webContents.send('updater:event', snapshot());
}

function setState(patch) {
  Object.assign(state, patch);
  send();
}

function friendlyError(error) {
  const text = String((error && error.message) || error || '');
  if (/404|latest\.yml|Cannot find|not found/i.test(text)) {
    return 'O canal GitHub ainda nao tem uma versao publicada.';
  }
  if (/net::|ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|network/i.test(text)) {
    return 'Sem ligacao ao GitHub. Verifica a Internet.';
  }
  if (/rate limit|403/i.test(text)) {
    return 'O GitHub recusou o pedido. Tenta mais tarde.';
  }
  return text.split('\n')[0].slice(0, 220) || 'Nao foi possivel verificar atualizacoes.';
}

function init(windowGetter) {
  if (initialized) return snapshot();
  initialized = true;
  getWindow = windowGetter || getWindow;

  if (!app.isPackaged) {
    state.status = 'dev';
    state.message = 'Atualizacoes desativadas em modo de desenvolvimento.';
    return snapshot();
  }

  if (!channel.enabled) {
    state.status = 'disabled';
    state.message = 'Canal de atualizacoes desativado.';
    return snapshot();
  }

  if (!channel.owner) {
    state.status = 'unconfigured';
    state.message = 'Canal GitHub por configurar.';
    return snapshot();
  }

  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (error) {
    state.status = 'error';
    state.message = 'Modulo de atualizacoes indisponivel.';
    return snapshot();
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: channel.owner,
      repo: channel.repo,
    });
  } catch (error) {
    state.status = 'error';
    state.message = friendlyError(error);
    return snapshot();
  }

  autoUpdater.on('checking-for-update', () => {
    checking = true;
    setState({ status: 'checking', message: 'A procurar uma versao nova...', progress: 0 });
  });

  autoUpdater.on('update-available', (info) => {
    setState({
      status: 'downloading',
      message: `Versao ${info.version} encontrada. A descarregar...`,
      updateVersion: info.version,
      releaseName: info.releaseName || null,
      releaseNotes: info.releaseNotes || null,
      progress: 0,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Number(progress && progress.percent) || 0;
    setState({
      status: 'downloading',
      progress: Math.max(0, Math.min(100, percent)),
      message: `A descarregar atualizacao... ${Math.round(percent)}%`,
    });
  });

  autoUpdater.on('update-not-available', () => {
    checking = false;
    setState({
      status: 'current',
      message: 'Estas na versao mais recente.',
      progress: 0,
      updateVersion: null,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    checking = false;
    setState({
      status: 'ready',
      message: `Versao ${info.version} pronta. Reinicia para instalar.`,
      updateVersion: info.version,
      releaseName: info.releaseName || null,
      releaseNotes: info.releaseNotes || null,
      progress: 100,
    });
  });

  autoUpdater.on('error', (error) => {
    checking = false;
    setState({
      status: 'error',
      message: friendlyError(error),
      progress: 0,
    });
  });

  setTimeout(() => {
    check().catch(() => {});
  }, START_DELAY_MS).unref?.();

  timer = setInterval(() => {
    check().catch(() => {});
  }, CHECK_INTERVAL_MS);
  timer.unref?.();

  return snapshot();
}

async function check() {
  if (!app.isPackaged || !channel.owner || !autoUpdater) {
    return { ...snapshot(), ok: false, message: state.message };
  }
  if (checking || state.status === 'downloading') {
    return snapshot();
  }

  checking = true;
  setState({ status: 'checking', message: 'A procurar uma versao nova...', progress: 0 });

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    checking = false;
    setState({ status: 'error', message: friendlyError(error) });
  } finally {
    checking = false;
  }

  return snapshot();
}

function install() {
  if (!autoUpdater || state.status !== 'ready') return false;
  setImmediate(() => {
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch {
      /* a app continua aberta; o utilizador pode tentar de novo */
    }
  });
  return true;
}

function status() {
  return snapshot();
}

module.exports = { init, check, install, status, snapshot };
