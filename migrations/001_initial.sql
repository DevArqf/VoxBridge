CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  text_channel_id TEXT NOT NULL,
  voice_channel_id TEXT NOT NULL,
  target_language TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  preferred_voice TEXT,
  native_language TEXT
);

CREATE TABLE IF NOT EXISTS custom_slang (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  original_term TEXT NOT NULL,
  replacement_term TEXT NOT NULL
);
