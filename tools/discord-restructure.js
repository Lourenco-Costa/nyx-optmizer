'use strict';

/**
 * Reestruturacao completa do servidor NyxOptimizator.
 *
 * - Guarda um backup antes de alterar.
 * - Apaga canais/categorias e cargos antigos.
 * - Cria a nova hierarquia, canais, permissoes, regras, welcome, verificacao e tickets.
 * - Atualiza tools/discord-bot.env com os novos IDs.
 *
 * Uso: ./tools/node/node.exe tools/discord-restructure.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, 'discord-bot.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const ownerId = process.env.DISCORD_OWNER_ID;
const apiBase = 'https://discord.com/api/v10';
const headers = { Authorization: `Bot ${token}`, 'User-Agent': 'NyxRestructure/1.0' };
const reason = 'Nyx restructuring: clean professional rebuild';
const failures = [];

const P = {
  CREATE_INSTANT_INVITE: 1,
  ADMINISTRATOR: 8,
  VIEW_AUDIT_LOG: 128,
  MANAGE_CHANNELS: 16,
  MANAGE_GUILD: 32,
  ADD_REACTIONS: 64,
  PRIORITY_SPEAKER: 256,
  VIEW_CHANNEL: 1024,
  SEND_MESSAGES: 2048,
  MANAGE_MESSAGES: 8192,
  EMBED_LINKS: 16384,
  ATTACH_FILES: 32768,
  READ_MESSAGE_HISTORY: 65536,
  MENTION_EVERYONE: 131072,
  USE_EXTERNAL_EMOJIS: 262144,
  CONNECT: 1048576,
  SPEAK: 2097152,
  MUTE_MEMBERS: 4194304,
  DEAFEN_MEMBERS: 8388608,
  MOVE_MEMBERS: 16777216,
  USE_VAD: 33554432,
  CHANGE_NICKNAME: 67108864,
  MANAGE_NICKNAMES: 134217728,
  MANAGE_ROLES: 268435456,
  MANAGE_WEBHOOKS: 536870912,
  MANAGE_EMOJIS_AND_STICKERS: 1073741824,
  USE_APPLICATION_COMMANDS: 2147483648,
  MANAGE_EVENTS: 8589934592,
  MANAGE_THREADS: 17179869184,
  CREATE_PUBLIC_THREADS: 34359738368,
  CREATE_PRIVATE_THREADS: 68719476736,
  USE_EXTERNAL_STICKERS: 137438953472,
  SEND_MESSAGES_IN_THREADS: 274877906944,
  USE_EMBEDDED_ACTIVITIES: 549755813888,
  MODERATE_MEMBERS: 1099511627776,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(method, endpoint, body) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await fetch(`${apiBase}${endpoint}`, {
      method,
      headers: {
        ...headers,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        'X-Audit-Log-Reason': reason,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 429) {
      const retry = await res.json().catch(() => ({}));
      await sleep(Math.max(1000, Math.ceil((retry.retry_after || 1) * 1000)));
      continue;
    }

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const message = data && data.message ? data.message : String(data || res.status);
      throw new Error(`${method} ${endpoint} -> ${res.status}: ${message}`);
    }
    return data;
  }
  throw new Error(`${method} ${endpoint} -> rate limit persistente`);
}

async function attempt(label, fn) {
  try {
    const result = await fn();
    console.log(`OK   ${label}`);
    return result;
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    console.log(`FAIL ${label}: ${error.message}`);
    return null;
  }
}

const viewRead = P.VIEW_CHANNEL + P.READ_MESSAGE_HISTORY + P.USE_APPLICATION_COMMANDS;
const memberPerms = viewRead + P.SEND_MESSAGES + P.ADD_REACTIONS + P.EMBED_LINKS + P.ATTACH_FILES +
  P.USE_EXTERNAL_EMOJIS + P.CONNECT + P.SPEAK + P.CHANGE_NICKNAME + P.CREATE_PUBLIC_THREADS +
  P.SEND_MESSAGES_IN_THREADS;
const vipPerms = memberPerms + P.PRIORITY_SPEAKER + P.USE_EXTERNAL_STICKERS;
const moderatorPerms = memberPerms + P.MANAGE_MESSAGES + P.MODERATE_MEMBERS + P.VIEW_AUDIT_LOG;
const administrator = P.ADMINISTRATOR;

const everyoneViewRead = P.VIEW_CHANNEL + P.READ_MESSAGE_HISTORY + P.USE_APPLICATION_COMMANDS;
const infoAllowEveryone = P.VIEW_CHANNEL + P.READ_MESSAGE_HISTORY;
const infoAllowStaff = P.VIEW_CHANNEL + P.READ_MESSAGE_HISTORY + P.SEND_MESSAGES;
const communityAllow = memberPerms;
const voiceAllow = P.VIEW_CHANNEL + P.READ_MESSAGE_HISTORY + P.CONNECT + P.SPEAK;
const staffViewRead = P.VIEW_CHANNEL + P.READ_MESSAGE_HISTORY;
const staffSend = staffViewRead + P.SEND_MESSAGES;

function overwrite(id, type, allow, deny = 0) {
  return { id, type, allow: String(allow), deny: String(deny) };
}

function staffOverwrites(roles, allow) {
  return roles.map((role) => overwrite(role.id, 0, allow));
}

async function main() {
  const guild = await api('GET', `/guilds/${guildId}`);
  const existingChannels = await api('GET', `/guilds/${guildId}/channels`);
  const existingRoles = await api('GET', `/guilds/${guildId}/roles`);
  const botRole = existingRoles.find((role) => role.managed && role.tags && role.tags.bot_id);
  const botRoleId = botRole ? botRole.id : null;

  const backup = {
    savedAt: new Date().toISOString(),
    guild: { id: guild.id, name: guild.name, owner_id: guild.owner_id },
    roles: existingRoles,
    channels: existingChannels,
  };
  const backupPath = path.join(__dirname, `discord-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup: ${backupPath}`);

  console.log('\n--- A apagar canais e categorias ---');
  const nonCategories = existingChannels.filter((channel) => channel.type !== 4);
  const categoriesToDelete = existingChannels.filter((channel) => channel.type === 4);
  for (const channel of [...nonCategories, ...categoriesToDelete]) {
    await attempt(`delete channel #${channel.name}`, () => api('DELETE', `/channels/${channel.id}`));
  }

  console.log('\n--- A apagar cargos antigos ---');
  for (const role of existingRoles.filter((item) => item.id !== guildId && !item.managed)) {
    await attempt(`delete role ${role.name}`, () => api('DELETE', `/guilds/${guildId}/roles/${role.id}`));
  }

  console.log('\n--- A criar cargos ---');
  const roleSpecs = [
    { key: 'novato', name: '🐣 Novato', color: 0x95A5A6, permissions: viewRead, hoist: true },
    { key: 'membro', name: '🌱 Membro', color: 0x2ECC71, permissions: memberPerms, hoist: true },
    { key: 'vip', name: '💎 VIP', color: 0xE91E63, permissions: vipPerms, hoist: true },
    { key: 'moderador', name: '🔨 Moderador', color: 0x3498DB, permissions: moderatorPerms, hoist: true },
    { key: 'admin', name: '🛡️ Admin', color: 0xE74C3C, permissions: administrator, hoist: true },
    { key: 'owner', name: '👑 Owner', color: 0xF1C40F, permissions: administrator, hoist: true },
  ];
  const roles = {};
  for (const spec of roleSpecs) {
    const role = await attempt(`create role ${spec.name}`, () => api('POST', `/guilds/${guildId}/roles`, {
      name: spec.name,
      permissions: String(spec.permissions),
      color: spec.color,
      hoist: spec.hoist,
      mentionable: false,
    }));
    if (role) roles[spec.key] = role;
  }

  if (roles.owner && ownerId) {
    await attempt('atribuir Owner ao dono', () => api('PUT', `/guilds/${guildId}/members/${ownerId}/roles/${roles.owner.id}`));
  }

  console.log('\n--- A ordenar hierarquia ---');
  if (roles.novato && roles.membro && roles.vip && roles.moderador && roles.admin && roles.owner && botRoleId) {
    const wanted = [
      { id: guildId, position: 0 },
      { id: roles.novato.id, position: 1 },
      { id: roles.membro.id, position: 2 },
      { id: roles.vip.id, position: 3 },
      { id: roles.moderador.id, position: 4 },
      { id: roles.admin.id, position: 5 },
      { id: roles.owner.id, position: 6 },
      { id: botRoleId, position: 7 },
    ];
    let ordered = false;
    try {
      await api('PATCH', `/guilds/${guildId}/roles`, wanted);
      console.log('OK   hierarquia completa (bot no topo)');
      ordered = true;
    } catch (error) {
      failures.push(`ordenar hierarquia completa: ${error.message}`);
      console.log(`FAIL hierarquia completa: ${error.message}`);
    }

    if (!ordered) {
      try {
        await api('PATCH', `/guilds/${guildId}/roles`, wanted.filter((item) => item.id !== botRoleId));
        console.log('OK   hierarquia dos cargos de membro (bot abaixo; posicoes dos membros corretas)');
        ordered = true;
      } catch (error) {
        failures.push(`ordenar hierarquia dos membros: ${error.message}`);
        console.log(`FAIL hierarquia dos membros: ${error.message}`);
      }
    }
  }

  console.log('\n--- A configurar @everyone ---');
  await attempt('permissoes base @everyone', () => api('PATCH', `/guilds/${guildId}/roles/${guildId}`, {
    permissions: String(everyoneViewRead),
  }));

  console.log('\n--- A criar categorias e canais ---');
  const staffRoles = [roles.owner, roles.admin, roles.moderador].filter(Boolean);
  const memberRoles = [roles.membro, roles.vip, roles.moderador, roles.admin, roles.owner].filter(Boolean);
  const staffAll = staffRoles;

  const categorySpecs = [
    {
      key: 'info',
      name: '📢・INFORMAÇÕES',
      overwrites: [
        overwrite(guildId, 0, infoAllowEveryone, P.SEND_MESSAGES),
        ...staffOverwrites(staffAll, infoAllowStaff),
      ],
    },
    {
      key: 'community',
      name: '💬・COMUNIDADE',
      overwrites: [
        overwrite(guildId, 0, 0, P.VIEW_CHANNEL),
        ...memberRoles.map((role) => overwrite(role.id, 0, communityAllow)),
      ],
    },
    {
      key: 'voice',
      name: '🔊・VOZ',
      overwrites: [
        overwrite(guildId, 0, 0, P.VIEW_CHANNEL + P.CONNECT),
        ...memberRoles.map((role) => overwrite(role.id, 0, voiceAllow)),
      ],
    },
    {
      key: 'support',
      name: '🎫・SUPORTE',
      overwrites: [
        overwrite(guildId, 0, P.VIEW_CHANNEL + P.READ_MESSAGE_HISTORY, P.SEND_MESSAGES),
        ...staffOverwrites(staffAll, staffSend),
      ],
    },
    {
      key: 'staff',
      name: '🛠️・STAFF',
      overwrites: [
        overwrite(guildId, 0, 0, P.VIEW_CHANNEL),
        ...staffOverwrites(staffAll, staffSend),
      ],
    },
  ];

  const categories = {};
  for (const spec of categorySpecs) {
    const category = await attempt(`create category ${spec.name}`, () => api('POST', `/guilds/${guildId}/channels`, {
      name: spec.name,
      type: 4,
      permission_overwrites: spec.overwrites,
    }));
    if (category) categories[spec.key] = category;
  }

  const channelSpecs = [
    { key: 'rules', name: '📜・regras', parent: 'info', readonly: true },
    { key: 'announcements', name: '📢・anúncios', parent: 'info', readonly: true },
    { key: 'news', name: '🎉・novidades', parent: 'info', readonly: true },
    { key: 'welcome', name: '👋・boas-vindas', parent: 'info', readonly: true },
    { key: 'verify', name: '✅・verificação', parent: 'info', readonly: true },
    { key: 'general', name: '💬・geral', parent: 'community' },
    { key: 'games', name: '🎮・jogos', parent: 'community' },
    { key: 'media', name: '📸・media', parent: 'community' },
    { key: 'bots', name: '🤖・bots', parent: 'community' },
    { key: 'voice-general', name: '🔊・Geral', parent: 'voice', type: 2 },
    { key: 'voice-games', name: '🔊・Jogos', parent: 'voice', type: 2 },
    { key: 'voice-afk', name: '🔊・AFK', parent: 'voice', type: 2, afk: true },
    { key: 'tickets', name: '🎫・tickets', parent: 'support', readonly: true },
    { key: 'logs', name: '📝・logs', parent: 'staff', readonly: true, log: true },
    { key: 'staff-chat', name: '💬・staff-chat', parent: 'staff' },
    { key: 'reports', name: '🚨・denúncias', parent: 'staff' },
  ];

  const channels = {};
  for (const spec of channelSpecs) {
    if (!categories[spec.parent]) {
      failures.push(`canal ${spec.name}: categoria ${spec.parent} nao criada`);
      continue;
    }
    const overwrites = [];
    if (spec.parent === 'staff') {
      if (spec.log) {
        overwrites.push(...staffOverwrites(staffAll, P.VIEW_CHANNEL + P.READ_MESSAGE_HISTORY, P.SEND_MESSAGES));
      }
    } else if (spec.readonly) {
      overwrites.push(overwrite(guildId, 0, P.VIEW_CHANNEL + P.READ_MESSAGE_HISTORY, P.SEND_MESSAGES));
      overwrites.push(...staffOverwrites(staffAll, P.VIEW_CHANNEL + P.READ_MESSAGE_HISTORY + P.SEND_MESSAGES));
    }
    if (spec.afk) {
      overwrites.push(overwrite(guildId, 0, P.CONNECT, P.SPEAK));
      overwrites.push(...memberRoles.map((role) => overwrite(role.id, 0, 0, P.SPEAK)));
    }
    const channel = await attempt(`create channel ${spec.name}`, () => api('POST', `/guilds/${guildId}/channels`, {
      name: spec.name,
      type: spec.type || 0,
      parent_id: categories[spec.parent].id,
      permission_overwrites: overwrites,
    }));
    if (channel) channels[spec.key] = channel;
  }

  console.log('\n--- A publicar mensagens ---');
  const send = (key, payload) => {
    if (!channels[key]) return null;
    return attempt(`message ${key}`, () => api('POST', `/channels/${channels[key].id}/messages`, {
      allowed_mentions: { parse: [] },
      ...payload,
    }));
  };

  if (channels.rules) {
    await send('rules', {
      embeds: [{
        title: '📜 Regras do NyxOptimizator',
        description: 'Bem-vindo à comunidade. Para mantermos um ambiente limpo, seguro e profissional, segue estas regras.',
        color: 0x2ECC71,
        fields: [
          { name: '1. Respeito', value: 'Trata todos os membros com respeito. Não são permitidos insultos, discriminação, assédio ou provocações.' },
          { name: '2. Spam e publicidade', value: 'Sem spam, flood, links de afiliados ou publicidade não autorizada.' },
          { name: '3. Conteúdo proibido', value: 'Não partilhes cheats, malware, cracks, conteúdo pirata ou material ilegal.' },
          { name: '4. Canais corretos', value: 'Usa cada canal para o tema indicado. Dúvidas de suporte vão para o sistema de tickets.' },
          { name: '5. Staff', value: 'Segue as instruções da Staff. Não abras tickets falsos nem cries conflitos desnecessários.' },
          { name: '6. Privacidade', value: 'Não partilhes dados pessoais teus ou de terceiros sem autorização.' },
        ],
        footer: { text: 'Ao permaneceres neste servidor, aceitas automaticamente estas regras.' },
        timestamp: new Date().toISOString(),
      }],
    });
  }

  if (channels.welcome) {
    await send('welcome', {
      content: '👋 **Bem-vindo ao NyxOptimizator!**',
      embeds: [{
        title: 'Começa por aqui',
        description: 'Este é o ponto de entrada da comunidade. Lê as regras, verifica a tua conta e apresenta-te.',
        color: 0x3498DB,
        fields: [
          { name: '📜 Regras', value: channels.rules ? `<#${channels.rules.id}>` : 'Canal de regras' },
          { name: '✅ Verificação', value: channels.verify ? `<#${channels.verify.id}>` : 'Canal de verificação' },
          { name: '🎫 Suporte', value: channels.tickets ? `<#${channels.tickets.id}>` : 'Canal de tickets' },
        ],
        footer: { text: 'NyxOptimizator · comunidade' },
        timestamp: new Date().toISOString(),
      }],
    });
  }

  if (channels.announcements) {
    await send('announcements', {
      embeds: [{
        title: '📢 Servidor reestruturado',
        description: 'O servidor foi reorganizado para ficar mais limpo, seguro e fácil de navegar. Lê as regras e verifica a tua conta para aceder à comunidade.',
        color: 0xF1C40F,
        footer: { text: 'NyxOptimizator' },
        timestamp: new Date().toISOString(),
      }],
    });
  }

  if (channels.news) {
    await send('news', {
      embeds: [{
        title: '🎉 Novidades',
        description: 'Este canal passa a ser usado para novidades, melhorias e novos recursos do NyxOptimizator.',
        color: 0xE91E63,
        footer: { text: 'NyxOptimizator' },
        timestamp: new Date().toISOString(),
      }],
    });
  }

  if (channels.verify) {
    await send('verify', {
      content: '✅ **Verificação de membro**',
      embeds: [{
        title: 'Verifica a tua conta',
        description: 'Clica no botão abaixo para confirmares que leste as regras e libertares o acesso à comunidade.',
        color: 0x2ECC71,
        footer: { text: 'NyxOptimizator · verificação' },
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 3,
          label: 'Verify',
          custom_id: 'verify_member',
          emoji: { name: '✅' },
        }],
      }],
    });
  }

  if (channels.tickets) {
    await send('tickets', {
      content: '**Nyx Tickets** — choose an option below.',
      embeds: [{
        title: 'Nyx Support',
        description: 'Need a key or help with the app? Open a private ticket and our staff will assist you.',
        color: 0x2ECC71,
        fields: [
          { name: '🔑 Buy Key', value: 'Get a Nyx key for your plan.' },
          { name: '🛠️ I Need Help', value: 'Get help with installation, tweaks or errors.' },
        ],
        footer: { text: 'Nyx Optmizer · tickets' },
        timestamp: new Date().toISOString(),
      }],
      components: [{
        type: 1,
        components: [
          { type: 2, style: 3, label: 'Buy Key', custom_id: 'ticket_buy_key', emoji: { name: '🔑' } },
          { type: 2, style: 1, label: 'I Need Help', custom_id: 'ticket_need_help', emoji: { name: '🛠️' } },
        ],
      }],
    });
  }

  if (channels.general) {
    await send('general', {
      content: '💬 **Geral** — apresenta-te, fala com a comunidade e mantém a boa vibe.',
      allowed_mentions: { parse: [] },
    });
  }

  console.log('\n--- A atualizar ficheiro de ambiente do bot ---');
  const envUpdates = {
    DISCORD_AUTO_ROLE_ID: roles.novato && roles.novato.id,
    DISCORD_MEMBER_ROLE_ID: roles.membro && roles.membro.id,
    DISCORD_SUPPORT_CATEGORY_ID: categories.support && categories.support.id,
    DISCORD_STAFF_ROLE_ID: roles.moderador && roles.moderador.id,
    DISCORD_WELCOME_CHANNEL_ID: channels.welcome && channels.welcome.id,
    DISCORD_RULES_CHANNEL_ID: channels.rules && channels.rules.id,
    DISCORD_LOG_CHANNEL_ID: channels.logs && channels.logs.id,
    DISCORD_VERIFY_CHANNEL_ID: channels.verify && channels.verify.id,
    DISCORD_TICKETS_CHANNEL_ID: channels.tickets && channels.tickets.id,
    DISCORD_OWNER_ROLE_ID: roles.owner && roles.owner.id,
    DISCORD_ADMIN_ROLE_ID: roles.admin && roles.admin.id,
    DISCORD_MODERATOR_ROLE_ID: roles.moderador && roles.moderador.id,
    DISCORD_VIP_ROLE_ID: roles.vip && roles.vip.id,
    DISCORD_NOVATO_ROLE_ID: roles.novato && roles.novato.id,
  };

  const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  const seen = new Set();
  const nextEnv = envLines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) return line;
    const key = match[1];
    if (key === 'DISCORD_FREE_ROLE_ID') return null;
    if (Object.prototype.hasOwnProperty.call(envUpdates, key)) {
      seen.add(key);
      const value = envUpdates[key];
      return value ? `${key}=${value}` : line;
    }
    return line;
  }).filter((line) => line !== null);
  for (const [key, value] of Object.entries(envUpdates)) {
    if (!seen.has(key) && value) nextEnv.push(`${key}=${value}`);
  }
  fs.writeFileSync(envPath, nextEnv.join('\r\n').replace(/\r?\n*$/, '\r\n'));

  const structure = {
    createdAt: new Date().toISOString(),
    roles: Object.fromEntries(Object.entries(roles).map(([key, role]) => [key, { id: role.id, name: role.name, position: role.position }])),
    categories: Object.fromEntries(Object.entries(categories).map(([key, channel]) => [key, { id: channel.id, name: channel.name }])),
    channels: Object.fromEntries(Object.entries(channels).map(([key, channel]) => [key, { id: channel.id, name: channel.name }])),
    failures,
  };
  const structurePath = path.join(__dirname, `discord-structure-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(structurePath, JSON.stringify(structure, null, 2));

  console.log('\n--- RESUMO ---');
  console.log(JSON.stringify(structure, null, 2));
  console.log(`\nEstrutura guardada em: ${structurePath}`);
  if (failures.length) {
    console.log(`\nAtencao: ${failures.length} operacao(oes) falharam.`);
  } else {
    console.log('\nTodas as operacoes concluidas.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
