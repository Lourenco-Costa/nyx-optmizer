'use strict';

/**
 * Licenciamento offline.
 *
 * Chaves com validade: OTZ-<PLANO>-<DATA>-<RAND>-<CHK>
 *   DATA -> dias desde 2025-01-01 em base36 (4 caracteres)
 *   RAND -> bloco aleatorio
 *   CHK  -> assinatura derivada do plano, da data e do bloco aleatorio
 *
 * As chaves antigas (sem data) continuam a validar e sao permanentes.
 * Tudo e verificado localmente com um segredo embutido: sem servidor.
 *
 * Estado guardado em <userData>/license.json (trial + chave ativada).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { app } = require('electron');

const SECRET = 'otz-santos-2026::sku::v1';
const SECRET_TIMED = 'otz-santos-2026::sku::v2::timed';
const SECRET_SINGLE = 'otz-santos-2026::sku::v3::single';
const SECRET_TIMED_SINGLE = 'otz-santos-2026::sku::v4::single::timed';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BASE36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const TRIAL_DAYS = 7;
const PLANS = { PRO: 'Pro', ELITE: 'Elite', OWNER: 'Owner', BETA: 'Beta', STAFF: 'Staff' };
const BETA_PLANS = new Set(['OWNER', 'BETA', 'STAFF']);
const DAY = 86400000;
const EPOCH = Date.UTC(2025, 0, 1);
const MAX_EXPIRY_DAYS = 7300;

let statePath = null;

function file() {
  if (!statePath) statePath = path.join(app.getPath('userData'), 'license.json');
  return statePath;
}

function machineId() {
  const seed = [os.hostname(), os.platform(), os.arch(), os.cpus()[0]?.model || '', process.env.USERNAME || ''].join('|');
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16).toUpperCase();
}

function readState() {
  try {
    const raw = fs.readFileSync(file(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.firstRun) throw new Error('estado invalido');
    if (!Array.isArray(parsed.usedKeys)) parsed.usedKeys = [];
    return parsed;
  } catch {
    const fresh = { firstRun: new Date().toISOString(), key: null, activatedAt: null, usedKeys: [] };
    try {
      fs.mkdirSync(path.dirname(file()), { recursive: true });
      fs.writeFileSync(file(), JSON.stringify(fresh, null, 2));
    } catch {
      /* sem permissao de escrita: trial continua a funcionar em memoria */
    }
    return fresh;
  }
}

function writeState(state) {
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(state, null, 2));
    return true;
  } catch {
    return false;
  }
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

/** Converte uma data para o bloco de validade usado nas chaves. */
function encodeExpiry(date) {
  const day = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - EPOCH) / DAY);
  return base36(day);
}

/** Ultimo instante valido do bloco de validade (ISO). */
function decodeExpiry(token) {
  const days = parseInt(token, 36);
  if (!Number.isFinite(days) || days < 0 || days > MAX_EXPIRY_DAYS) return null;
  return new Date(EPOCH + days * DAY + DAY - 1).toISOString();
}

function checksum(plan, b1, b2) {
  const digest = crypto.createHash('sha256').update(`${SECRET}|${plan}|${b1}|${b2}`).digest();
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHABET[digest[i] % ALPHABET.length];
  return out;
}

function checksumTimed(plan, exp, rand) {
  const digest = crypto.createHash('sha256').update(`${SECRET_TIMED}|${plan}|${exp}|${rand}`).digest();
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHABET[digest[i] % ALPHABET.length];
  return out;
}

function checksumSingle(plan, b1, b2) {
  const digest = crypto.createHash('sha256').update(`${SECRET_SINGLE}|${plan}|${b1}|${b2}`).digest();
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

function normalize(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '');
}

function dateLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Valida uma chave.
 * Devolve { valid, plan, key, expiresAt, perpetual, reason }.
 */
function validateKey(input) {
  const key = normalize(input);
  const match = key.match(/^OTZ-(OWNER|BETA|PRO|ELITE|STAFF)-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/);
  if (!match) {
    return { valid: false, reason: 'Formato invalido. Usa OTZ-PLANO-XXXX-XXXX-XXXX (PRO, ELITE, STAFF, OWNER ou BETA).' };
  }

  const [, plan, first, second, chk] = match;

  /* As chaves de uso unico usam um dominio de assinatura proprio. */
  if (checksumTimedSingle(plan, first, second) === chk) {
    const expiresAt = decodeExpiry(first);
    if (!expiresAt) return { valid: false, reason: 'Chave com data de validade invalida.' };
    return { valid: true, plan, key, expiresAt, perpetual: false, singleUse: true };
  }

  if (checksumSingle(plan, first, second) === chk) {
    return { valid: true, plan, key, expiresAt: null, perpetual: true, singleUse: true };
  }

  if (checksumTimed(plan, first, second) === chk) {
    const expiresAt = decodeExpiry(first);
    if (!expiresAt) return { valid: false, reason: 'Chave com data de validade invalida.' };
    return { valid: true, plan, key, expiresAt, perpetual: false, singleUse: false };
  }

  if (checksum(plan, first, second) === chk) {
    return { valid: true, plan, key, expiresAt: null, perpetual: true, singleUse: false };
  }

  return { valid: false, reason: 'Chave invalida. Verifica os caracteres.' };
}

function daysLeft(firstRunIso) {
  const start = new Date(firstRunIso).getTime();
  if (!Number.isFinite(start)) return 0;
  const elapsed = (Date.now() - start) / 86400000;
  return Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
}

function status() {
  const state = readState();
  const trialDaysLeft = daysLeft(state.firstRun);
  let plan = null;
  let key = null;
  let expiresAt = null;
  let perpetual = false;
  let singleUse = false;
  let expired = null;

  if (state.key) {
    const check = validateKey(state.key);
    if (check.valid) {
      if (check.expiresAt && Date.now() > Date.parse(check.expiresAt)) {
        expired = { plan: check.plan, planLabel: PLANS[check.plan], expiresAt: check.expiresAt };
      } else {
        plan = check.plan;
        key = maskKey(check.key);
        expiresAt = check.expiresAt;
        perpetual = check.perpetual;
        singleUse = Boolean(check.singleUse);
      }
    }
  }

  const licensed = plan !== null;
  const trialActive = !licensed && trialDaysLeft > 0;
  const beta = plan ? BETA_PLANS.has(plan) : false;
  const today = Math.floor(Date.now() / DAY);
  const expiryDay = expiresAt ? Math.floor(Date.parse(expiresAt) / DAY) : null;
  const activatedDay = state.activatedAt ? Math.floor(new Date(state.activatedAt).getTime() / DAY) : null;
  const licenseDaysLeft = expiryDay !== null ? Math.max(0, expiryDay - today) : null;
  const durationDays = expiryDay !== null && activatedDay !== null ? Math.max(1, expiryDay - activatedDay) : null;

  return {
    licensed,
    plan,
    planLabel: plan ? PLANS[plan] : null,
    beta,
    owner: plan === 'OWNER',
    canUseBeta: beta,
    key,
    expiresAt,
    perpetual,
    singleUse,
    daysLeft: licenseDaysLeft,
    durationDays,
    expired,
    trial: {
      active: trialActive,
      daysLeft: trialDaysLeft,
      totalDays: TRIAL_DAYS,
      endsAt: new Date(new Date(state.firstRun).getTime() + TRIAL_DAYS * 86400000).toISOString(),
    },
    activatedAt: state.activatedAt,
    machineId: machineId(),
    canUsePremium: licensed || trialActive,
    storePath: file(),
  };
}

function maskKey(key) {
  const parts = key.split('-');
  if (parts.length !== 5) return key;
  return `${parts[0]}-${parts[1]}-${parts[2]}-****-${parts[4]}`;
}

function activate(input) {
  const check = validateKey(input);
  if (!check.valid) return { ok: false, message: check.reason };

  if (check.expiresAt && Date.now() > Date.parse(check.expiresAt)) {
    return {
      ok: false,
      message: `Esta chave expirou em ${dateLabel(check.expiresAt)}. Pede uma chave nova ao Santos.`,
    };
  }

  const state = readState();
  const usedKeys = Array.isArray(state.usedKeys) ? state.usedKeys.slice() : [];
  const fingerprint = crypto.createHash('sha256').update(check.key).digest('hex').slice(0, 24);

  if (check.singleUse && usedKeys.includes(fingerprint) && state.key !== check.key) {
    return {
      ok: false,
      message: 'Esta chave de uso unico ja foi ativada. Pede uma chave nova ao Santos.',
    };
  }

  state.key = check.key;
  state.activatedAt = new Date().toISOString();
  if (check.singleUse && !usedKeys.includes(fingerprint)) usedKeys.push(fingerprint);
  state.usedKeys = usedKeys;
  if (!writeState(state)) {
    return { ok: false, message: 'Nao foi possivel guardar a licenca (sem permissao de escrita).' };
  }

  const extra =
    check.plan === 'OWNER'
      ? ' Acesso Owner total, incluindo o laboratorio beta.'
      : check.plan === 'STAFF'
        ? ' Acesso Staff total, incluindo funcoes experimentais.'
        : check.plan === 'BETA'
          ? ' Laboratorio beta desbloqueado.'
          : '';
  const validity = check.expiresAt ? ` Valida ate ${dateLabel(check.expiresAt)}.` : ' Chave permanente.';
  const singleUse = check.singleUse ? ' Chave de uso unico: ativada neste PC.' : '';

  return {
    ok: true,
    message: `Licenca ${PLANS[check.plan]} ativada.${extra}${validity}${singleUse}`,
    status: status(),
  };
}

function deactivate() {
  const state = readState();
  state.key = null;
  state.activatedAt = null;
  writeState(state);
  return status();
}

module.exports = {
  status,
  activate,
  deactivate,
  validateKey,
  checksum,
  checksumTimed,
  encodeExpiry,
  decodeExpiry,
  dateLabel,
  ALPHABET,
  TRIAL_DAYS,
};
