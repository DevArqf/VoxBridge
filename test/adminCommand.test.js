const test = require('node:test');
const assert = require('node:assert/strict');
const admin = require('../src/commands/Other/admin');

test('/admin exposes developer-only proxy history tools', () => {
  const command = admin.data.toJSON();
  assert.equal(command.name, 'admin');
  assert.deepEqual(command.options.map((option) => option.name), [
    'proxied-chats',
    'export-proxy-chat',
  ]);
});

test('/admin rejects users other than the configured developer', async () => {
  let response;
  const interaction = {
    user: { id: '123456789012345678' },
    reply: async (payload) => { response = payload; },
  };
  await admin.execute(interaction, {});
  assert.equal(response.content, undefined);
  assert.ok(response.components?.length);
  assert.ok(response.flags);
});
