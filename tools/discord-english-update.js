'use strict';

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, 'discord-bot.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (match && process.env[match[1]] === undefined) {
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const apiBase = 'https://discord.com/api/v10';
const headers = { Authorization: `Bot ${token}`, 'User-Agent': 'NyxEnglish/1.0' };
const failures = [];

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
        'X-Audit-Log-Reason': 'Nyx: English localization and black/white icon',
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
    if (!res.ok) throw new Error(`${method} ${endpoint} -> ${res.status}: ${data && data.message ? data.message : data}`);
    return data;
  }
  throw new Error(`${method} ${endpoint}: rate limit`);
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

async function main() {
  const me = await api('GET', '/users/@me');
  const roles = await api('GET', `/guilds/${guildId}/roles`);
  const channels = await api('GET', `/guilds/${guildId}/channels`);

  const channelRenames = {
    '📢・INFORMAÇÕES': '📢・INFORMATION',
    '💬・COMUNIDADE': '💬・COMMUNITY',
    '🔊・VOZ': '🔊・VOICE',
    '🎫・SUPORTE': '🎫・SUPPORT',
    '📜・regras': '📜・rules',
    '📢・anúncios': '📢・announcements',
    '🎉・novidades': '🎉・news',
    '👋・boas-vindas': '👋・welcome',
    '✅・verificação': '✅・verify',
    '💬・geral': '💬・general',
    '🎮・jogos': '🎮・games',
    '🔊・Geral': '🔊・General',
    '🔊・Jogos': '🔊・Games',
    '🚨・denúncias': '🚨・reports',
  };

  console.log('\n--- Renaming channels ---');
  for (const channel of channels) {
    const nextName = channelRenames[channel.name];
    if (!nextName) continue;
    await attempt(`rename #${channel.name} -> #${nextName}`, () => api('PATCH', `/channels/${channel.id}`, { name: nextName }));
  }

  const roleRenames = {
    '🐣 Novato': '🐣 Newbie',
    '🌱 Membro': '🌱 Member',
    '🔨 Moderador': '🔨 Moderator',
    'Santos Otimizator': 'NyxOperator',
  };

  console.log('\n--- Renaming roles ---');
  for (const role of roles) {
    const nextName = roleRenames[role.name];
    if (!nextName) continue;
    await attempt(`rename role ${role.name} -> ${nextName}`, () => api('PATCH', `/guilds/${guildId}/roles/${role.id}`, { name: nextName }));
  }

  console.log('\n--- Bot identity ---');
  await attempt('set bot nickname to NyxOperator', () => api('PATCH', `/guilds/${guildId}/members/${me.id}`, { nick: 'NyxOperator' }));
  await attempt('set global bot username to NyxOperator', () => api('PATCH', '/users/@me', { username: 'NyxOperator' }));

  console.log('\n--- Server icon ---');
  const iconPath = path.join(__dirname, '..', 'assets', 'nyxoperator-server-icon.png');
  if (fs.existsSync(iconPath)) {
    const icon = fs.readFileSync(iconPath).toString('base64');
    await attempt('upload black/white server icon', () => api('PATCH', `/guilds/${guildId}`, { icon: `data:image/png;base64,${icon}` }));
  } else {
    failures.push(`icon not found: ${iconPath}`);
    console.log(`FAIL icon not found: ${iconPath}`);
  }

  const freshChannels = await api('GET', `/guilds/${guildId}/channels`);
  const find = (name) => freshChannels.find((channel) => channel.name === name);
  const targetChannels = {
    rules: find('📜・rules'),
    welcome: find('👋・welcome'),
    announcements: find('📢・announcements'),
    news: find('🎉・news'),
    verify: find('✅・verify'),
    tickets: find('🎫・tickets'),
    general: find('💬・general'),
  };

  console.log('\n--- Replacing bot messages with English ---');
  for (const [key, channel] of Object.entries(targetChannels)) {
    if (!channel) {
      failures.push(`message target ${key}: channel not found`);
      continue;
    }
    const messages = await attempt(`read messages in #${channel.name}`, () => api('GET', `/channels/${channel.id}/messages?limit=50`));
    if (Array.isArray(messages)) {
      for (const message of messages.filter((item) => item.author && item.author.id === me.id)) {
        await attempt(`delete old bot message in #${channel.name}`, () => api('DELETE', `/channels/${channel.id}/messages/${message.id}`));
      }
    }
  }

  const send = (key, payload) => {
    const channel = targetChannels[key];
    if (!channel) return null;
    return attempt(`post English ${key}`, () => api('POST', `/channels/${channel.id}/messages`, {
      allowed_mentions: { parse: [] },
      ...payload,
    }));
  };

  await send('rules', {
    embeds: [{
      title: '📜 Server Rules',
      description: 'Welcome to the community. To keep this server clean, safe and professional, follow these rules.',
      color: 0x2ECC71,
      fields: [
        { name: '1. Respect', value: 'Treat every member with respect. Harassment, discrimination, insults and provocation are not allowed.' },
        { name: '2. Spam and advertising', value: 'No spam, flooding, affiliate links or unauthorized advertising.' },
        { name: '3. Prohibited content', value: 'Do not share cheats, malware, cracks, pirated content or illegal material.' },
        { name: '4. Correct channels', value: 'Use each channel for its intended topic. Support requests belong in the ticket system.' },
        { name: '5. Staff', value: 'Follow staff instructions. Do not open fake tickets or create unnecessary conflict.' },
        { name: '6. Privacy', value: 'Do not share your personal data or anyone else’s without permission.' },
      ],
      footer: { text: 'By staying in this server, you automatically accept these rules.' },
      timestamp: new Date().toISOString(),
    }],
  });

  await send('welcome', {
    content: '👋 **Welcome to NyxOptimizator!**',
    embeds: [{
      title: 'Start here',
      description: 'This is the community entrance. Read the rules, verify your account and introduce yourself.',
      color: 0x3498DB,
      fields: [
        { name: '📜 Rules', value: targetChannels.rules ? `<#${targetChannels.rules.id}>` : 'Rules channel' },
        { name: '✅ Verification', value: targetChannels.verify ? `<#${targetChannels.verify.id}>` : 'Verification channel' },
        { name: '🎫 Support', value: targetChannels.tickets ? `<#${targetChannels.tickets.id}>` : 'Ticket channel' },
      ],
      footer: { text: 'NyxOptimizator · community' },
      timestamp: new Date().toISOString(),
    }],
  });

  await send('announcements', {
    embeds: [{
      title: '📢 Server restructured',
      description: 'The server has been reorganized to be cleaner, safer and easier to navigate. Read the rules and verify your account to access the community.',
      color: 0xF1C40F,
      footer: { text: 'NyxOptimizator' },
      timestamp: new Date().toISOString(),
    }],
  });

  await send('news', {
    embeds: [{
      title: '🎉 News',
      description: 'This channel is now used for news, improvements and new NyxOptimizator features.',
      color: 0xE91E63,
      footer: { text: 'NyxOptimizator' },
      timestamp: new Date().toISOString(),
    }],
  });

  await send('verify', {
    content: '✅ **Member verification**',
    embeds: [{
      title: 'Verify your account',
      description: 'Click the button below to confirm that you have read the rules and unlock access to the community.',
      color: 0x2ECC71,
      footer: { text: 'NyxOptimizator · verification' },
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

  await send('general', {
    content: '💬 **General** — introduce yourself, talk with the community and keep the vibe positive.',
  });

  console.log('\n--- SUMMARY ---');
  console.log(JSON.stringify({ failures }, null, 2));
  if (failures.length) console.log(`${failures.length} operation(s) failed.`);
  else console.log('All English updates completed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
