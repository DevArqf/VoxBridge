const DEEPL_LANGUAGES = [
  ['BG', 'Bulgarian'], ['CS', 'Czech'], ['DA', 'Danish'], ['DE', 'German'],
  ['EL', 'Greek'], ['EN', 'English'], ['ES', 'Spanish'], ['ET', 'Estonian'],
  ['FI', 'Finnish'], ['FR', 'French'], ['HU', 'Hungarian'], ['ID', 'Indonesian'],
  ['IT', 'Italian'], ['JA', 'Japanese'], ['KO', 'Korean'], ['LT', 'Lithuanian'],
  ['LV', 'Latvian'], ['NB', 'Norwegian Bokmål'], ['NL', 'Dutch'], ['PL', 'Polish'],
  ['PT', 'Portuguese'], ['RO', 'Romanian'], ['RU', 'Russian'], ['SK', 'Slovak'],
  ['UK', 'Ukrainian'],
];

const TARGET_LANGUAGE_CODES = new Set([
  ...DEEPL_LANGUAGES.map(([code]) => code),
  'EN-GB',
  'EN-US',
  'PT-BR',
  'PT-PT',
  'ZH-HANS',
]);

module.exports = { DEEPL_LANGUAGES, TARGET_LANGUAGE_CODES };
