CREATE TABLE IF NOT EXISTS translation_usage (
  guild_id TEXT NOT NULL,
  month TEXT NOT NULL,
  character_count INTEGER NOT NULL DEFAULT 0 CHECK (character_count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, month)
);
