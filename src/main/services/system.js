'use strict';

/**
 * Funcoes de sistema: privilegios, reinicio elevado, restauro e abertura de pastas.
 */

const path = require('path');
const { app } = require('electron');
const { spawn } = require('child_process');
const { ps } = require('./ps');

let adminCache = null;

async function isAdmin(force = false) {
  if (adminCache !== null && !force) return adminCache;
  const result = await ps(
    '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
    { timeout: 8000 }
  );
  adminCache = result.ok && /^true$/i.test(result.stdout);
  return adminCache;
}

/** Reinicia a app com elevacao (UAC). Devolve false se o utilizador cancelar. */
function relaunchElevated() {
  return new Promise((resolve) => {
    const args = app.isPackaged ? [] : [app.getAppPath()];
    const argList = args.map((a) => `'${String(a).replace(/'/g, "''")}'`).join(',');
    const exe = process.execPath.replace(/'/g, "''");
    const script = [
      'Start-Process',
      `-FilePath '${exe}'`,
      argList ? `-ArgumentList ${argList}` : '',
      "-Verb RunAs -ErrorAction Stop",
    ]
      .filter(Boolean)
      .join(' ');

    const child = spawn(
      path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, detached: true, stdio: 'ignore' }
    );
    child.on('error', () => resolve(false));
    child.on('exit', (code) => {
      if (code === 0) {
        setTimeout(() => app.quit(), 600);
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

async function createRestorePoint() {
  const result = await ps(
    `Checkpoint-Computer -Description 'Nyx Optmizer' -RestorePointType 'MODIFY_SETTINGS'`,
    { timeout: 120000 }
  );
  if (result.ok) return { ok: true, message: 'Ponto de restauro criado.' };
  return {
    ok: false,
    message: 'Nao foi possivel criar o ponto de restauro. Ativa a Protecao do Sistema e executa a app como administrador.',
  };
}

async function flushDns() {
  const result = await ps('ipconfig /flushdns', { timeout: 15000 });
  return { ok: result.ok, message: result.ok ? 'Cache DNS limpa.' : 'Falha ao limpar o cache DNS.' };
}

module.exports = { isAdmin, relaunchElevated, createRestorePoint, flushDns };
