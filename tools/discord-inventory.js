'use strict';

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
const api = 'https://discord.com/api/v10';
const headers = { Authorization: `Bot ${token}`, 'User-Agent': 'NyxRestructure/1.0' };

async function get(endpoint) {
  const res = await fetch(`${api}${endpoint}`, { headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${endpoint} -> ${res.status}: ${data && data.message ? data.message : data}`);
  return data;
}

(async () => {
  const [guild, roles, channels] = await Promise.all([
    get(`/guilds/${guildId}`),
    get(`/guilds/${guildId}/roles`),
    get(`/guilds/${guildId}/channels`),
  ]);
  const backup = {
    savedAt: new Date().toISOString(),
    guild: { id: guild.id, name: guild.name, owner_id: guild.owner_id, system_channel_id: guild.system_channel_id },
    roles,
    channels,
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, `discord-backup-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  console.log(JSON.stringify({
    backupPath,
    guild: { name: guild.name, id: guild.id },
    roles: roles.map((role) => ({ id: role.id, name: role.name, position: role.position, managed: role.managed })),
    channels: channels.map((channel) => ({ id: channel.id, name: channel.name, type: channel.type, parent_id: channel.parent_id || null })),
  }, null, 2));
})();
