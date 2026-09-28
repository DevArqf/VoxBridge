const test = require('node:test');
const assert = require('node:assert/strict');
const { languageLabel } = require('../src/utils/languageLabels');

test('language labels use standard Unicode flag emoji', () => {
  assert.equal(languageLabel('ES'), '\u{1F1EA}\u{1F1F8} Spanish');
  assert.equal(languageLabel('EN'), '\u{1F1EC}\u{1F1E7} English');
});

test('regional language labels remain distinguishable and unknown codes get globe fallback', () => {
  assert.equal(languageLabel('EN-US'), '\u{1F1FA}\u{1F1F8} English (US)');
  assert.equal(languageLabel('xx'), '\u{1F310} XX');
});
