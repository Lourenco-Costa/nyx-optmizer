'use strict';

/**
 * Camada de execucao PowerShell.
 * Todas as operacoes privilegiadas da app passam por aqui para que exista
 * um unico ponto de auditoria, timeout e tratamento de erro.
 */

const path = require('path');
const { execFile } = require('child_process');

const PS_EXE = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

const PRELUDE = [
  '$ErrorActionPreference = "Stop"',
  '$ProgressPreference = "SilentlyContinue"',
  'try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }',
].join('; ');

/**
 * Executa um bloco PowerShell.
 * @param {string} script
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<{ ok: boolean, stdout: string, stderr: string }>}
 */
function ps(script, options = {}) {
  const timeout = options.timeout || 25000;
  return new Promise((resolve) => {
    execFile(
      PS_EXE,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `${PRELUDE}; ${script}`],
      { windowsHide: true, timeout, maxBuffer: 12 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: (stdout || '').trim(),
          stderr: (stderr || '').trim() || (error ? error.message : ''),
        });
      }
    );
  });
}

/** Executa PowerShell e devolve o JSON interpretado (ou null). */
async function psJson(script, options) {
  const result = await ps(script, options);
  if (!result.ok || !result.stdout) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

/** Escapa uma string para interpolar num literal PowerShell de aspas simples. */
function quote(value) {
  return String(value).replace(/'/g, "''");
}

module.exports = { ps, psJson, quote, PS_EXE };
