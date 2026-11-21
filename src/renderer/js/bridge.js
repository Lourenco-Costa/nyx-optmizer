'use strict';

/**
 * Camada de dados da interface.
 * Em Electron usa a API nativa (preload). Num navegador cai para um modo
 * de pre-visualizacao com dados simulados.
 */

(function () {
  const OTZ = (window.OTZ = window.OTZ || {});
  const native = window.otzNative;

  if (native) {
    OTZ.api = native;
    OTZ.isMock = false;
    return;
  }

  /* ------------------------------------------------------------------ */
  /* Modo pre-visualizacao (navegador)                                  */
  /* ------------------------------------------------------------------ */

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const MOCK_TARGETS = [
    { id: 'temp-user', name: 'Temporarios do utilizador', desc: 'Restos de instaladores, caches de apps e ficheiros .tmp', premium: false, admin: false, bytes: 1_486_000_000, files: 4120 },
    { id: 'thumbnails', name: 'Miniaturas e icones', desc: 'Cache de miniaturas do Explorador (recriada automaticamente)', premium: false, admin: false, bytes: 82_400_000, files: 96 },
    { id: 'inetcache', name: 'Cache de internet (Windows)', desc: 'Ficheiros temporarios da Internet do sistema', premium: false, admin: false, bytes: 128_900_000, files: 640 },
    { id: 'd3d', name: 'Cache de shaders DirectX', desc: 'Shaders compilados — libertam espaco e reduzem stutter', premium: false, admin: false, bytes: 97_300_000, files: 210 },
    { id: 'crash', name: 'Relatorios de erros', desc: 'Crash dumps e relatorios do Windows Error Reporting', premium: false, admin: false, bytes: 41_700_000, files: 18 },
    { id: 'recycle', name: 'Reciclagem', desc: 'Conteudo do caixote do lixo de todas as unidades', premium: false, admin: false, bytes: 623_000_000, files: 42 },
    { id: 'browsers', name: 'Caches dos navegadores', desc: 'Chrome, Edge, Brave, Vivaldi, Opera e Firefox', premium: true, admin: false, bytes: 2_148_000_000, files: 9800 },
    { id: 'temp-windows', name: 'Temporarios do Windows', desc: 'Cache partilhada do sistema (requer administrador)', premium: true, admin: true, bytes: 312_000_000, files: 750 },
    { id: 'prefetch', name: 'Prefetch', desc: 'Dados de pre-carregamento antigos', premium: true, admin: true, bytes: 24_600_000, files: 130 },
    { id: 'windows-update', name: 'Cache do Windows Update', desc: 'Instaladores ja aplicados pelo sistema', premium: true, admin: true, bytes: 886_000_000, files: 320 },
    { id: 'delivery', name: 'Otimizacao de entrega', desc: 'Fragmentos de atualizacoes partilhados entre PCs', premium: true, admin: true, bytes: 156_000_000, files: 210 },
    { id: 'gpu-cache', name: 'Cache de shaders da GPU', desc: 'Caches DirectX da NVIDIA e AMD (recriados no proximo jogo)', premium: true, admin: false, bytes: 1_240_000_000, files: 820 },
    { id: 'chat-cache', name: 'Caches de Discord e Teams', desc: 'Imagens, codigo e shaders temporarios das apps de conversa', premium: true, admin: false, bytes: 684_000_000, files: 2340 },
    { id: 'windows-logs', name: 'Logs antigos do Windows', desc: 'Registos de instalacao e diagnostico que ja nao sao necessarios', premium: true, admin: true, bytes: 214_000_000, files: 460 },
  ];

  const targetState = new Map(MOCK_TARGETS.map((t) => [t.id, { ...t }]));
  const applied = new Set(['menu-delay', 'game-mode']);
  let catalogPromise = null;

  let licenseState = {
    licensed: false,
    plan: null,
    planLabel: null,
    beta: false,
    owner: false,
    canUseBeta: false,
    singleUse: false,
    key: null,
    trial: { active: true, daysLeft: 5, totalDays: 7, endsAt: null },
    activatedAt: null,
    expiresAt: null,
    perpetual: false,
    daysLeft: null,
    durationDays: null,
    expired: null,
    machineId: 'PREVIEW-4F2A-91C7',
    canUsePremium: true,
    storePath: '%APPDATA%/nyx-optmizer/license.json',
  };

  const linksState = {
    discord: {
      id: 'discord',
      label: 'Discord',
      redirectUri: 'http://127.0.0.1:45871/callback',
      configured: false,
      clientId: null,
      connected: false,
      account: null,
      connectedAt: null,
      secure: true,
    },
    google: {
      id: 'google',
      label: 'Google',
      redirectUri: 'http://127.0.0.1:45871/callback',
      configured: false,
      clientId: null,
      connected: false,
      account: null,
      connectedAt: null,
      secure: true,
    },
  };

  const linksAccess = { guildId: '', roleId: '' };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function discordBeta() {
    const grant = linksState.discord.grant;
    if (!grant) return null;
    const configured = Boolean(linksAccess.guildId && linksAccess.roleId);
    return { ...grant, configured, active: Boolean(grant.active && configured) };
  }

  function betaAllowed() {
    const grant = discordBeta();
    return licenseState.canUseBeta || Boolean(grant && grant.active);
  }

  function linkProviders() {
    const providers = clone(linksState);
    providers.discord = {
      ...providers.discord,
      access: {
        ...linksAccess,
        configured: Boolean(linksAccess.guildId && linksAccess.roleId),
        source: linksAccess.guildId ? 'local' : 'none',
      },
      grant: discordBeta(),
    };
    return providers;
  }

  const live = { cpu: 14, mem: 58, disk: 61 };

  function drift(value, amount, min, max) {
    return clamp(value + (Math.random() - 0.5) * amount, min, max);
  }

  async function stats() {
    live.cpu = drift(live.cpu, 12, 4, 72);
    live.mem = drift(live.mem, 2.4, 44, 82);
    const cpu = Math.round(live.cpu);
    const memoryPercent = live.mem;
    const disk = { letter: 'C:', total: 512e9, free: 512e9 * (1 - live.disk / 100), used: 512e9 * (live.disk / 100), percent: live.disk };
    const score = clamp(Math.round(100 - (cpu * 0.45 + memoryPercent * 0.25 + disk.percent * 0.15)), 1, 99);
    const grade = score >= 85 ? { label: 'Excelente', tone: 'success' } : score >= 70 ? { label: 'Bom', tone: 'accent' } : score >= 50 ? { label: 'A melhorar', tone: 'warn' } : { label: 'Critico', tone: 'danger' };
    return {
      cpu: { usage: cpu, model: 'Intel Core i7-10750H', cores: 12, speed: 2600 },
      memory: { total: 16 * 1024 ** 3, used: 16 * 1024 ** 3 * (memoryPercent / 100), free: 16 * 1024 ** 3 * (1 - memoryPercent / 100), percent: memoryPercent },
      disk,
      score,
      grade,
      uptime: 60 * 60 * 74,
      hostname: 'SANTOS-PC',
      platform: 'Windows 11 24H2',
      arch: 'x64',
      isAdmin: false,
    };
  }

  async function catalog() {
    if (!catalogPromise) {
      catalogPromise = fetch('/api/mock/catalog')
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
        .then((data) => data || {
          categories: [
            { id: 'desempenho', name: 'Desempenho' },
            { id: 'gaming', name: 'Gaming' },
            { id: 'privacidade', name: 'Privacidade' },
            { id: 'sistema', name: 'Sistema' },
          ],
          tweaks: [
            { id: 'visual-effects', category: 'desempenho', name: 'Efeitos visuais leves', desc: 'Remove animacoes e sombras do Windows.', risk: 'seguro', admin: false, restart: false, recommended: true },
            { id: 'menu-delay', category: 'desempenho', name: 'Menus instantaneos', desc: 'Elimina o atraso ao abrir menus.', risk: 'seguro', admin: false, restart: false, recommended: true },
            { id: 'gamebar', category: 'gaming', name: 'Desativar Game Bar e captura', desc: 'Remove a gravacao em segundo plano.', risk: 'seguro', admin: false, restart: false, recommended: true },
            { id: 'telemetry', category: 'privacidade', name: 'Telemetria minima', desc: 'Reduz o envio de diagnosticos.', risk: 'seguro', admin: true, restart: false, recommended: true },
          ],
        });
    }
    return catalogPromise;
  }

  function sum(ids) {
    let bytes = 0;
    let files = 0;
    for (const id of ids) {
      const target = targetState.get(id);
      if (!target) continue;
      bytes += target.bytes;
      files += target.files;
    }
    return { bytes, files };
  }

  window.OTZ.api = {
    app: {
      info: async () => ({ name: 'Nyx Optmizer', version: '1.2.0', electron: 'preview', chrome: 'Chromium', node: '-', isAdmin: false, dev: true }),
      openPath: async () => true,
      openExternal: async () => true,
    },
    window: { minimize() {}, toggleMaximize: async () => false, close() {}, onMaximized: () => () => {} },
    stats,
    tweaks: {
      list: async () => {
        await wait(260);
        const data = await catalog();
        return {
          categories: data.categories,
          tweaks: data.tweaks.map((t) => ({
            ...t,
            applied: applied.has(t.id),
            supported: true,
            locked: Boolean(t.beta) && !betaAllowed(),
          })),
          premium: licenseState.canUsePremium,
          beta: licenseState.canUseBeta,
          isAdmin: false,
        };
      },
      apply: async (id) => {
        await wait(420);
        if (!licenseState.canUsePremium) return { ok: false, code: 'LICENSE', message: 'O periodo de avaliacao terminou.' };
        const entry = (await catalog()).tweaks.find((t) => t.id === id);
        if (entry && entry.beta && !betaAllowed()) {
          return { ok: false, code: 'BETA', message: 'Funcao beta. Ativa uma chave Owner/Beta ou usa o cargo no Discord.' };
        }
        applied.add(id);
        return { ok: true, message: 'Tweak aplicado.', restart: false };
      },
      revert: async (id) => {
        await wait(320);
        applied.delete(id);
        return { ok: true, message: 'Tweak revertido.' };
      },
      restoreDefaults: async () => {
        await wait(700);
        const count = applied.size;
        applied.clear();
        return { ok: true, reverted: count, failed: 0, message: `${count} tweaks revertidos para o estado original.` };
      },
    },
    cleaner: {
      targets: async () => MOCK_TARGETS.map(({ id, name, desc, premium, admin }) => ({ id, name, desc, premium, admin })),
      scan: async (ids) => {
        await wait(1100);
        const selected = ids && ids.length ? ids : MOCK_TARGETS.map((t) => t.id);
        const targets = [...targetState.values()]
          .filter((t) => selected.includes(t.id))
          .map((t) => ({
            ...t,
            locked: t.premium && !licenseState.canUsePremium,
            available: true,
            time: 120 + Math.round(Math.random() * 240),
          }));
        return {
          targets,
          totalBytes: targets.reduce((acc, t) => acc + (t.premium ? 0 : t.bytes), 0),
          premiumBytes: targets.reduce((acc, t) => acc + (t.premium ? t.bytes : 0), 0),
          canUsePremium: licenseState.canUsePremium,
        };
      },
      clean: async (ids) => {
        await wait(1400);
        const selected = (ids && ids.length ? ids : MOCK_TARGETS.map((t) => t.id)).filter((id) => {
          const target = targetState.get(id);
          return target && (!target.premium || licenseState.canUsePremium);
        });
        const before = sum(selected);
        for (const id of selected) {
          const target = targetState.get(id);
          target.bytes = 0;
          target.files = 0;
        }
        return { ok: true, freed: before.bytes, removedFiles: before.files, failed: 0, skipped: 0, message: 'Limpeza concluida.' };
      },
    },
    license: {
      status: async () => {
        const grant = discordBeta();
        const active = Boolean(grant && grant.active);
        return {
          ...licenseState,
          betaAccess: licenseState.canUseBeta || active,
          betaSource: licenseState.canUseBeta ? (licenseState.owner ? 'owner' : 'key') : active ? 'discord' : null,
          discordBeta: grant,
        };
      },
      activate: async (key) => {
        await wait(650);
        const normalized = String(key || '').toUpperCase().trim();
        if (!/^OTZ-(OWNER|BETA|PRO|ELITE|STAFF)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
          return { ok: false, message: 'Formato invalido. Usa o formato OTZ-PLANO-XXXX-XXXX-XXXX.' };
        }
        const plan = normalized.split('-')[1];
        const labels = { PRO: 'Pro', ELITE: 'Elite', OWNER: 'Owner', BETA: 'Beta', STAFF: 'Staff' };
        const beta = plan === 'OWNER' || plan === 'BETA' || plan === 'STAFF';
        const perpetual = plan === 'STAFF';
        licenseState = {
          ...licenseState,
          licensed: true,
          plan,
          planLabel: labels[plan],
          beta,
          owner: plan === 'OWNER',
          canUseBeta: beta,
          singleUse: false,
          key: `${normalized.slice(0, plan.length + 9)}-****-${normalized.slice(-4)}`,
          activatedAt: new Date().toISOString(),
          expiresAt: perpetual ? null : new Date(Date.now() + 180 * 86400000).toISOString(),
          perpetual,
          daysLeft: perpetual ? null : 180,
          durationDays: perpetual ? null : 180,
          expired: null,
          canUsePremium: true,
          trial: { ...licenseState.trial, active: false },
        };
        return { ok: true, message: `Licenca ${labels[plan]} ativada${perpetual ? ' (permanente)' : ''} na pre-visualizacao.`, status: licenseState };
      },
      deactivate: async () => {
        licenseState = { ...licenseState, licensed: false, plan: null, planLabel: null, beta: false, owner: false, canUseBeta: false, singleUse: false, key: null, expiresAt: null, perpetual: false, daysLeft: null, durationDays: null, expired: null, canUsePremium: true, trial: { ...licenseState.trial, active: true } };
        return licenseState;
      },
    },
    links: {
      status: async () => {
        await wait(160);
        return { ok: true, providers: linkProviders() };
      },
      configureAccess: async (payload = {}) => {
        await wait(320);
        if (!licenseState.owner) {
          return { ok: false, code: 'OWNER', message: 'So a chave Owner pode definir o servidor e o cargo.' };
        }
        const guildId = String(payload.guildId || '').replace(/[^0-9]/g, '');
        const roleId = String(payload.roleId || '').replace(/[^0-9]/g, '');
        if (guildId.length < 15 || roleId.length < 15) {
          return { ok: false, message: 'IDs invalidos. Usa os IDs numericos do servidor e do cargo.' };
        }
        linksAccess.guildId = guildId;
        linksAccess.roleId = roleId;
        linksState.discord = { ...linksState.discord, grant: null };
        return { ok: true, message: 'Acesso beta associado ao servidor e cargo (pre-visualizacao).', providers: linkProviders() };
      },
      refreshAccess: async () => {
        await wait(600);
        if (!linksState.discord.connected) return { ok: false, message: 'Liga o Discord primeiro.' };
        if (!linksAccess.guildId || !linksAccess.roleId) {
          return { ok: false, message: 'O Owner ainda nao configurou o servidor e o cargo.' };
        }
        const grant = {
          active: true,
          configured: true,
          reason: 'role',
          guildId: linksAccess.guildId,
          roleId: linksAccess.roleId,
          checkedAt: new Date().toISOString(),
          rolesCount: 2,
          nick: 'Santos',
        };
        linksState.discord = { ...linksState.discord, grant };
        return { ok: true, message: 'Cargo confirmado. Acesso beta ativo.', grant, providers: linkProviders() };
      },
      configure: async (provider, payload = {}) => {
        await wait(320);
        if (!licenseState.owner) {
          return { ok: false, code: 'OWNER', message: 'So a chave Owner pode configurar as apps OAuth.' };
        }
        if (!linksState[provider]) return { ok: false, message: 'Fornecedor desconhecido.' };
        if (!payload.clientId || !payload.clientSecret) {
          return { ok: false, message: 'Preenche o Client ID e o Client Secret.' };
        }
        linksState[provider] = {
          ...linksState[provider],
          configured: true,
          clientId: payload.clientId,
          secure: true,
        };
        return { ok: true, message: `Credenciais do ${linksState[provider].label} guardadas.`, providers: clone(linksState) };
      },
      connect: async (provider) => {
        await wait(900);
        if (!linksState[provider]?.configured) {
          return { ok: false, code: 'CONFIG', message: 'Configura primeiro o Client ID e o Client Secret.' };
        }
        const configured = Boolean(linksAccess.guildId && linksAccess.roleId);
        const grant = {
          active: configured,
          configured,
          reason: configured ? 'role' : 'not-configured',
          guildId: linksAccess.guildId || null,
          roleId: linksAccess.roleId || null,
          checkedAt: new Date().toISOString(),
          rolesCount: configured ? 2 : 0,
          nick: configured ? 'Santos' : null,
        };
        const account =
          provider === 'discord'
            ? { id: '1082', name: 'Santos', handle: 'santos', guilds: [{ id: '1', name: 'Nyx', owner: true }], guildCount: 1 }
            : { id: '1001', name: 'Santos', email: 'santos@exemplo.pt', emailVerified: true };
        linksState[provider] = {
          ...linksState[provider],
          connected: true,
          account,
          grant: provider === 'discord' ? grant : linksState[provider].grant,
          connectedAt: new Date().toISOString(),
        };
        return {
          ok: true,
          account,
          grant: provider === 'discord' ? grant : null,
          message: `${linksState[provider].label} ligado (pre-visualizacao).${grant.active ? ' Acesso beta confirmado.' : ''}`,
        };
      },
      disconnect: async (provider) => {
        await wait(240);
        if (!linksState[provider]) return { ok: false, message: 'Fornecedor desconhecido.' };
        linksState[provider] = { ...linksState[provider], connected: false, account: null, connectedAt: null, grant: null };
        return { ok: true, message: `${linksState[provider].label} desligado.`, providers: linkProviders() };
      },
    },
    network: {
      ping: async () => {
        await wait(900);
        const samples = [18, 24, 21, 19].map((value) => Math.max(8, Math.round(value + (Math.random() - 0.5) * 8)));
        const avg = Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const jitter = Math.round(
          samples.reduce((sum, value) => sum + Math.abs(value - avg), 0) / samples.length
        );
        return { ok: true, host: '1.1.1.1', avg, min, max, jitter, loss: 0, samples };
      },
    },
    updater: {
      status: async () => ({
        status: 'dev',
        message: 'Canal GitHub configurado; atualizacoes apenas na app instalada.',
        progress: 0,
        version: '1.2.0',
        updateVersion: null,
        channel: 'Lourenco-Costa/nyx-optmizer',
        canCheck: false,
        canInstall: false,
        dev: true,
      }),
      check: async () => ({
        ok: false,
        status: 'dev',
        message: 'Canal GitHub configurado; atualizacoes apenas na app instalada.',
        progress: 0,
        version: '1.2.0',
        updateVersion: null,
        channel: 'Lourenco-Costa/nyx-optmizer',
        canCheck: false,
        canInstall: false,
        dev: true,
      }),
      install: async () => false,
      onEvent: () => () => {},
    },
    system: {
      isAdmin: async () => false,
      relaunchElevated: async () => false,
      createRestorePoint: async () => ({ ok: false, message: 'Disponivel apenas na app instalada, com administrador.' }),
      flushDns: async () => ({ ok: true, message: 'Cache DNS limpa.' }),
      boost: async () => {
        await wait(1600);
        const data = await catalog();
        const recommended = data.tweaks.filter((t) => t.recommended);
        const selected = ['temp-user', 'thumbnails', 'inetcache', 'd3d', 'crash', 'recycle', ...(licenseState.licensed ? ['browsers', 'gpu-cache', 'chat-cache'] : [])];
        const before = sum(selected);
        for (const id of selected) {
          const target = targetState.get(id);
          target.bytes = 0;
          target.files = 0;
        }
        recommended.forEach((t) => applied.add(t.id));
        return {
          ok: true,
          freed: before.bytes,
          tweaksApplied: recommended.length,
          steps: [
            { label: 'Limpeza de ficheiros', detail: `${before.files} ficheiros removidos`, ok: true },
            { label: 'Tweaks recomendados', detail: `${recommended.length} aplicados`, ok: true },
            { label: 'Cache DNS', detail: 'limpa', ok: true },
          ],
          message: 'Otimizacao concluida.',
        };
      },
    },
  };

  OTZ.isMock = true;
})();
