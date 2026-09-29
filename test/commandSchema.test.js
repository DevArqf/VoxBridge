process.env.DISCORD_TOKEN ||= 'test-discord-token-1234567890';
process.env.DISCORD_CLIENT_ID ||= '123456789012345678';
process.env.DEEPL_AUTH_KEY ||= 'test-deepl-key:fx';
process.env.TARGET_VOICE_LANG ||= 'EN';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyCommand = require('../src/commands/Other/proxy');
const translateCommand = require('../src/commands/Other/translate');
const usageCommand = require('../src/commands/Other/usage');
const settingsCommand = require('../src/commands/Other/settings');
const upgradeCommand = require('../src/commands/Other/upgrade');

test('/proxy includes configuration, personal voice, and slang subcommands', () => {
  const command = proxyCommand.data.toJSON();
  const names = command.options.map((option) => option.name);
  assert.deepEqual(names, ['bind', 'unbind', 'status', 'mute-user', 'unmute-user', 'language', 'target-language', 'voice', 'default-voice', 'slang']);

  const bind = command.options.find((option) => option.name === 'bind');
  assert.deepEqual(bind.options.slice(0, 2).map((option) => option.channel_types[0]), [0, 2]);
  for (const subcommand of ['voice', 'default-voice']) {
    assert.equal(command.options.find((option) => option.name === subcommand).options[0].autocomplete, true);
  }
});

test('/translate provides text, target language, and optional privacy settings', () => {
  const command = translateCommand.data.toJSON();
  assert.equal(command.name, 'translate');
  assert.deepEqual(command.options.map((option) => option.name), ['text', 'target_lang', 'private']);
  assert.equal(command.options[2].required, false);
});

test('Discord-native management commands are available without OAuth dashboard routes', () => {
  assert.deepEqual([usageCommand.data.name, settingsCommand.data.name, upgradeCommand.data.name], ['usage', 'settings', 'upgrade']);
  assert.equal(typeof settingsCommand.onComponent, 'function');
});
