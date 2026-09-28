process.env.DISCORD_TOKEN ||= 'test-discord-token-1234567890';
process.env.DISCORD_CLIENT_ID ||= '123456789012345678';
process.env.DEEPL_AUTH_KEY ||= 'test-deepl-key:fx';
process.env.TARGET_VOICE_LANG ||= 'EN';

const test = require('node:test');
const assert = require('node:assert/strict');
const { splitText } = require('../src/utils/audioQueue');

test('splitText keeps chunks within the TTS maximum and preserves text', () => {
  const input = `${'word '.repeat(70)}ending`;
  const chunks = splitText(input, 50);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 50));
  assert.equal(chunks.join(' '), input.trim());
});

test('splitText handles a single oversized word', () => {
  const chunks = splitText('x'.repeat(205), 100);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [100, 100, 5]);
});
