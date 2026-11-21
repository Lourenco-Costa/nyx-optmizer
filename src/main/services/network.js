'use strict';

/**
 * Diagnostico de rede.
 * Usa o ping nativo do Windows e devolve metricas simples para a UI.
 */

const path = require('path');
const { execFile } = require('child_process');

const DEFAULT_HOST = '1.1.1.1';

function ping(host = DEFAULT_HOST) {
  return new Promise((resolve) => {
    const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'PING.EXE');

    execFile(
      exe,
      ['-n', '4', '-w', '1500', host],
      { windowsHide: true, timeout: 16000 },
      (_error, stdout) => {
        const text = String(stdout || '');
        // Apenas as linhas de resposta (TTL=) contam; o resumo final tambem tem "ms"
        // e estragaria a media e a contagem de pacotes perdidos.
        const replies = text.split(/\r?\n/).filter((line) => /TTL\s*=/i.test(line));
        const samples = replies
          .map((line) => {
            const match = line.match(/(\d+)\s*ms/i);
            return match ? Number(match[1]) : null;
          })
          .filter((value) => Number.isFinite(value));

        if (!samples.length) {
          resolve({
            ok: false,
            host,
            message: 'Sem resposta do servidor. Verifica a ligacao e tenta de novo.',
          });
          return;
        }

        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const avg = Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
        const jitter = Math.round(
          samples.reduce((sum, value) => sum + Math.abs(value - avg), 0) / samples.length
        );
        const loss = Math.max(0, Math.round(((4 - samples.length) / 4) * 100));

        resolve({ ok: true, host, avg, min, max, jitter, loss, samples });
      }
    );
  });
}

module.exports = { ping };
