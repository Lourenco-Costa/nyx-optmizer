'use strict';

/**
 * Ligacoes beta (Google e Discord) por OAuth 2.0 + PKCE e acesso beta
 * por cargo no servidor Discord do Otimizador.
 *
 * O fluxo abre o navegador do sistema e espera pelo callback num servidor
 * local em 127.0.0.1:45871. O codigo e trocado por um token no processo
 * principal e o perfil fica guardado em <userData>/links.json.
 *
 * A politica de acesso (servidor + cargo) vem de community.json (build) ou
 * da configuracao local do Owner. A verificacao fica em cache 7 dias.
 *
 * Segredos e tokens sao cifrados com safeStorage (DPAPI no Windows).
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { app, shell, safeStorage } = require('electron');
const discordAccess = require('./discord-access');

const PORT = 45871;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const TIMEOUT_MS = 180000;

const PROVIDERS = {
  discord: {
    label: 'Discord',
    authorize: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    profile: 'https://discord.com/api/users/@me',
    scope: 'identify guilds guilds.members.read',
  },
  google: {
    label: 'Google',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    profile: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
  },
};

let storePath = null;
let pending = null;

function file() {
  if (!storePath) storePath = path.join(app.getPath('userData'), 'links.json');
  return storePath;
}

function communityFile() {
  return path.join(app.getAppPath(), 'community.json');
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(file(), 'utf8'));
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* primeiro arranque */
  }
  return {};
}

function writeStore(store) {
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(store, null, 2));
    return true;
  } catch {
    return false;
  }
}

function seal(value) {
  if (!value) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return { enc: safeStorage.encryptString(value).toString('base64') };
    }
  } catch {
    /* sem cifra disponivel */
  }
  return { plain: value };
}

function unseal(sealed) {
  if (!sealed) return null;
  if (sealed.enc) {
    try {
      return safeStorage.decryptString(Buffer.from(sealed.enc, 'base64'));
    } catch {
      return null;
    }
  }
  return sealed.plain || null;
}

function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

/* ------------------------------------------------------------------ */
/* Politica de acesso beta                                            */
/* ------------------------------------------------------------------ */

function getAccess() {
  const store = readStore();
  return discordAccess.resolveAccess(store.access || {}, discordAccess.readCommunity(communityFile()));
}

function baseGrant(policy, reason) {
  return {
    active: false,
    configured: policy.configured,
    reason,
    guildId: policy.guildId || null,
    roleId: policy.roleId || null,
    checkedAt: new Date().toISOString(),
    rolesCount: 0,
    nick: null,
  };
}

/** Ultimo resultado valido do cargo, com validade de 7 dias. */
function betaGrant(policy = getAccess(), store = readStore()) {
  const grant = (store.discord || {}).grant || null;

  if (!policy.configured) {
    return { ...baseGrant(policy, 'not-configured'), checkedAt: grant ? grant.checkedAt || null : null };
  }
  if (!grant || grant.guildId !== policy.guildId || grant.roleId !== policy.roleId) {
    return { ...baseGrant(policy, 'not-checked'), checkedAt: grant ? grant.checkedAt || null : null };
  }
  if (!grant.active) {
    return { ...baseGrant(policy, grant.reason || 'no-role'), checkedAt: grant.checkedAt || null, nick: grant.nick || null };
  }
  if (!discordAccess.isFresh(grant.checkedAt)) {
    return { ...baseGrant(policy, 'stale'), checkedAt: grant.checkedAt || null, nick: grant.nick || null };
  }

  return {
    active: true,
    configured: true,
    reason: 'role',
    guildId: policy.guildId,
    roleId: policy.roleId,
    checkedAt: grant.checkedAt,
    rolesCount: grant.rolesCount || 0,
    nick: grant.nick || null,
  };
}

function reasonText(reason) {
  if (reason === 'role') return 'Cargo confirmado. Acesso beta ativo.';
  if (reason === 'no-role') return 'A conta nao tem o cargo necessario no servidor.';
  if (reason === 'not-member') return 'A conta nao esta no servidor do Otimizador.';
  if (reason === 'not-configured') return 'O Owner ainda nao configurou o servidor e o cargo.';
  if (reason === 'stale') return 'A verificacao expirou. Usa "Verificar acesso" outra vez.';
  return 'Nao foi possivel confirmar o cargo agora. Tenta mais tarde.';
}

function configureAccess(payload = {}) {
  const guildId = discordAccess.normalizeId(payload.guildId);
  const roleId = discordAccess.normalizeId(payload.roleId);

  if (!discordAccess.validId(guildId)) {
    return { ok: false, message: 'Server ID invalido. Copia o ID do servidor (17 a 20 digitos).' };
  }
  if (!discordAccess.validId(roleId)) {
    return { ok: false, message: 'Role ID invalido. Copia o ID do cargo (17 a 20 digitos).' };
  }

  const store = readStore();
  store.access = { guildId, roleId };
  if (store.discord) delete store.discord.grant;
  if (!writeStore(store)) {
    return { ok: false, message: 'Nao foi possivel guardar a politica de acesso neste PC.' };
  }

  return {
    ok: true,
    message: 'Acesso beta associado ao servidor e cargo indicados. Cada tester tem de voltar a ligar o Discord.',
    providers: status(),
  };
}

/* ------------------------------------------------------------------ */
/* Estado publico                                                     */
/* ------------------------------------------------------------------ */

function status() {
  const store = readStore();
  const policy = getAccess();
  const out = {};

  for (const [id, provider] of Object.entries(PROVIDERS)) {
    const node = store[id] || {};
    const account = node.account || null;
    out[id] = {
      id,
      label: provider.label,
      redirectUri: REDIRECT_URI,
      configured: Boolean(node.clientId && unseal(node.secret)),
      clientId: node.clientId || null,
      connected: Boolean(account),
      account,
      connectedAt: node.connectedAt || null,
      secure: Boolean(node.secret && node.secret.enc),
      access: id === 'discord' ? policy : null,
      grant: id === 'discord' ? betaGrant(policy, store) : null,
    };
  }

  return out;
}

function configure(provider, payload = {}) {
  const meta = PROVIDERS[provider];
  if (!meta) return { ok: false, message: 'Fornecedor desconhecido.' };

  const clientId = String(payload.clientId || '').trim();
  const clientSecret = String(payload.clientSecret || '').trim();

  if (clientId.length < 10 || clientId.length > 200) {
    return { ok: false, message: 'Client ID invalido. Copia o valor exato da app do fornecedor.' };
  }
  if (clientSecret.length < 5 || clientSecret.length > 200) {
    return { ok: false, message: 'Client Secret invalido. Copia o valor exato da app do fornecedor.' };
  }

  const store = readStore();
  const node = store[provider] || {};
  node.clientId = clientId;
  node.secret = seal(clientSecret);
  store[provider] = node;
  if (!writeStore(store)) {
    return { ok: false, message: 'Nao foi possivel guardar as credenciais neste PC.' };
  }

  return { ok: true, message: `Credenciais do ${meta.label} guardadas.`, providers: status() };
}

function disconnect(provider) {
  const meta = PROVIDERS[provider];
  if (!meta) return { ok: false, message: 'Fornecedor desconhecido.' };

  const store = readStore();
  const node = store[provider] || {};
  if (!node.account && !node.tokens) {
    return { ok: false, message: `O ${meta.label} nao esta ligado.` };
  }
  delete node.account;
  delete node.tokens;
  delete node.connectedAt;
  delete node.grant;
  store[provider] = node;
  writeStore(store);

  return { ok: true, message: `${meta.label} desligado deste PC.`, providers: status() };
}

/* ------------------------------------------------------------------ */
/* OAuth                                                              */
/* ------------------------------------------------------------------ */

async function exchange(provider, code, verifier, clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: verifier,
  });

  const response = await fetch(PROVIDERS[provider].token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Falha ao trocar o codigo por um token.');
  }
  return data;
}

async function refreshOAuth(oauth, clientId, clientSecret) {
  if (!oauth.refresh_token) return null;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: oauth.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetch(PROVIDERS.discord.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) return null;

  return {
    ...oauth,
    access_token: data.access_token,
    refresh_token: data.refresh_token || oauth.refresh_token,
    expires_in: data.expires_in || null,
    obtainedAt: new Date().toISOString(),
  };
}

async function fetchProfile(provider, accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const response = await fetch(PROVIDERS[provider].profile, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Nao foi possivel ler o perfil da conta.');

  if (provider === 'google') {
    return {
      id: data.sub,
      name: data.name || data.email || 'Conta Google',
      email: data.email || null,
      emailVerified: Boolean(data.email_verified),
    };
  }

  let guilds = [];
  let guildCount = 0;
  try {
    const guildResponse = await fetch('https://discord.com/api/users/@me/guilds', { headers });
    if (guildResponse.ok) {
      const list = await guildResponse.json();
      guildCount = Array.isArray(list) ? list.length : 0;
      guilds = (list || []).slice(0, 40).map((guild) => ({
        id: guild.id,
        name: guild.name,
        owner: Boolean(guild.owner),
      }));
    }
  } catch {
    /* servidores sao opcionais */
  }

  return {
    id: data.id,
    name: data.global_name || data.username || 'Conta Discord',
    handle: data.username || null,
    guilds,
    guildCount,
  };
}

/* ------------------------------------------------------------------ */
/* Verificacao de cargo                                               */
/* ------------------------------------------------------------------ */

async function fetchMember(accessToken, guildId) {
  const response = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (response.status === 404) return { status: 404 };
  if (!response.ok) return { status: response.status };
  return { status: 200, member: await response.json().catch(() => null) };
}

async function checkDiscordAccess(oauth, clientId, clientSecret) {
  const policy = getAccess();
  if (!policy.configured) return { grant: baseGrant(policy, 'not-configured'), oauth };

  let current = { ...oauth };
  let result;

  try {
    result = await fetchMember(current.access_token, policy.guildId);
  } catch {
    return { grant: baseGrant(policy, 'check-failed'), oauth: current };
  }

  if (result.status === 401 && current.refresh_token) {
    try {
      const refreshed = await refreshOAuth(current, clientId, clientSecret);
      if (refreshed) {
        current = refreshed;
        result = await fetchMember(current.access_token, policy.guildId);
      }
    } catch {
      /* fica com o resultado original */
    }
  }

  if (result.status === 404) {
    return { grant: { ...baseGrant(policy, 'not-member'), checkedAt: new Date().toISOString() }, oauth: current };
  }
  if (result.status !== 200 || !result.member) {
    return { grant: baseGrant(policy, 'check-failed'), oauth: current };
  }

  const evaluated = discordAccess.evaluateMember(result.member, policy.roleId);
  return {
    grant: {
      ...baseGrant(policy, evaluated.reason),
      active: evaluated.active,
      rolesCount: Array.isArray(result.member.roles) ? result.member.roles.length : 0,
      nick: result.member.nick || null,
    },
    oauth: current,
  };
}

async function refreshAccess(provider) {
  if (provider !== 'discord') {
    return { ok: false, message: 'A verificacao de cargo so existe para o Discord.' };
  }

  const store = readStore();
  const node = store.discord || {};
  if (!node.account) return { ok: false, message: 'Liga o Discord primeiro.' };

  const clientSecret = unseal(node.secret);
  if (!node.clientId || !clientSecret) {
    return { ok: false, code: 'CONFIG', message: 'Faltam as credenciais da app Discord.' };
  }

  let oauth = null;
  try {
    oauth = JSON.parse(unseal(node.tokens) || 'null');
  } catch {
    oauth = null;
  }
  if (!oauth || !oauth.access_token) {
    return { ok: false, code: 'CONNECT', message: 'A ligacao ao Discord expirou. Volta a ligar a conta.' };
  }

  try {
    const checked = await checkDiscordAccess(oauth, node.clientId, clientSecret);
    node.tokens = seal(JSON.stringify(checked.oauth));
    node.grant = checked.grant;
    store.discord = node;
    writeStore(store);

    return {
      ok: true,
      message: reasonText(checked.grant.reason),
      grant: checked.grant,
      providers: status(),
    };
  } catch {
    return { ok: false, message: 'Nao foi possivel contactar o Discord. Verifica a internet e tenta de novo.' };
  }
}

/* ------------------------------------------------------------------ */
/* Ligar / desligar                                                   */
/* ------------------------------------------------------------------ */

function saveAccount(provider, account, token, grant) {
  const store = readStore();
  const node = store[provider] || {};
  node.account = account;
  node.tokens = seal(
    JSON.stringify({
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      expires_in: token.expires_in || null,
      obtainedAt: new Date().toISOString(),
    })
  );
  node.connectedAt = new Date().toISOString();
  if (provider === 'discord') node.grant = grant || null;
  store[provider] = node;
  writeStore(store);
}

function page(title, text, tone) {
  const accent = tone === 'ok' ? '#3ddc97' : '#ff6b6b';
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0a0c12;color:#eef1ff;font-family:'Segoe UI',system-ui,sans-serif">
  <div style="max-width:340px;padding:32px;text-align:center">
    <div style="width:46px;height:46px;margin:0 auto;border-radius:14px;display:grid;place-items:center;font-size:22px;font-weight:700;color:${accent};border:1px solid ${accent}55;background:${accent}18">${tone === 'ok' ? '&#10003;' : '!'}</div>
    <h1 style="font-size:17px;margin:16px 0 6px;font-weight:650">${escapeHtml(title)}</h1>
    <p style="font-size:12.5px;line-height:1.55;color:#98a0b8;margin:0">${escapeHtml(text)}</p>
  </div>
</body></html>`;
}

function connect(provider) {
  const meta = PROVIDERS[provider];
  if (!meta) return Promise.resolve({ ok: false, message: 'Fornecedor desconhecido.' });

  const store = readStore();
  const node = store[provider] || {};
  const clientSecret = unseal(node.secret);

  if (!node.clientId || !clientSecret) {
    return Promise.resolve({
      ok: false,
      code: 'CONFIG',
      message: `Configura primeiro o Client ID e o Client Secret do ${meta.label}.`,
    });
  }
  if (pending) {
    return Promise.resolve({ ok: false, message: 'Ja existe uma ligacao em curso. Fecha a janela do navegador e tenta de novo.' });
  }

  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const state = base64url(crypto.randomBytes(18));

  const url = new URL(meta.authorize);
  url.searchParams.set('client_id', node.clientId);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', meta.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (provider === 'discord') url.searchParams.set('prompt', 'consent');
  if (provider === 'google') {
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
  }

  pending = provider;

  return new Promise((resolve) => {
    let settled = false;
    let server = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      pending = null;
      clearTimeout(timer);
      try {
        server?.close();
      } catch {
        /* ja fechado */
      }
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({ ok: false, code: 'TIMEOUT', message: 'Tempo esgotado. Fecha a janela do navegador e tenta outra vez.' }),
      TIMEOUT_MS
    );

    server = http.createServer(async (request, response) => {
      const incoming = new URL(request.url, REDIRECT_URI);
      if (incoming.pathname !== '/callback') {
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('Not found');
        return;
      }

      const send = (title, text, tone) => {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(page(title, text, tone));
      };

      const error = incoming.searchParams.get('error');
      const code = incoming.searchParams.get('code');
      const returnedState = incoming.searchParams.get('state');

      if (error) {
        send('Ligacao cancelada', 'Podes fechar esta janela e tentar de novo na app.', 'err');
        finish({ ok: false, message: `${meta.label}: ${error}` });
        return;
      }
      if (!code) {
        send('Resposta invalida', 'O fornecedor nao devolveu um codigo de autorizacao.', 'err');
        finish({ ok: false, message: 'Resposta invalida do fornecedor.' });
        return;
      }
      if (returnedState !== state) {
        send('Pedido invalido', 'O estado de seguranca nao coincide. Tenta outra vez.', 'err');
        finish({ ok: false, message: 'Falha de seguranca (state) na ligacao.' });
        return;
      }

      try {
        const token = await exchange(provider, code, verifier, node.clientId, clientSecret);
        const account = await fetchProfile(provider, token.access_token);

        let grant = null;
        let extra = '';
        if (provider === 'discord') {
          try {
            const checked = await checkDiscordAccess(
              { access_token: token.access_token, refresh_token: token.refresh_token || null },
              node.clientId,
              clientSecret
            );
            grant = checked.grant;
            token.access_token = checked.oauth.access_token;
            token.refresh_token = checked.oauth.refresh_token;
            extra = grant.active ? ' Acesso beta confirmado pelo cargo.' : '';
          } catch {
            grant = baseGrant(getAccess(), 'check-failed');
          }
        }

        saveAccount(provider, account, token, grant);
        send('Conta ligada', `${account.name} ja esta ligada ao Otimizador.`, 'ok');
        finish({ ok: true, account, grant, message: `${meta.label} ligado.${extra}` });
      } catch (err) {
        send('Nao foi possivel ligar', 'Volta a app e tenta outra vez.', 'err');
        finish({ ok: false, message: err.message || 'Falha ao concluir a ligacao.' });
      }
    });

    server.on('error', (err) => {
      finish({
        ok: false,
        message:
          err.code === 'EADDRINUSE'
            ? `A porta ${PORT} esta ocupada. Fecha a app que a esta a usar e tenta de novo.`
            : `Nao foi possivel abrir a porta ${PORT}: ${err.message}`,
      });
    });

    server.listen(PORT, '127.0.0.1', () => {
      shell.openExternal(url.toString());
    });
  });
}

module.exports = {
  status,
  configure,
  configureAccess,
  connect,
  disconnect,
  refreshAccess,
  betaGrant,
  reasonText,
  getAccess,
  PROVIDERS,
  REDIRECT_URI,
};
