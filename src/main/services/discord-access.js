'use strict';

/**
 * Regras puras de acesso beta por Discord.
 * Sem Electron: pode ser testado directamente com Node.
 */

const fs = require('fs');

const DEFAULT_MAX_AGE_DAYS = 7;

/** IDs do Discord sao snowflakes numericos (15 a 22 digitos). */
function normalizeId(value) {
  return String(value == null ? '' : value).replace(/[^0-9]/g, '').slice(0, 22);
}

function validId(value) {
  const id = normalizeId(value);
  return id.length >= 15 && id.length <= 22;
}

function hasRole(member, roleId) {
  return Boolean(member && Array.isArray(member.roles) && roleId && member.roles.includes(normalizeId(roleId)));
}

/** Resultado da verificacao de um membro do servidor. */
function evaluateMember(member, roleId) {
  if (!member || !Array.isArray(member.roles)) return { active: false, reason: 'not-member' };
  if (!roleId) return { active: false, reason: 'not-configured' };
  return hasRole(member, roleId)
    ? { active: true, reason: 'role' }
    : { active: false, reason: 'no-role' };
}

function isFresh(iso, maxAgeDays = DEFAULT_MAX_AGE_DAYS) {
  const time = Date.parse(iso || '');
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= maxAgeDays * 86400000;
}

function readCommunity(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { guildId: normalizeId(parsed.guildId), roleId: normalizeId(parsed.roleId) };
  } catch {
    return { guildId: '', roleId: '' };
  }
}

/**
 * Combina a politica local (definida pelo Owner na app) com a do build
 * (community.json). A local ganha quando existe.
 */
function resolveAccess(local, defaults) {
  const localGuild = normalizeId(local && local.guildId);
  const localRole = normalizeId(local && local.roleId);
  const guildId = localGuild || normalizeId(defaults && defaults.guildId);
  const roleId = localRole || normalizeId(defaults && defaults.roleId);
  return {
    guildId,
    roleId,
    configured: Boolean(guildId && roleId),
    source: localGuild ? 'local' : defaults && defaults.guildId ? 'build' : 'none',
  };
}

module.exports = {
  DEFAULT_MAX_AGE_DAYS,
  normalizeId,
  validId,
  hasRole,
  evaluateMember,
  isFresh,
  readCommunity,
  resolveAccess,
};
