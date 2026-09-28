const axios = require('axios');
const { performance } = require('node:perf_hooks');
const config = require('../config');
const { withExternalError } = require('./errors');
const { AppError } = require('./errors');
const { normalizeLanguageCode, sanitizeText } = require('./inputValidation');
const { TARGET_LANGUAGE_CODES } = require('./languages');

const GAMING_SLANG_REPLACEMENTS = [
  {
    pattern: /\bGG([\s,!.:-]*)jugaron\s+(?:(muy|súper|super)\s+)?bien\b/giu,
    replace: (_match, separator, intensifier) => `GG${separator}you all played ${intensifier ? 'very ' : ''}well`,
  },
  {
    pattern: /\bnos\s+est[aá]n\s+rusheando\b/giu,
    replace: (match) => `${match[0][0] === match[0][0].toUpperCase() ? 'T' : 't'}hey are rushing us`,
  },
  { pattern: /\brusheando\b/giu, replace: 'rushing' },
];

function preprocessGamingSlang(text, customSlang = []) {
  const withBuiltIns = GAMING_SLANG_REPLACEMENTS.reduce(
    (processed, rule) => processed.replace(rule.pattern, rule.replace),
    text,
  );
  return customSlang.reduce((processed, rule) => {
    const original = sanitizeText(rule.original_term, { maxLength: 100 });
    const replacement = sanitizeText(rule.replacement_term, { maxLength: 200 });
    if (!original || !replacement) return processed;
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return processed.replace(new RegExp(escaped, 'giu'), () => replacement);
  }, withBuiltIns);
}

const GAMING_CHAT_CONTEXT = [
  'This is informal multiplayer video-game chat between teammates.',
  'Keep gamer slang in its gaming sense (for example, “rush/rushear” means quickly attacking or pushing an opponent, not cutting in line).',
  'When a short conversational message addresses the recipients and Spanish omits its subject, prefer “you” or “you all” rather than “they”, unless the text explicitly indicates a third party.',
].join(' ');

function translationCharacterCount(text, customSlang = []) {
  const safeText = sanitizeText(text, { maxLength: 2000 });
  if (!safeText) return 0;
  return Array.from(preprocessGamingSlang(safeText, customSlang)).length;
}

function apiBaseUrl() {
  return config.DEEPL_AUTH_KEY.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2'
    : 'https://api.deepl.com/v2';
}

async function translate(text, sourceLang, customSlang = [], targetLang = config.TARGET_VOICE_LANG) {
  const safeText = sanitizeText(text, { maxLength: 2000 });
  if (!safeText) throw new AppError('INVALID_INPUT', 'That message is empty or exceeds the supported length.');
  const normalizedSourceLang = sourceLang ? normalizeLanguageCode(sourceLang) : null;
  if (sourceLang && !normalizedSourceLang) {
    throw new AppError('INVALID_INPUT', 'Choose a supported source language or leave automatic detection enabled.');
  }
  const normalizedTargetLang = typeof targetLang === 'string' ? targetLang.trim().toUpperCase() : '';
  if (!TARGET_LANGUAGE_CODES.has(normalizedTargetLang)) {
    throw new AppError('INVALID_INPUT', 'Choose a supported target language.');
  }
  const base = `${apiBaseUrl()}/translate`;
  const body = {
    text: preprocessGamingSlang(safeText, customSlang),
    target_lang: normalizedTargetLang,
    context: GAMING_CHAT_CONTEXT,
    formality: 'prefer_less',
  };
  if (normalizedSourceLang) body.source_lang = normalizedSourceLang;

  return withExternalError('DeepL translation', async () => {
    const response = await axios.post(base, new URLSearchParams(body).toString(), {
      headers: {
        Authorization: `DeepL-Auth-Key ${config.DEEPL_AUTH_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 15_000,
    });
    const result = response.data?.translations?.[0]?.text;
    if (!result) throw new Error('DeepL returned no translated text.');
    return result;
  });
}

async function checkTranslationApi() {
  const startedAt = performance.now();
  return withExternalError('DeepL health check', async () => {
    await axios.get(`${apiBaseUrl()}/usage`, {
      headers: { Authorization: `DeepL-Auth-Key ${config.DEEPL_AUTH_KEY}` },
      timeout: 10_000,
    });
    return Math.round(performance.now() - startedAt);
  });
}

module.exports = {
  translate,
  checkTranslationApi,
  translationCharacterCount,
  preprocessGamingSlang,
  GAMING_SLANG_REPLACEMENTS,
  GAMING_CHAT_CONTEXT,
};
