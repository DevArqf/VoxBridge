const test = require('node:test');
const assert = require('node:assert/strict');
const { voiceMatchesLanguage } = require('../src/utils/ttsVoices');

test('voice matching respects the server target language and regional language codes', () => {
  assert.equal(voiceMatchesLanguage({ Locale: 'en-US' }, 'EN'), true);
  assert.equal(voiceMatchesLanguage({ Locale: 'en-GB' }, 'EN-US'), true);
  assert.equal(voiceMatchesLanguage({ Locale: 'es-ES' }, 'ES'), true);
  assert.equal(voiceMatchesLanguage({ Locale: 'af-ZA' }, 'EN'), false);
  assert.equal(voiceMatchesLanguage({ Locale: 'ar-MA' }, 'EN'), false);
});
