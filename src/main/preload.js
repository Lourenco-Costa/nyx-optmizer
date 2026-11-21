'use strict';

/**
 * Ponte segura entre o processo principal e a interface.
 * A UI nunca tem acesso directo ao Node — apenas a esta API explicita.
 */

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('otzNative', {
  app: {
    info: () => invoke('app:info'),
    openPath: (target) => invoke('system:open-path', target),
    openExternal: (url) => invoke('system:open-external', url),
  },
  window: {
    minimize: () => invoke('window:minimize'),
    toggleMaximize: () => invoke('window:toggle-maximize'),
    close: () => invoke('window:close'),
    onMaximized: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('window:maximized', listener);
      return () => ipcRenderer.removeListener('window:maximized', listener);
    },
  },
  stats: () => invoke('stats:get'),
  tweaks: {
    list: () => invoke('tweaks:list'),
    apply: (id) => invoke('tweaks:apply', id),
    revert: (id) => invoke('tweaks:revert', id),
    restoreDefaults: () => invoke('tweaks:restore-defaults'),
  },
  cleaner: {
    targets: () => invoke('cleaner:targets'),
    scan: (ids) => invoke('cleaner:scan', ids),
    clean: (ids) => invoke('cleaner:clean', ids),
  },
  license: {
    status: () => invoke('license:status'),
    activate: (key) => invoke('license:activate', key),
    deactivate: () => invoke('license:deactivate'),
  },
  links: {
    status: () => invoke('links:status'),
    configure: (provider, payload) => ipcRenderer.invoke('links:configure', provider, payload),
    configureAccess: (payload) => invoke('links:configure-access', payload),
    refreshAccess: () => invoke('links:refresh-access'),
    connect: (provider) => invoke('links:connect', provider),
    disconnect: (provider) => invoke('links:disconnect', provider),
  },
  network: {
    ping: () => invoke('network:ping'),
  },
  updater: {
    status: () => invoke('updater:status'),
    check: () => invoke('updater:check'),
    install: () => invoke('updater:install'),
    onEvent: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('updater:event', listener);
      return () => ipcRenderer.removeListener('updater:event', listener);
    },
  },
  system: {
    isAdmin: () => invoke('system:is-admin'),
    relaunchElevated: () => invoke('system:relaunch-elevated'),
    createRestorePoint: () => invoke('system:restore-point'),
    flushDns: () => invoke('system:flush-dns'),
    boost: (options) => invoke('system:boost', options),
  },
});
