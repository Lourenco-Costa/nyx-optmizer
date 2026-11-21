'use strict';

/**
 * Motor de limpeza: descobre alvos, mede o espaco ocupado e remove o conteudo.
 * Tudo é tolerante a erros: ficheiros bloqueados pelo sistema sao ignorados.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');

const { ps, psJson } = require('./ps');

const MAX_ENTRIES = 120000;
const SCAN_TIMEOUT_MS = 9000;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function expand(value) {
  return String(value).replace(/%([^%]+)%/g, (match, key) => process.env[key] || match);
}

function exists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

function readdirSafe(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function dirs(list) {
  return list.map((dir) => expand(dir)).filter(exists);
}

/** Resolve caches dos navegadores instalados (Chromium + Firefox). */
function browserCacheDirs() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const out = [];

  const chromium = [
    { root: path.join(local, 'Google', 'Chrome', 'User Data'), subs: ['Cache', 'Code Cache', 'GPUCache', 'GrShaderCache', 'DawnGraphiteCache'] },
    { root: path.join(local, 'Microsoft', 'Edge', 'User Data'), subs: ['Cache', 'Code Cache', 'GPUCache', 'GrShaderCache', 'DawnGraphiteCache'] },
    { root: path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data'), subs: ['Cache', 'Code Cache', 'GPUCache'] },
    { root: path.join(local, 'Vivaldi', 'User Data'), subs: ['Cache', 'Code Cache', 'GPUCache'] },
    { root: path.join(roaming, 'Opera Software', 'Opera Stable'), subs: ['Cache', 'Code Cache', 'GPUCache'] },
  ];

  for (const { root, subs } of chromium) {
    if (!exists(root)) continue;
    for (const entry of readdirSafe(root)) {
      if (!entry.isDirectory()) continue;
      if (!/^(Default|Profile \d+|Guest Profile|System Profile)$/i.test(entry.name)) continue;
      for (const sub of subs) {
        const full = path.join(root, entry.name, sub);
        if (exists(full)) out.push(full);
      }
    }
  }

  const firefoxRoot = path.join(local, 'Mozilla', 'Firefox', 'Profiles');
  for (const profile of readdirSafe(firefoxRoot)) {
    if (!profile.isDirectory()) continue;
    const cache = path.join(firefoxRoot, profile.name, 'cache2');
    if (exists(cache)) out.push(cache);
  }

  return out;
}

function thumbcacheFiles() {
  const explorer = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Explorer');
  if (!exists(explorer)) return [];
  return readdirSafe(explorer)
    .filter((e) => e.isFile() && /^(thumbcache_.*\.db|iconcache_.*\.db)$/i.test(e.name))
    .map((e) => path.join(explorer, e.name));
}

/* ------------------------------------------------------------------ */
/* Alvos                                                               */
/* ------------------------------------------------------------------ */

const TARGETS = [
  {
    id: 'temp-user',
    name: 'Temporarios do utilizador',
    desc: 'Restos de instaladores, caches de apps e ficheiros .tmp',
    premium: false,
    admin: false,
    resolve: () => ({ dirs: dirs(['%TEMP%']), files: [] }),
  },
  {
    id: 'thumbnails',
    name: 'Miniaturas e icones',
    desc: 'Cache de miniaturas do Explorador (recriada automaticamente)',
    premium: false,
    admin: false,
    resolve: () => ({ dirs: [], files: thumbcacheFiles() }),
  },
  {
    id: 'inetcache',
    name: 'Cache de internet (Windows)',
    desc: 'Ficheiros temporarios da Internet do sistema',
    premium: false,
    admin: false,
    resolve: () => ({ dirs: dirs(['%LOCALAPPDATA%\\Microsoft\\Windows\\INetCache']), files: [] }),
  },
  {
    id: 'd3d',
    name: 'Cache de shaders DirectX',
    desc: 'Shaders compilados — libertam espaco e reduzem stutter',
    premium: false,
    admin: false,
    resolve: () => ({ dirs: dirs(['%LOCALAPPDATA%\\D3DSCache']), files: [] }),
  },
  {
    id: 'crash',
    name: 'Relatorios de erros',
    desc: 'Crash dumps e relatorios do Windows Error Reporting',
    premium: false,
    admin: false,
    resolve: () => ({
      dirs: dirs([
        '%LOCALAPPDATA%\\CrashDumps',
        '%LOCALAPPDATA%\\Microsoft\\Windows\\WER\\ReportArchive',
        '%LOCALAPPDATA%\\Microsoft\\Windows\\WER\\ReportQueue',
        '%LOCALAPPDATA%\\Microsoft\\Windows\\WER\\Temp',
      ]),
      files: [],
    }),
  },
  {
    id: 'recycle',
    name: 'Reciclagem',
    desc: 'Conteudo do caixote do lixo de todas as unidades',
    premium: false,
    admin: false,
    special: 'recycle',
    resolve: () => ({ dirs: [], files: [] }),
  },
  {
    id: 'browsers',
    name: 'Caches dos navegadores',
    desc: 'Chrome, Edge, Brave, Vivaldi, Opera e Firefox',
    premium: true,
    admin: false,
    resolve: () => ({ dirs: browserCacheDirs(), files: [] }),
  },
  {
    id: 'temp-windows',
    name: 'Temporarios do Windows',
    desc: 'Cache partilhada do sistema (requer administrador)',
    premium: true,
    admin: true,
    resolve: () => ({ dirs: dirs(['%WINDIR%\\Temp']), files: [] }),
  },
  {
    id: 'prefetch',
    name: 'Prefetch',
    desc: 'Dados de pre-carregamento antigos',
    premium: true,
    admin: true,
    resolve: () => ({ dirs: [], files: readdirSafe(path.join(process.env.WINDIR || 'C:\\Windows', 'Prefetch')).filter((e) => e.isFile()).map((e) => path.join(process.env.WINDIR || 'C:\\Windows', 'Prefetch', e.name)) }),
  },
  {
    id: 'windows-update',
    name: 'Cache do Windows Update',
    desc: 'Instaladores ja aplicados pelo sistema',
    premium: true,
    admin: true,
    resolve: () => ({ dirs: dirs(['%WINDIR%\\SoftwareDistribution\\Download']), files: [] }),
  },
  {
    id: 'delivery',
    name: 'Otimizacao de entrega',
    desc: 'Fragmentos de atualizacoes partilhados entre PCs',
    premium: true,
    admin: true,
    resolve: () => ({
      dirs: dirs(['%WINDIR%\\ServiceProfiles\\NetworkService\\AppData\\Local\\Microsoft\\Windows\\DeliveryOptimization']),
      files: [],
    }),
  },
  {
    id: 'gpu-cache',
    name: 'Cache de shaders da GPU',
    desc: 'Caches DirectX da NVIDIA e AMD (recriados no proximo jogo)',
    premium: true,
    admin: false,
    resolve: () => ({
      dirs: dirs([
        '%LOCALAPPDATA%\\NVIDIA\\DXCache',
        '%LOCALAPPDATA%\\NVIDIA\\GLCache',
        '%LOCALAPPDATA%\\AMD\\DxCache',
        '%LOCALAPPDATA%\\AMD\\GLCache',
      ]),
      files: [],
    }),
  },
  {
    id: 'chat-cache',
    name: 'Caches de Discord e Teams',
    desc: 'Imagens, codigo e shaders temporarios das apps de conversa',
    premium: true,
    admin: false,
    resolve: () => ({
      dirs: dirs([
        '%APPDATA%\\discord\\Cache',
        '%APPDATA%\\discord\\Code Cache',
        '%APPDATA%\\discord\\GPUCache',
        '%APPDATA%\\Microsoft\\Teams\\Cache',
        '%APPDATA%\\Microsoft\\Teams\\Code Cache',
        '%APPDATA%\\Microsoft\\Teams\\GPUCache',
      ]),
      files: [],
    }),
  },
  {
    id: 'windows-logs',
    name: 'Logs antigos do Windows',
    desc: 'Registos de instalacao e diagnostico que ja nao sao necessarios',
    premium: true,
    admin: true,
    resolve: () => ({ dirs: dirs(['%WINDIR%\\Logs']), files: [] }),
  },
];

/* ------------------------------------------------------------------ */
/* Medicao e remocao                                                   */
/* ------------------------------------------------------------------ */

async function measureDir(root, budget) {
  let bytes = 0;
  let files = 0;
  const stack = [root];

  while (stack.length && budget.left > 0 && budget.entries > 0) {
    if (Date.now() > budget.deadline) break;
    const dir = stack.pop();
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      budget.entries -= 1;
      if (budget.entries <= 0) break;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        try {
          const stat = await fsp.stat(full);
          bytes += stat.size;
          files += 1;
        } catch {
          /* ficheiro bloqueado */
        }
      }
    }
  }
  return { bytes, files };
}

function newBudget() {
  return { entries: MAX_ENTRIES, deadline: Date.now() + SCAN_TIMEOUT_MS, left: MAX_ENTRIES };
}

async function measureTarget(target) {
  if (target.special === 'recycle') {
    const data = await psJson(
      `$sh = New-Object -ComObject Shell.Application; $items = $sh.NameSpace(10).Items(); $b = 0; foreach ($i in $items) { $b += $i.Size }; [pscustomobject]@{ bytes = [int64]$b; files = [int]$items.Count } | ConvertTo-Json -Compress`,
      { timeout: 12000 }
    );
    return { bytes: Number(data?.bytes) || 0, files: Number(data?.files) || 0 };
  }

  const { dirs: dirList, files: fileList } = target.resolve();
  const budget = newBudget();
  let bytes = 0;
  let files = 0;

  for (const dir of dirList) {
    const partial = await measureDir(dir, budget);
    bytes += partial.bytes;
    files += partial.files;
  }
  for (const file of fileList) {
    try {
      const stat = await fsp.stat(file);
      bytes += stat.size;
      files += 1;
    } catch {
      /* ignorar */
    }
  }
  return { bytes, files };
}

async function removeContents(dir) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) await fsp.rm(full, { recursive: true, force: true, maxRetries: 1 });
      else await fsp.rm(full, { force: true, maxRetries: 1 });
    } catch {
      /* em uso pelo sistema */
    }
  }
}

/* ------------------------------------------------------------------ */
/* API publica                                                         */
/* ------------------------------------------------------------------ */

/** Lista de alvos disponiveis (sem medicao). */
function listTargets() {
  return TARGETS.map(({ id, name, desc, premium, admin }) => ({ id, name, desc, premium, admin }));
}

/**
 * Mede os alvos pedidos.
 * @param {string[]} [ids]
 */
async function scan(ids) {
  const selected = ids && ids.length ? TARGETS.filter((t) => ids.includes(t.id)) : TARGETS;
  const results = [];

  for (const target of selected) {
    const started = Date.now();
    try {
      const { bytes, files } = await measureTarget(target);
      results.push({
        id: target.id,
        name: target.name,
        desc: target.desc,
        premium: target.premium,
        admin: target.admin,
        bytes,
        files,
        time: Date.now() - started,
        available: true,
      });
    } catch (error) {
      results.push({
        id: target.id,
        name: target.name,
        desc: target.desc,
        premium: target.premium,
        admin: target.admin,
        bytes: 0,
        files: 0,
        time: Date.now() - started,
        available: false,
        error: String(error && error.message ? error.message : error),
      });
    }
  }

  return {
    targets: results,
    totalBytes: results.reduce((sum, r) => sum + (r.premium ? 0 : r.bytes), 0),
    premiumBytes: results.reduce((sum, r) => sum + (r.premium ? r.bytes : 0), 0),
  };
}

/**
 * Limpa os alvos indicados.
 * @param {string[]} ids
 */
async function clean(ids) {
  const selected = TARGETS.filter((t) => !ids || ids.includes(t.id));
  let freed = 0;
  let removedFiles = 0;
  let failed = 0;

  for (const target of selected) {
    try {
      const before = await measureTarget(target);
      if (target.special === 'recycle') {
        const result = await ps('Clear-RecycleBin -Force -Confirm:$false -ErrorAction SilentlyContinue', { timeout: 60000 });
        if (result.ok) {
          freed += before.bytes;
          removedFiles += before.files;
        } else {
          failed += 1;
        }
        continue;
      }

      const { dirs: dirList, files: fileList } = target.resolve();
      for (const dir of dirList) await removeContents(dir);
      for (const file of fileList) {
        try {
          await fsp.rm(file, { force: true });
        } catch {
          failed += 1;
        }
      }
      freed += before.bytes;
      removedFiles += before.files;
    } catch {
      failed += 1;
    }
  }

  return { freed, removedFiles, failed };
}

module.exports = { listTargets, scan, clean, TARGETS };
