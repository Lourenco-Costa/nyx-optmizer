'use strict';

/**
 * Registo de todos os canais IPC. Um unico ponto onde se decide
 * o que a interface pode pedir e o que exige licenca ou administrador.
 */

const { app, ipcMain, shell, BrowserWindow } = require('electron');

const stats = require('./services/stats');
const cleaner = require('./services/cleaner');
const tweaks = require('./services/tweaks');
const license = require('./services/license');
const system = require('./services/system');
const network = require('./services/network');
const links = require('./services/links');
const updater = require('./services/updater');

/**
 * Licenca + acesso beta por cargo no Discord.
 * A interface e os guards usam sempre este estado combinado.
 */
function currentStatus() {
  const base = license.status();
  const grant = links.betaGrant();
  const betaAccess = base.canUseBeta || grant.active;

  return {
    ...base,
    betaAccess,
    betaSource: base.canUseBeta ? (base.owner ? 'owner' : 'key') : grant.active ? 'discord' : null,
    discordBeta: grant,
  };
}

function registerIpc(getWindow) {
  /* ---------------- app ---------------- */
  ipcMain.handle('app:info', async () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    isAdmin: await system.isAdmin(),
    dev: !app.isPackaged,
  }));

  /* ---------------- janela ---------------- */
  ipcMain.handle('window:minimize', () => getWindow()?.minimize());
  ipcMain.handle('window:toggle-maximize', () => {
    const win = getWindow();
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle('window:close', () => getWindow()?.close());

  /* ---------------- estatisticas ---------------- */
  ipcMain.handle('stats:get', async () => {
    const data = await stats.getStats();
    return { ...data, isAdmin: await system.isAdmin() };
  });

  /* ---------------- tweaks ---------------- */
  ipcMain.handle('tweaks:list', async () => {
    const [state, status] = await Promise.all([tweaks.getState(), Promise.resolve(currentStatus())]);
    const list = tweaks.list().map((item) => ({
      ...item,
      ...(state[item.id] || { applied: false, supported: true }),
      locked: Boolean(item.beta) && !status.betaAccess,
    }));
    return {
      categories: tweaks.CATEGORIES,
      tweaks: list,
      premium: status.canUsePremium,
      beta: Boolean(status.betaAccess),
      isAdmin: await system.isAdmin(),
    };
  });

  ipcMain.handle('tweaks:apply', async (_event, id) => {
    const status = currentStatus();
    if (!status.canUsePremium) {
      return { ok: false, code: 'LICENSE', message: 'O periodo de avaliacao terminou. Ativa uma licenca para aplicar tweaks.' };
    }
    const tweak = tweaks.list().find((t) => t.id === id);
    if (!tweak) return { ok: false, message: 'Tweak desconhecido.' };
    if (tweak.beta && !status.betaAccess) {
      return {
        ok: false,
        code: 'BETA',
        message: 'Funcao beta. Ativa uma chave STAFF, Owner ou Beta Tester para usar este tweak.',
      };
    }
    if (tweak.admin && !(await system.isAdmin())) {
      return {
        ok: false,
        code: 'ADMIN',
        message: 'Este tweak escreve no sistema. Reinicia a app como administrador.',
      };
    }
    return tweaks.setTweak(id, 'on');
  });

  ipcMain.handle('tweaks:revert', async (_event, id) => {
    const tweak = tweaks.list().find((t) => t.id === id);
    if (!tweak) return { ok: false, message: 'Tweak desconhecido.' };
    if (tweak.admin && !(await system.isAdmin())) {
      return { ok: false, code: 'ADMIN', message: 'Precisas de administrador para reverter este tweak.' };
    }
    return tweaks.setTweak(id, 'off');
  });

  ipcMain.handle('tweaks:restore-defaults', async () => {
    if (!(await system.isAdmin())) {
      return { ok: false, code: 'ADMIN', message: 'A reposicao total precisa de administrador.' };
    }
    const state = await tweaks.getState();
    const applied = Object.entries(state)
      .filter(([, value]) => value.applied)
      .map(([id]) => id);

    const results = [];
    for (const id of applied) {
      results.push(await tweaks.setTweak(id, 'off'));
    }
    return {
      ok: true,
      reverted: applied.length,
      failed: results.filter((r) => !r.ok).length,
      message: `${applied.length} tweaks revertidos para o estado original.`,
    };
  });

  /* ---------------- limpeza ---------------- */
  ipcMain.handle('cleaner:targets', () => cleaner.listTargets());

  ipcMain.handle('cleaner:scan', async (_event, ids) => {
    const status = license.status();
    const result = await cleaner.scan(ids);
    return {
      ...result,
      targets: result.targets.map((t) => ({ ...t, locked: t.premium && !status.canUsePremium })),
      canUsePremium: status.canUsePremium,
    };
  });

  ipcMain.handle('cleaner:clean', async (_event, ids) => {
    const status = license.status();
    const selected = cleaner.listTargets().filter((t) => !ids || ids.includes(t.id));
    const blocked = selected.filter((t) => t.premium && !status.canUsePremium);
    const allowed = selected.filter((t) => status.canUsePremium || !t.premium).map((t) => t.id);

    if (!allowed.length) {
      return { ok: false, code: 'LICENSE', message: 'Ativa uma licenca para limpar caches avancadas.' };
    }

    const result = await cleaner.clean(allowed);
    return {
      ok: true,
      ...result,
      skipped: blocked.length,
      message:
        blocked.length > 0
          ? 'Limpeza concluida nos itens disponiveis. As caches avancadas precisam de licenca.'
          : 'Limpeza concluida.',
    };
  });

  /* ---------------- licenca ---------------- */
  ipcMain.handle('license:status', () => currentStatus());
  ipcMain.handle('license:activate', (_event, key) => {
    const result = license.activate(key);
    if (result.ok) result.status = currentStatus();
    return result;
  });
  ipcMain.handle('license:deactivate', () => {
    license.deactivate();
    return currentStatus();
  });

  /* ---------------- ligacoes beta (Google / Discord) ---------------- */
  ipcMain.handle('links:status', () => ({ ok: true, providers: links.status() }));

  ipcMain.handle('links:configure', (_event, provider, payload) => {
    const status = license.status();
    if (!status.owner) {
      return { ok: false, code: 'OWNER', message: 'So a chave Owner pode configurar as apps OAuth.' };
    }
    return links.configure(provider, payload);
  });

  ipcMain.handle('links:configure-access', (_event, payload) => {
    if (!license.status().owner) {
      return { ok: false, code: 'OWNER', message: 'So a chave Owner pode definir o servidor e o cargo de acesso beta.' };
    }
    return links.configureAccess(payload);
  });

  ipcMain.handle('links:refresh-access', () => links.refreshAccess('discord'));

  ipcMain.handle('links:connect', (_event, provider) => links.connect(provider));

  ipcMain.handle('links:disconnect', (_event, provider) => links.disconnect(provider));

  /* ---------------- atualizacoes ---------------- */
  ipcMain.handle('updater:status', () => updater.status());
  ipcMain.handle('updater:check', () => updater.check());
  ipcMain.handle('updater:install', () => updater.install());

  /* ---------------- sistema ---------------- */
  ipcMain.handle('system:is-admin', () => system.isAdmin());
  ipcMain.handle('system:relaunch-elevated', () => system.relaunchElevated());
  ipcMain.handle('system:restore-point', () => system.createRestorePoint());
  ipcMain.handle('system:flush-dns', () => system.flushDns());
  ipcMain.handle('network:ping', () => network.ping());

  ipcMain.handle('system:open-path', async (_event, target) => {
    const allowed = [app.getPath('userData'), app.getPath('temp')];
    if (typeof target !== 'string') return false;
    if (target === 'logs' || target === 'data') {
      return shell.openPath(app.getPath('userData'));
    }
    if (!allowed.includes(target)) return false;
    return shell.openPath(target);
  });

  ipcMain.handle('system:open-external', async (_event, url) => {
    const allowed = ['https://discord.com/developers/applications', 'https://console.cloud.google.com/apis/credentials', 'https://discord.gg/'];
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
    if (!allowed.some((prefix) => url.startsWith(prefix))) return false;
    await shell.openExternal(url);
    return true;
  });

  /* ---------------- otimizacao em um clique ---------------- */
  ipcMain.handle('system:boost', async (_event, options = {}) => {
    const status = license.status();
    if (!status.canUsePremium) {
      return { ok: false, code: 'LICENSE', message: 'O periodo de avaliacao terminou. Ativa uma licenca para continuar.' };
    }

    const steps = [];
    const cleanIds = status.licensed
      ? ['temp-user', 'thumbnails', 'inetcache', 'd3d', 'crash', 'recycle', 'browsers', 'gpu-cache', 'chat-cache']
      : ['temp-user', 'thumbnails', 'inetcache', 'd3d', 'crash', 'recycle'];

    const cleaned = await cleaner.clean(cleanIds);
    steps.push({ label: 'Limpeza de ficheiros', detail: `${cleaned.removedFiles} ficheiros removidos`, ok: true });

    const state = await tweaks.getState();
    const isAdmin = await system.isAdmin();
    const targets = tweaks
      .list()
      .filter((t) => t.recommended && !state[t.id]?.applied)
      .filter((t) => !t.admin || isAdmin);

    let applied = 0;
    for (const tweak of targets) {
      const result = await tweaks.setTweak(tweak.id, 'on');
      if (result.ok) applied += 1;
    }
    steps.push({ label: 'Tweaks recomendados', detail: `${applied} aplicados`, ok: true });

    const dns = await system.flushDns();
    steps.push({ label: 'Cache DNS', detail: dns.ok ? 'limpa' : 'ignorada', ok: dns.ok });

    if (options.recycle !== false) {
      // O caixote ja foi tratado dentro da limpeza.
    }

    return {
      ok: true,
      steps,
      freed: cleaned.freed,
      tweaksApplied: applied,
      message: 'Otimizacao concluida.',
    };
  });

  /* Limpeza ao fechar pedidos pendentes. */
  ipcMain.handle('window:is-maximized', () => Boolean(getWindow()?.isMaximized()));
}

module.exports = { registerIpc };
