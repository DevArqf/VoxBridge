const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const config = require('../config');
const cache = require('./cache');
const { withDatabaseError, AppError } = require('../utils/errors');
const { normalizeLanguageCode, isSnowflake, sanitizeText } = require('../utils/inputValidation');
const { TARGET_LANGUAGE_CODES } = require('../utils/languages');
const logger = require('../utils/logger');

let db;

function runMigrations(database) {
  const migrationDirectory = path.join(__dirname, '..', '..', 'migrations');
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrations = fs.readdirSync(migrationDirectory)
    .filter((file) => /^\d{3}_[a-z0-9_-]+\.sql$/i.test(file))
    .sort();
  const applied = new Set(
    database.prepare('SELECT migration_id FROM schema_migrations').all()
      .map((row) => row.migration_id),
  );

  for (const filename of migrations) {
    if (applied.has(filename)) continue;
    const sql = fs.readFileSync(path.join(migrationDirectory, filename), 'utf8');
    const applyMigration = database.transaction(() => {
      database.exec(sql);
      database.prepare('INSERT INTO schema_migrations (migration_id) VALUES (?)').run(filename);
    });
    applyMigration();
    logger.info({ migration: filename }, 'Database migration applied.');
  }
}

function initializeDatabase() {
  if (db) return db;

  return withDatabaseError('initialize', () => {
    const filename = path.resolve(config.DB_PATH);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    db = new Database(filename);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    runMigrations(db);

    cache.preloadGuildSettings(db.prepare('SELECT * FROM guild_settings').all());
    cache.preloadCustomSlang(db.prepare('SELECT guild_id, original_term, replacement_term FROM custom_slang ORDER BY id').all());
    cache.preloadUserProfiles(db.prepare('SELECT * FROM user_profiles').all());
    cache.preloadMutedUsers(db.prepare('SELECT guild_id, user_id FROM guild_muted_users').all());
    logger.info({ databasePath: filename }, 'SQLite database initialized.');
    return db;
  });
}

function closeDatabase() {
  if (!db) return;
  db.close();
  db = undefined;
  cache.preloadGuildSettings([]);
  cache.preloadCustomSlang([]);
  cache.preloadUserProfiles([]);
  cache.preloadMutedUsers([]);
}

function database() {
  if (!db) throw new Error('Database has not been initialized.');
  return db;
}

function getGuildSettings(guildId) {
  return cache.getGuildSettings(guildId);
}

function getAllGuildSettings() {
  return withDatabaseError('list guild settings', () =>
    database().prepare('SELECT * FROM guild_settings ORDER BY guild_id').all());
}

function saveGuildSettings({ guildId, textChannelId, voiceChannelId, targetLanguage }) {
  if (![guildId, textChannelId, voiceChannelId].every(isSnowflake)) {
    throw new AppError('INVALID_INPUT', 'Guild and channel IDs are invalid.');
  }
  const language = typeof targetLanguage === 'string' ? targetLanguage.trim().toUpperCase() : '';
  if (!TARGET_LANGUAGE_CODES.has(language)) {
    throw new AppError('INVALID_INPUT', 'Choose a supported target language.');
  }

  return withDatabaseError('save guild settings', () => {
    database().prepare(`
      INSERT INTO guild_settings (guild_id, text_channel_id, voice_channel_id, target_language)
      VALUES (@guildId, @textChannelId, @voiceChannelId, @targetLanguage)
      ON CONFLICT(guild_id) DO UPDATE SET
        text_channel_id = excluded.text_channel_id,
        voice_channel_id = excluded.voice_channel_id,
        target_language = excluded.target_language
    `).run({ guildId, textChannelId, voiceChannelId, targetLanguage: language });
    const row = database().prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
    cache.setGuildSettings(row);
    return row;
  });
}

function removeGuildSettings(guildId) {
  return withDatabaseError('remove guild settings', () => {
    const removed = database().prepare('DELETE FROM guild_settings WHERE guild_id = ?').run(guildId).changes > 0;
    cache.deleteGuildSettings(guildId);
    return removed;
  });
}

function getUserProfile(userId) {
  return cache.getUserProfile(userId);
}

function setUserNativeLanguage(userId, nativeLanguage) {
  const language = normalizeLanguageCode(nativeLanguage);
  if (!isSnowflake(userId) || !language) {
    throw new AppError('INVALID_INPUT', 'Choose a valid language.');
  }

  return withDatabaseError('save user language', () => {
    database().prepare(`
      INSERT INTO user_profiles (user_id, native_language) VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET native_language = excluded.native_language
    `).run(userId, language);
    const profile = database().prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
    cache.setUserProfile(profile);
    return profile;
  });
}

function setUserTargetLanguage(userId, targetLanguage) {
  const language = targetLanguage === null
    ? null
    : (typeof targetLanguage === 'string' ? targetLanguage.trim().toUpperCase() : '');
  if (!isSnowflake(userId) || (language !== null && !TARGET_LANGUAGE_CODES.has(language))) {
    throw new AppError('INVALID_INPUT', 'Choose a supported target language, or clear your preference to use the server default.');
  }

  return withDatabaseError('save user target language', () => {
    database().prepare(`
      INSERT INTO user_profiles (user_id, target_language) VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET target_language = excluded.target_language
    `).run(userId, language);
    const profile = database().prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
    cache.setUserProfile(profile);
    return profile;
  });
}

function setUserPreferredVoice(userId, preferredVoice) {
  if (!isSnowflake(userId)
    || (preferredVoice !== null && (typeof preferredVoice !== 'string'
      || preferredVoice.length > 100
      || /[^A-Za-z0-9-]/.test(preferredVoice)))) {
    throw new AppError('INVALID_INPUT', 'Choose a valid voice from the voice picker.');
  }

  return withDatabaseError('save preferred voice', () => {
    database().prepare(`
      INSERT INTO user_profiles (user_id, preferred_voice) VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET preferred_voice = excluded.preferred_voice
    `).run(userId, preferredVoice);
    const profile = database().prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
    cache.setUserProfile(profile);
    return profile;
  });
}

function setGuildDefaultVoice(guildId, defaultVoice) {
  if (!isSnowflake(guildId)
    || (defaultVoice !== null && (typeof defaultVoice !== 'string'
      || defaultVoice.length > 100
      || /[^A-Za-z0-9-]/.test(defaultVoice)))) {
    throw new AppError('INVALID_INPUT', 'Choose a valid voice from the voice picker.');
  }

  return withDatabaseError('save default server voice', () => {
    const result = database().prepare('UPDATE guild_settings SET default_voice = ? WHERE guild_id = ?')
      .run(defaultVoice, guildId);
    if (!result.changes) throw new AppError('NO_PROXY_CONFIGURATION', 'Bind proxy channels before setting a server voice.');
    const row = database().prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
    cache.setGuildSettings(row);
    return row;
  });
}

function getCustomSlang(guildId) {
  return cache.getCustomSlang(guildId);
}

function addCustomSlang(guildId, originalTerm, replacementTerm) {
  const original = sanitizeText(originalTerm, { maxLength: 100 });
  const replacement = sanitizeText(replacementTerm, { maxLength: 200 });
  if (!isSnowflake(guildId) || !original || !replacement) {
    throw new AppError('INVALID_INPUT', 'Slang terms must be non-empty and within their character limits.');
  }

  return withDatabaseError('add custom slang', () => {
    const result = database().prepare(`
      INSERT INTO custom_slang (guild_id, original_term, replacement_term)
      VALUES (?, ?, ?)
    `).run(guildId, original, replacement);
    cache.addCachedCustomSlang(guildId, original, replacement);
    return result.lastInsertRowid;
  });
}

function removeCustomSlang(guildId, originalTerm) {
  const original = sanitizeText(originalTerm, { maxLength: 100 });
  if (!isSnowflake(guildId) || !original) {
    throw new AppError('INVALID_INPUT', 'Enter a valid slang term to remove.');
  }

  return withDatabaseError('remove custom slang', () => {
    const result = database().prepare(`
      DELETE FROM custom_slang
      WHERE guild_id = ? AND lower(original_term) = lower(?)
    `).run(guildId, original);
    const rows = database().prepare(`
      SELECT original_term, replacement_term
      FROM custom_slang WHERE guild_id = ? ORDER BY id
    `).all(guildId);
    cache.setCachedCustomSlang(guildId, rows);
    return result.changes;
  });
}

function currentUsageMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

function recordTranslationUsage(guildId, characterCount, month = currentUsageMonth()) {
  if (!isSnowflake(guildId)
    || !Number.isInteger(characterCount)
    || characterCount < 0
    || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new AppError('INVALID_INPUT', 'Invalid translation usage data.');
  }
  if (characterCount === 0) return;

  return withDatabaseError('record translation usage', () => database().prepare(`
    INSERT INTO translation_usage (guild_id, month, character_count)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id, month) DO UPDATE SET
      character_count = translation_usage.character_count + excluded.character_count,
      updated_at = CURRENT_TIMESTAMP
  `).run(guildId, month, characterCount));
}

function getMonthlyTranslationUsage(guildId, month = currentUsageMonth()) {
  if (!isSnowflake(guildId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new AppError('INVALID_INPUT', 'Invalid guild or usage month.');
  }
  return withDatabaseError('read monthly translation usage', () =>
    database().prepare(`
      SELECT character_count FROM translation_usage WHERE guild_id = ? AND month = ?
    `).get(guildId, month)?.character_count || 0);
}

function muteUser(guildId, userId, moderatorId) {
  if (![guildId, userId, moderatorId].every(isSnowflake)) {
    throw new AppError('INVALID_INPUT', 'A valid guild, user, and moderator are required.');
  }
  return withDatabaseError('mute proxy user', () => {
    const result = database().prepare(`
      INSERT INTO guild_muted_users (guild_id, user_id, muted_by)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO NOTHING
    `).run(guildId, userId, moderatorId);
    cache.setUserMuted(guildId, userId, true);
    return result.changes > 0;
  });
}

function unmuteUser(guildId, userId) {
  if (![guildId, userId].every(isSnowflake)) {
    throw new AppError('INVALID_INPUT', 'A valid guild and user are required.');
  }
  return withDatabaseError('unmute proxy user', () => {
    const result = database().prepare(
      'DELETE FROM guild_muted_users WHERE guild_id = ? AND user_id = ?',
    ).run(guildId, userId);
    cache.setUserMuted(guildId, userId, false);
    return result.changes > 0;
  });
}

function isUserMuted(guildId, userId) {
  return cache.isUserMuted(guildId, userId);
}

module.exports = {
  initializeDatabase,
  closeDatabase,
  getGuildSettings,
  getAllGuildSettings,
  saveGuildSettings,
  removeGuildSettings,
  getUserProfile,
  setUserNativeLanguage,
  setUserTargetLanguage,
  setUserPreferredVoice,
  setGuildDefaultVoice,
  getCustomSlang,
  addCustomSlang,
  removeCustomSlang,
  recordTranslationUsage,
  getMonthlyTranslationUsage,
  currentUsageMonth,
  muteUser,
  unmuteUser,
  isUserMuted,
};
