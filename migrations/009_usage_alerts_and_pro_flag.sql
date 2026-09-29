ALTER TABLE guild_subscriptions
  ADD COLUMN is_pro INTEGER NOT NULL DEFAULT 0 CHECK (is_pro IN (0, 1));

UPDATE guild_subscriptions
SET is_pro = CASE WHEN status IN ('active', 'trialing') THEN 1 ELSE 0 END;

CREATE TABLE IF NOT EXISTS usage_alerts (
  guild_id TEXT NOT NULL,
  month TEXT NOT NULL,
  threshold INTEGER NOT NULL CHECK (threshold IN (80, 100)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, month, threshold)
);
