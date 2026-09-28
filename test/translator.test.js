process.env.DISCORD_TOKEN ||= 'test-discord-token-1234567890';
process.env.DISCORD_CLIENT_ID ||= '123456789012345678';
process.env.DEEPL_AUTH_KEY ||= 'test-deepl-key:fx';
process.env.TARGET_VOICE_LANG ||= 'EN';

const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const {
  preprocessGamingSlang,
  translate,
  translationCharacterCount,
} = require('../src/utils/translator');

test('gaming phrase replacements preserve intended meaning', () => {
  assert.equal(preprocessGamingSlang('GG, jugaron bien'), 'GG, you all played well');
  assert.equal(preprocessGamingSlang('nos están rusheando'), 'they are rushing us');
});

test('custom slang terms are treated literally and case-insensitively', () => {
  const result = preprocessGamingSlang('A.B is busted', [
    { original_term: 'a.b', replacement_term: 'overpowered' },
  ]);
  assert.equal(result, 'overpowered is busted');
});

test('translation request uses the user-selected target language', async () => {
  const originalPost = axios.post;
  let form;
  axios.post = async (_url, body) => {
    form = new URLSearchParams(body);
    return { data: { translations: [{ text: 'Bonjour' }] } };
  };
  try {
    assert.equal(await translate('Hello', null, [], 'FR'), 'Bonjour');
    assert.equal(form.get('target_lang'), 'FR');
  } finally {
    axios.post = originalPost;
  }
});

test('usage accounting counts the preprocessed DeepL input characters', () => {
  const text = 'nos están rusheando';
  assert.equal(translationCharacterCount(text), Array.from(preprocessGamingSlang(text)).length);
});
