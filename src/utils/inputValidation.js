const { DEEPL_LANGUAGES } = require('./languages');

const LANGUAGE_CODES = new Set(DEEPL_LANGUAGES.map(([code]) => code));
// eslint-disable-next-line no-control-regex -- this intentionally matches unsafe input controls.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

function sanitizeText(value, { maxLength = 2000, minLength = 1 } = {}) {
  if (typeof value !== 'string') return null;
  const sanitized = value.replace(CONTROL_CHARACTERS, '').trim();
  if (sanitized.length < minLength || sanitized.length > maxLength) return null;
  return sanitized;
}

function normalizeLanguageCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return LANGUAGE_CODES.has(code) ? code : null;
}

function isSnowflake(value) {
  return typeof value === 'string' && /^\d{17,20}$/.test(value);
}

module.exports = { sanitizeText, normalizeLanguageCode, isSnowflake };
