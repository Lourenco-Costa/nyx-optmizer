'use strict';

/**
 * Estado do sistema: CPU, memoria, disco, uptime e pontuacao de saude.
 * Leitura barata (sem spawnar processos a cada tick).
 */

const os = require('os');
const fs = require('fs');

let previous = readCpuTimes();
let cachedDisk = null;
let cachedDiskAt = 0;

function readCpuTimes() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const key of Object.keys(cpu.times)) total += cpu.times[key];
    idle += cpu.times.idle;
  }
  return { idle, total };
}

/** Uso de CPU em % medido entre duas leituras (nao bloqueante). */
function cpuUsage(windowMs = 320) {
  return new Promise((resolve) => {
    const start = readCpuTimes();
    setTimeout(() => {
      const end = readCpuTimes();
      const idle = end.idle - start.idle;
      const total = end.total - start.total;
      resolve(total > 0 ? Math.min(100, Math.max(0, 100 - (idle / total) * 100)) : 0);
    }, windowMs);
  });
}

function diskInfo() {
  const now = Date.now();
  if (cachedDisk && now - cachedDiskAt < 8000) return cachedDisk;
  const letter = process.env.SystemDrive || 'C:';
  try {
    const stat = fs.statfsSync(`${letter}\\`);
    const total = stat.blocks * stat.bsize;
    const free = stat.bfree * stat.bsize;
    cachedDisk = {
      letter: letter.replace('\\', ''),
      total,
      free,
      used: total - free,
      percent: total > 0 ? (total - free) / total * 100 : 0,
    };
    cachedDiskAt = now;
  } catch {
    cachedDisk = { letter: 'C:', total: 0, free: 0, used: 0, percent: 0 };
  }
  return cachedDisk;
}

function healthScore(cpu, memoryPercent, diskPercent) {
  // A CPU pesa mais porque e o que se sente primeiro; o disco quase vazio
  // nao deve mascarar um sistema sem folga.
  const penalty = cpu * 0.45 + memoryPercent * 0.25 + diskPercent * 0.15;
  return Math.max(1, Math.min(99, Math.round(100 - penalty)));
}

function grade(score) {
  if (score >= 85) return { label: 'Excelente', tone: 'success' };
  if (score >= 70) return { label: 'Bom', tone: 'accent' };
  if (score >= 50) return { label: 'A melhorar', tone: 'warn' };
  return { label: 'Critico', tone: 'danger' };
}

async function getStats() {
  const cpu = await cpuUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryPercent = totalMem > 0 ? (usedMem / totalMem) * 100 : 0;
  const disk = diskInfo();
  const score = healthScore(cpu, memoryPercent, disk.percent);
  const cpuInfo = os.cpus()[0] || { model: 'CPU', speed: 0 };

  return {
    cpu: { usage: cpu, model: cpuInfo.model.trim(), cores: os.cpus().length, speed: cpuInfo.speed },
    memory: { total: totalMem, used: usedMem, free: freeMem, percent: memoryPercent },
    disk,
    score,
    grade: grade(score),
    uptime: os.uptime(),
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
  };
}

module.exports = { getStats, diskInfo, healthScore, grade };
