const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isSnowflake,
  normalizeLanguageCode,
  sanitizeText,
} = require('../src/utils/inputValidation');

test('sanitizeText strips control characters and enforces length bounds', () => {
  assert.equal(sanitizeText(' hello\u0000 world '), 'hello world');
  assert.equal(sanitizeText(''), null);
  assert.equal(sanitizeText('too long', { maxLength: 4 }), null);
});

test('language and Discord ID validators reject malformed inputs', () => {
  assert.equal(normalizeLanguageCode('es'), 'ES');
  assert.equal(normalizeLanguageCode('not-a-language'), null);
  assert.equal(isSnowflake('123456789012345678'), true);
  assert.equal(isSnowflake('not-an-id'), false);
});
