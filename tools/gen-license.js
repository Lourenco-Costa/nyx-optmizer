#!/usr/bin/env node
'use strict';

/**
 * Gerador de chaves e registo de licencas emitidas (uso exclusivo do proprietario).
 *
 * IMPORTANTE: o segredo, o alfabeto e o esquema de datas tem de coincidir com
 * src/main/services/license.js — caso contrario as chaves nao validam.
 *
 * Uso:
 *   node tools/gen-license.js                          -> 3 chaves PRO de 365 dias
 *   node tools/gen-license.js 5 ELITE 180              -> 5 chaves ELITE de 180 dias
 *   node tools/gen-license.js 1 OWNER 365 --name "Santos"
 *   node tools/gen-license.js 3 BETA 90 --name "Tester"
 *   node tools/gen-license.js 1 STAFF --perpetual --name "Staff"  -> chave Staff permanente
 *   node tools/gen-license.js 10 STAFF --perpetual --single-use --name "Staff beta"
 *   node tools/gen-license.js --list                   -> registo das chaves emitidas
 *   node tools/gen-license.js --revoke OTZ-...         -> marca a chave como revogada
 *
 * O registo fica em tools/licenses-issued.json. Nota: a validacao e offline,
 * por isso revogar serve para controlo interno — a chave continua a funcionar
 * num PC onde ja esteja ativada.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET = 'otz-santos-2026::sku::v1';
const SECRET_TIMED = 'otz-santos-2026::sku::v2::timed';
const SECRET_SINGLE = 'otz-santos-2026::sku::v3::single';
const SECRET_TIMED_SINGLE = 'otz-santos-2026::sku::v4::single::timed';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BASE36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DAY = 86400000;
const EPOCH = Date.UTC(2025, 0, 1);
const REGISTRY = path.join(__dirname, 'licenses-issued.json');
const PLANS = ['PRO', 'ELITE', 'OWNER', 'BETA', 'STAFF'];

function block(size) {
  const bytes = crypto.randomBytes(size);
  let out = '';
  for (let i = 0; i < size; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function base36(value) {
  let n = Math.max(0, Math.floor(value));
  let out = '';
  do {
    out = BASE36[n % 36] + out;
    n = Math.floor(n / 36);
  } while (n > 0);
  return out.padStart(4, '0').slice(-4);
}

function expiryToken(date) {
  return base36(Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - EPOCH) / DAY));
}

function checksumTimed(plan, exp, rand) {
  const digest = crypto.createHash('sha256').update(`${SECRET_TIMED}|${plan}|${exp}|${rand}`).digest();
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHABET[digest[i] % ALPHABET.length];
  return out;
}

function checksumPerpetual(plan, first, second) {
  const digest = crypto.createHash('sha256').update(`${SECRET}|${plan}|${first}|${second}`).digest();
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHABET[digest[i] % ALPHABET.length];
  return out;
}

function checksumSingle(plan, first, second) {
  const digest = crypto.createHash('sha256').update(`${SECRET_SINGLE}|${plan}|${first}|${second}`).digest();
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHABET[digest[i] % ALPHABET.length];
  return out;
}

function checksumTimedSingle(plan, exp, rand) {
  const digest = crypto.createHash('sha256').update(`${SECRET_TIMED_SINGLE}|${plan}|${exp}|${rand}`).digest();
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHABET[digest[i] % ALPHABET.length];
  return out;
}

function makeKey(plan, days, perpetual = false, singleUse = false) {
  if (perpetual) {
    const first = block(4);
    const second = block(4);
    const chk = singleUse ? checksumSingle(plan, first, second) : checksumPerpetual(plan, first, second);
    return {
      key: `OTZ-${plan}-${first}-${second}-${chk}`,
      expiresAt: null,
    };
  }

  const expires = new Date(Date.now() + days * DAY);
  const token = expiryToken(expires);
  const rand = block(4);
  const chk = singleUse ? checksumTimedSingle(plan, token, rand) : checksumTimed(plan, token, rand);
  return { key: `OTZ-${plan}-${token}-${rand}-${chk}`, expiresAt: new Date(Date.UTC(expires.getUTCFullYear(), expires.getUTCMonth(), expires.getUTCDate())).toISOString() };
}

function readRegistry() {
  try {
    const parsed = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
    if (Array.isArray(parsed)) return { version: 1, entries: parsed };
    if (Array.isArray(parsed.entries)) return parsed;
    throw new Error('formato invalido');
  } catch {
    return { version: 1, entries: [] };
  }
}

function writeRegistry(registry) {
  fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2));
}

function list() {
  const { entries } = readRegistry();
  if (!entries.length) {
    console.log('Sem chaves registadas em tools/licenses-issued.json.');
    return;
  }
  const rows = entries.map((entry) => ({
    Plano: entry.plan,
    Expira: entry.expiresAt ? entry.expiresAt.slice(0, 10) : 'nunca',
    Nome: entry.name || '—',
    Uso: entry.singleUse ? '1 ativacao' : 'normal',
    Estado: entry.revokedAt ? 'revogada' : entry.expiresAt && new Date(entry.expiresAt) < new Date() ? 'expirada' : 'ativa',
    Chave: entry.key,
  }));
  console.table(rows);
  console.log(`Total: ${entries.length} chaves · registo em ${path.relative(process.cwd(), REGISTRY)}`);
}

function revoke(key) {
  const registry = readRegistry();
  const normalized = String(key || '').toUpperCase().trim();
  const entry = registry.entries.find((item) => item.key === normalized);
  if (!entry) {
    console.error('Chave nao encontrada no registo.');
    process.exit(1);
  }
  entry.revokedAt = new Date().toISOString();
  writeRegistry(registry);
  console.log(`Chave ${entry.key} marcada como revogada (${entry.name || 'sem nome'}).`);
}

const argv = process.argv.slice(2);
const flags = { list: false, revoke: null, name: '', perpetual: false, singleUse: false };
const positional = [];

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--list') flags.list = true;
  else if (arg === '--revoke') flags.revoke = argv[++i];
  else if (arg === '--name') flags.name = argv[++i] || '';
  else if (arg === '--perpetual') flags.perpetual = true;
  else if (arg === '--single-use') flags.singleUse = true;
  else positional.push(arg);
}

if (flags.list) {
  list();
  process.exit(0);
}

if (flags.revoke) {
  revoke(flags.revoke);
  process.exit(0);
}

const count = Math.max(1, Math.min(50, Number(positional[0]) || 3));
const plan = (positional[1] || 'PRO').toUpperCase();
const days = flags.perpetual ? null : Math.max(1, Math.min(3650, Number(positional[2]) || 365));

if (!PLANS.includes(plan)) {
  console.error('Plano invalido. Usa PRO, ELITE, OWNER, BETA ou STAFF.');
  process.exit(1);
}

const registry = readRegistry();
const issued = [];

for (let i = 0; i < count; i++) {
  const { key, expiresAt } = makeKey(plan, days, flags.perpetual, flags.singleUse);
  const entry = {
    key,
    plan,
    days,
    expiresAt,
    perpetual: Boolean(flags.perpetual),
    singleUse: Boolean(flags.singleUse),
    uses: flags.singleUse ? 1 : null,
    createdAt: new Date().toISOString(),
    name: flags.name || '',
    revokedAt: null,
  };
  registry.entries.push(entry);
  issued.push(entry);
}

writeRegistry(registry);

for (const entry of issued) {
  const validity = entry.expiresAt ? `valida ate ${entry.expiresAt.slice(0, 10)}` : 'permanente';
  const duration = entry.days ? `${entry.days} dias` : 'permanente';
  const usage = entry.singleUse ? ' · 1 ativacao' : '';
  console.log(`${entry.key}  (${entry.plan} · ${duration} · ${validity}${usage})`);
}

console.log(`\n${issued.length} chave(s) registada(s) em tools/licenses-issued.json.`);
if (flags.name) console.log(`Atribuidas a: ${flags.name}`);
