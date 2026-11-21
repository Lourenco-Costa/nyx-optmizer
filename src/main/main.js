'use strict';

/**
 * Processo principal do Electron.
 * Janela sem moldura (chrome próprio), instancia unica e ligacao do IPC.
 */

const path = require('path');
const { execFileSync } = require('child_process');
const { app, BrowserWindow, Menu, shell, screen } = require('electron');

const { registerIpc } = require('./ipc');
const updater = require('./services/updater');

const ICON_PATH = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const PRELOAD = path.join(__dirname, 'preload.js');
const RENDERER = path.join(__dirname, '..', 'renderer', 'index.html');

const isDev = process.argv.includes('--dev') || !app.isPackaged;

app.setAppUserModelId('com.nyx.optmizer');

let mainWindow = null;

function normalizeLanguage(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'en' || text === '1033') return 'en';
  if (text === 'pt' || text === '2070' || text === '1046') return 'pt';
  return null;
}

function resolveLanguage() {
  const argument = process.argv.find((value) => value.startsWith('--lang='));
  if (argument) {
    const language = normalizeLanguage(argument.slice('--lang='.length));
    if (language) return language;
  }

  const environment = normalizeLanguage(process.env.NYX_LANG);
  if (environment) return environment;

  if (process.platform === 'win32') {
    try {
      const output = execFileSync('reg.exe', [
        'query',
        'HKCU\\Software\\NyxOptmizer',
        '/v',
        'InstallerLanguage',
      ], { encoding: 'utf8', windowsHide: true });
      const match = output.match(/InstallerLanguage\s+REG_SZ\s+(\d+)/i);
      const language = match ? normalizeLanguage(match[1]) : null;
      if (language) return language;
    } catch {
      /* primeira execucao ou instalador antigo */
    }
  }

  return String(app.getLocale() || '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1240, width - 80),
    height: Math.min(820, height - 80),
    minWidth: 1000,
    minHeight: 680,
    show: false,
    frame: false,
    transparent: true,
    roundedCorners: true,
    backgroundColor: '#00000000',
    title: 'Nyx Optmizer',
    icon: ICON_PATH,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: isDev,
    },
  });

  mainWindow.loadFile(RENDERER, { query: { lang: resolveLanguage() } });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  const sendMaximized = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('window:maximized', mainWindow.isMaximized());
  };
  mainWindow.on('maximize', sendMaximized);
  mainWindow.on('unmaximize', sendMaximized);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerIpc(() => mainWindow);
    createWindow();
    updater.init(() => mainWindow);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
