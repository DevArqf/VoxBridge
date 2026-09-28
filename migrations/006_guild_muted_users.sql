CREATE TABLE IF NOT EXISTS guild_muted_users (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  muted_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_muted_users_user_id
  ON guild_muted_users (user_id);
