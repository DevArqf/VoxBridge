const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'voxbridge-test-'));
process.env.DB_PATH = path.join(tempDirectory, 'test.db');
process.env.DISCORD_TOKEN ||= 'test-discord-token-1234567890';
process.env.DISCORD_CLIENT_ID ||= '123456789012345678';
process.env.DEEPL_AUTH_KEY ||= 'test-deepl-key:fx';
process.env.TARGET_VOICE_LANG ||= 'EN';

const database = require('../src/db');
const guildId = '123456789012345678';
const userId = '123456789012345679';

test('migrations, persistence, and cache updates work', (t) => {
  t.after(() => {
    database.closeDatabase();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  database.initializeDatabase();
  database.saveGuildSettings({
    guildId,
    textChannelId: '123456789012345680',
    voiceChannelId: '123456789012345681',
    targetLanguage: 'EN',
  });
  assert.equal(database.getGuildSettings(guildId).target_language, 'EN');
  database.setGuildDefaultVoice(guildId, 'en-US-AriaNeural');
  assert.equal(database.getGuildSettings(guildId).default_voice, 'en-US-AriaNeural');
  database.recordTranslationUsage(guildId, 12, '2026-09');
  database.recordTranslationUsage(guildId, 8, '2026-09');
  database.recordTranslationUsage(guildId, 5, '2026-08');
  assert.equal(database.getMonthlyTranslationUsage(guildId, '2026-09'), 20);
  assert.equal(database.getMonthlyTranslationUsage(guildId, '2026-07'), 0);
  const freeLimit = database.getGuildUsage(guildId, '2026-09');
  assert.equal(freeLimit.limit, 50_000);
  assert.equal(database.reserveTranslationUsage(guildId, 49_980, '2026-09').allowed, true);
  assert.equal(database.reserveTranslationUsage(guildId, 1, '2026-09').allowed, false);
  database.releaseTranslationUsage(guildId, 49_980, '2026-09');
  database.upsertGuildSubscription({
    guildId,
    customerId: 'cus_test',
    subscriptionId: 'sub_test',
    priceId: 'price_pro',
    status: 'active',
    currentPeriodEnd: '2099-12-31T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    eventCreated: 2_000,
  });
  assert.equal(database.getGuildUsage(guildId, '2026-09').limit, 1_000_000);
  assert.equal(database.getGuildSubscription(guildId).is_pro, 1);
  database.upsertGuildSubscription({ guildId, status: 'past_due', eventCreated: 2_001 });
  assert.equal(database.getGuildUsage(guildId, '2026-09').limit, 50_000);
  database.upsertGuildSubscription({ guildId, customerId: 'cus_test', subscriptionId: 'sub_test', priceId: 'price_pro', status: 'active', currentPeriodEnd: '2099-12-31T00:00:00.000Z', cancelAtPeriodEnd: false, eventCreated: 2_002 });
  assert.equal(database.getGuildSubscriptionByStripeSubscriptionId('sub_test').guild_id, guildId);
  assert.equal(database.claimUsageAlert(guildId, '2026-09', 80), true);
  assert.equal(database.claimUsageAlert(guildId, '2026-09', 80), false);
  assert.equal(database.muteUser(guildId, userId, '123456789012345682'), true);
  assert.equal(database.isUserMuted(guildId, userId), true);
  assert.equal(database.muteUser(guildId, userId, '123456789012345682'), false);

  database.setUserNativeLanguage(userId, 'ES');
  assert.equal(database.getUserProfile(userId).native_language, 'ES');
  database.setUserTargetLanguage(userId, 'FR');
  assert.equal(database.getUserProfile(userId).target_language, 'FR');
  database.setUserPreferredVoice(userId, 'es-ES-ElviraNeural');
  assert.equal(database.getUserProfile(userId).preferred_voice, 'es-ES-ElviraNeural');
  assert.equal(database.getUserProfile(userId).target_language, 'FR');

  database.addCustomSlang(guildId, 'ggwp', 'good game well played');
  assert.equal(database.getCustomSlang(guildId)[0].replacement_term, 'good game well played');

  // SQL-looking input must be stored/compared literally, never executed.
  const injectionLikeTerm = "x'); DROP TABLE guild_settings;--";
  database.addCustomSlang(guildId, injectionLikeTerm, 'literal replacement');
  assert.equal(database.getCustomSlang(guildId).length, 2);
  assert.equal(database.getGuildSettings(guildId).target_language, 'EN');
  assert.equal(database.removeCustomSlang(guildId, "' OR 1=1 --"), 0);
  assert.equal(database.getCustomSlang(guildId).length, 2);
  assert.equal(database.removeCustomSlang(guildId, injectionLikeTerm), 1);

  assert.equal(database.removeCustomSlang(guildId, 'ggwp'), 1);
  assert.equal(database.getCustomSlang(guildId).length, 0);

  database.closeDatabase();
  database.initializeDatabase();
  assert.equal(database.getGuildSettings(guildId).text_channel_id, '123456789012345680');
  assert.equal(database.getGuildSettings(guildId).default_voice, 'en-US-AriaNeural');
  assert.equal(database.getUserProfile(userId).preferred_voice, 'es-ES-ElviraNeural');
  assert.equal(database.isUserMuted(guildId, userId), true);
  assert.equal(database.unmuteUser(guildId, userId), true);
  assert.equal(database.isUserMuted(guildId, userId), false);
  assert.equal(database.removeGuildSettings(guildId), true);
  assert.equal(database.getGuildSettings(guildId), null);
});
