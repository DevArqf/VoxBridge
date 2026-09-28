const { DEEPL_LANGUAGES } = require('./languages');

const LANGUAGE_NAMES = new Map(DEEPL_LANGUAGES);
const flag = (letters) => [...letters].map((letter) =>
  String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join('');
const FLAGS = Object.freeze(Object.fromEntries(Object.entries({
  BG: 'BG', CS: 'CZ', DA: 'DK', DE: 'DE', EL: 'GR', EN: 'GB', 'EN-GB': 'GB',
  'EN-US': 'US', ES: 'ES', ET: 'EE', FI: 'FI', FR: 'FR', HU: 'HU', ID: 'ID',
  IT: 'IT', JA: 'JP', KO: 'KR', LT: 'LT', LV: 'LV', NB: 'NO', NL: 'NL',
  PL: 'PL', PT: 'PT', 'PT-PT': 'PT', 'PT-BR': 'BR', RO: 'RO', RU: 'RU',
  SK: 'SK', UK: 'UA', 'ZH-HANS': 'CN',
}).map(([code, country]) => [code, flag(country)])));

const SPECIAL_NAMES = Object.freeze({
  'EN-GB': 'English (UK)',
  'EN-US': 'English (US)',
  'PT-BR': 'Portuguese (Brazil)',
  'PT-PT': 'Portuguese (Portugal)',
  'ZH-HANS': 'Simplified Chinese',
});

function languageLabel(code, { includeCode = false } = {}) {
  const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
  const name = SPECIAL_NAMES[normalized] || LANGUAGE_NAMES.get(normalized) || normalized || 'Unknown language';
  const emoji = FLAGS[normalized] || '\u{1F310}';
  return `${emoji} ${name}${includeCode && normalized ? ` (${normalized})` : ''}`;
}

module.exports = { languageLabel, LANGUAGE_FLAGS: FLAGS };
