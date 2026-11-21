'use strict';

/**
 * Bot do servidor: auto-role e tickets.
 *
 * Assigns the Newbie role to every new human member and handles the
 * Buy Key / I Need Help buttons in #tickets by creating a private channel.
 *
 * Corre com:
 *
 *   DISCORD_BOT_TOKEN=... \
 *   DISCORD_GUILD_ID=... \
 *   DISCORD_AUTO_ROLE_ID=... \
 *   DISCORD_MEMBER_ROLE_ID=... \
 *   DISCORD_SUPPORT_CATEGORY_ID=... \
 *   DISCORD_STAFF_ROLE_ID=... \
 *   DISCORD_OWNER_ID=... \
 *   DISCORD_WELCOME_CHANNEL_ID=... \
 *   DISCORD_RULES_CHANNEL_ID=... \
 *   DISCORD_VERIFY_CHANNEL_ID=... \
 *   DISCORD_LOG_CHANNEL_ID=... \
 *   ./tools/node/node.exe tools/discord-autorole.js
 *
 * O token nao fica neste ficheiro. O bot precisa do Server Members Intent
 * ativo no Discord Developer Portal.
 */

const fs = require('fs');
const path = require('path');

const envPath = fs.existsSync(path.join(__dirname, '.env'))
  ? path.join(__dirname, '.env')
  : path.join(__dirname, 'discord-bot.env');
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
const autoRoleId = process.env.DISCORD_AUTO_ROLE_ID;
const memberRoleId = process.env.DISCORD_MEMBER_ROLE_ID;
const supportCategoryId = process.env.DISCORD_SUPPORT_CATEGORY_ID;
const staffRoleId = process.env.DISCORD_STAFF_ROLE_ID;
const ownerId = process.env.DISCORD_OWNER_ID;
const welcomeChannelId = process.env.DISCORD_WELCOME_CHANNEL_ID;
const rulesChannelId = process.env.DISCORD_RULES_CHANNEL_ID;
const verifyChannelId = process.env.DISCORD_VERIFY_CHANNEL_ID;
const logChannelId = process.env.DISCORD_LOG_CHANNEL_ID;

if (!token || !guildId || !autoRoleId) {
  console.error('Missing environment variables: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID and DISCORD_AUTO_ROLE_ID.');
  process.exit(1);
}

const apiBase = 'https://discord.com/api/v10';
const gatewayUrl = 'wss://gateway.discord.gg/?v=10&encoding=json';
const headers = {
  Authorization: `Bot ${token}`,
  'User-Agent': 'NyxBot/1.0',
};

let socket = null;
let heartbeat = null;
let sequence = null;
let reconnectTimer = null;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function discord(method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const message = data && data.message ? data.message : String(data || res.status);
    throw new Error(`${method} ${path} -> ${res.status}: ${message}`);
  }
  return data;
}

async function addRole(userId, roleId) {
  await discord('PUT', `/guilds/${guildId}/members/${userId}/roles/${roleId}`);
}

async function sendChannelMessage(channelId, payload) {
  if (!channelId) return;
  await discord('POST', `/channels/${channelId}/messages`, payload);
}

async function sendWelcome(user) {
  if (!welcomeChannelId || !user) return;
  const rules = rulesChannelId ? `<#${rulesChannelId}>` : 'the rules channel';
  const verify = verifyChannelId ? `<#${verifyChannelId}>` : 'the verification channel';
  try {
    await sendChannelMessage(welcomeChannelId, {
      allowed_mentions: { users: [user.id] },
      content: `👋 Welcome, <@${user.id}>!`,
      embeds: [{
        title: 'Welcome to NyxOptimizator',
        description: `Hey <@${user.id}>, welcome to the community!\n\nBefore you start, read the rules and verify your account.`,
        color: 0x2ECC71,
        fields: [
          { name: '📜 Rules', value: `Read ${rules} before participating.` },
          { name: '✅ Verification', value: `Verify your account in ${verify}.` },
        ],
        footer: { text: 'NyxOptimizator · community' },
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (error) {
    log(`failed to send welcome message to ${user.id}: ${error.message}`);
  }
}

async function sendMemberLog(action, user) {
  if (!logChannelId || !user) return;
  const entries = {
    joined: { title: '📥 Member joined', description: 'joined the server.', color: 0x2ECC71 },
    left: { title: '📤 Member left', description: 'left the server.', color: 0xE74C3C },
    verified: { title: '✅ Member verified', description: 'completed verification.', color: 0x3498DB },
    banned: { title: '🔨 Member banned', description: 'was banned from the server.', color: 0x992D22 },
    unbanned: { title: '🔓 Member unbanned', description: 'was unbanned from the server.', color: 0x1ABC9C },
  };
  const entry = entries[action];
  if (!entry) return;
  try {
    await sendChannelMessage(logChannelId, {
      allowed_mentions: { parse: [] },
      embeds: [{
        title: entry.title,
        description: `<@${user.id}> ${entry.description}`,
        color: entry.color,
        fields: [{ name: 'User', value: `${user.username || 'unknown'} (${user.id})` }],
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (error) {
    log(`failed to log ${action} for ${user.id}: ${error.message}`);
  }
}

async function onMemberAdd(member) {
  if (!member || !member.user || member.user.bot) return;
  const user = member.user;
  try {
    await addRole(user.id, autoRoleId);
    log(`Newbie role assigned to ${user.username || user.id} (${user.id})`);
  } catch (error) {
    log(`failed to assign Newbie to ${user.id}: ${error.message}`);
  }
  await sendWelcome(user);
  await sendMemberLog('joined', user);
}

async function onMemberRemove(member) {
  if (!member || !member.user || member.user.bot) return;
  await sendMemberLog('left', member.user);
}

async function onGuildBan(ban, action) {
  if (!ban || !ban.user) return;
  await sendMemberLog(action, ban.user);
}

function slug(value) {
  return String(value || 'user')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'user';
}

async function defer(interaction) {
  const res = await fetch(`${apiBase}/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 5, data: { flags: 64 } }),
  });
  if (!res.ok) throw new Error(`defer ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function editOriginal(interaction, content) {
  const res = await fetch(`${apiBase}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bot ${token}` },
    body: JSON.stringify({ content, flags: 64 }),
  });
  if (!res.ok) throw new Error(`edit original ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendDirectMessage(userId, content) {
  const dm = await discord('POST', '/users/@me/channels', { recipient_id: userId });
  await discord('POST', `/channels/${dm.id}/messages`, {
    content,
    allowed_mentions: { parse: [] },
  });
}

async function createTicket(interaction, label) {
  if (!supportCategoryId) throw new Error('DISCORD_SUPPORT_CATEGORY_ID is not configured.');
  const user = interaction.member && interaction.member.user ? interaction.member.user : interaction.user;
  if (!user) throw new Error('Ticket user not found.');

  const overwrites = [
    { id: guildId, type: 0, allow: '0', deny: '1024' },
    { id: user.id, type: 1, allow: '101376', deny: '0' },
  ];
  if (staffRoleId) overwrites.push({ id: staffRoleId, type: 0, allow: '109568', deny: '0' });
  if (ownerId) overwrites.push({ id: ownerId, type: 1, allow: '101376', deny: '0' });

  const channel = await discord('POST', `/guilds/${guildId}/channels`, {
    name: `ticket-${slug(user.username)}`,
    type: 0,
    parent_id: supportCategoryId,
    topic: `${label} ticket for ${user.username || user.id}`,
    permission_overwrites: overwrites,
  });

  return channel;
}

async function handleVerification(interaction) {
  const user = interaction.member && interaction.member.user ? interaction.member.user : interaction.user;
  if (!user) return;
  try {
    await defer(interaction);
  } catch (error) {
    log(`failed to respond to verification: ${error.message}`);
    return;
  }

  const roles = interaction.member && Array.isArray(interaction.member.roles) ? interaction.member.roles : [];
  if (memberRoleId && roles.includes(memberRoleId)) {
    await editOriginal(interaction, 'You are already verified. Welcome to the community!');
    return;
  }

  try {
    if (!memberRoleId) throw new Error('DISCORD_MEMBER_ROLE_ID is not configured.');
    await addRole(user.id, memberRoleId);
    if (autoRoleId) {
      try { await discord('DELETE', `/guilds/${guildId}/members/${user.id}/roles/${autoRoleId}`); } catch {}
    }
    await editOriginal(interaction, 'Verification complete. You now have access to the community!');
    await sendMemberLog('verified', user);
    log(`member ${user.id} verified`);
  } catch (error) {
    log(`failed to verify ${user.id}: ${error.message}`);
    try {
      await editOriginal(interaction, 'Could not complete verification. Please contact staff.');
    } catch {}
  }
}

async function onInteraction(interaction) {
  if (!interaction || interaction.type !== 3) return;
  if (interaction.guild_id !== guildId) return;
  const customId = interaction.data && interaction.data.custom_id;
  if (customId === 'verify_member') {
    await handleVerification(interaction);
    return;
  }
  const labels = {
    ticket_buy_key: 'Buy Key',
    ticket_need_help: 'I Need Help',
  };
  const label = labels[customId];
  if (!label) return;

  try {
    await defer(interaction);
  } catch (error) {
    log(`failed to respond to button: ${error.message}`);
    return;
  }

  try {
    const user = interaction.member && interaction.member.user ? interaction.member.user : interaction.user;
    if (!user) throw new Error('Ticket user not found.');

    const channel = await createTicket(interaction, label);
    let dmSent = false;
    try {
      await sendDirectMessage(
        user.id,
        `Your **${label}** ticket has been opened successfully. Staff will be with you shortly.`,
      );
      dmSent = true;
    } catch (error) {
      log(`ticket created but DM failed for ${user.id}: ${error.message}`);
    }

    await editOriginal(
      interaction,
      dmSent
        ? 'Ticket opened. Check your DMs for the confirmation.'
        : `Ticket opened: <#${channel.id}>`,
    );
    log(`ticket ${channel.name} created (${label})`);
  } catch (error) {
    log(`failed to create ticket: ${error.message}`);
    try {
      await editOriginal(interaction, 'Could not open the ticket right now. Try again or contact staff.');
    } catch {}
  }
}

function send(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function startHeartbeat(interval) {
  clearInterval(heartbeat);
  heartbeat = setInterval(() => send({ op: 1, d: sequence }), interval);
}

function identify() {
  send({
    op: 2,
    d: {
      token,
      intents: (1 << 0) | (1 << 1) | (1 << 2),
      properties: { os: process.platform, browser: 'nyx-optmizer', device: 'nyx-optmizer' },
      presence: { status: 'online', activities: [{ name: 'NyxOperator', type: 0 }], since: null, afk: false },
    },
  });
}

function connect() {
  clearTimeout(reconnectTimer);
  socket = new WebSocket(gatewayUrl);

  socket.addEventListener('open', () => log('gateway connected'));

  socket.addEventListener('message', (event) => {
    let packet;
    try { packet = JSON.parse(event.data); } catch { return; }
    if (packet.s !== null && packet.s !== undefined) sequence = packet.s;

    if (packet.op === 10) {
      startHeartbeat(packet.d.heartbeat_interval);
      identify();
      return;
    }

    if (packet.op === 1) {
      send({ op: 1, d: sequence });
      return;
    }

    if (packet.op === 0 && packet.t === 'READY') {
      log(`online as ${packet.d.user.username} (${packet.d.user.id})`);
      return;
    }

    if (packet.op === 0 && packet.t === 'GUILD_MEMBER_ADD') {
      if (packet.d.guild_id === guildId) onMemberAdd(packet.d);
      return;
    }

    if (packet.op === 0 && packet.t === 'GUILD_MEMBER_REMOVE') {
      if (packet.d.guild_id === guildId) onMemberRemove(packet.d);
      return;
    }

    if (packet.op === 0 && packet.t === 'GUILD_BAN_ADD') {
      if (packet.d.guild_id === guildId) onGuildBan(packet.d, 'banned');
      return;
    }

    if (packet.op === 0 && packet.t === 'GUILD_BAN_REMOVE') {
      if (packet.d.guild_id === guildId) onGuildBan(packet.d, 'unbanned');
      return;
    }

    if (packet.op === 0 && packet.t === 'INTERACTION_CREATE') {
      onInteraction(packet.d);
    }
  });

  socket.addEventListener('close', (event) => {
    clearInterval(heartbeat);
    heartbeat = null;
    log(`gateway closed (${event.code}${event.reason ? `: ${event.reason}` : ''})`);
    if (event.code === 4014) {
      log('Server Members Intent is disabled. Enable it in Developer Portal -> Bot -> Privileged Gateway Intents.');
      process.exitCode = 1;
      return;
    }
    if (event.code === 4004) {
      log('Invalid or revoked token.');
      process.exitCode = 1;
      return;
    }
    reconnectTimer = setTimeout(connect, 5000);
  });

  socket.addEventListener('error', () => {
    /* o evento close trata da reconexao */
  });
}

process.on('SIGINT', () => {
  clearInterval(heartbeat);
  clearTimeout(reconnectTimer);
  if (socket) socket.close();
  process.exit(0);
});

connect();
