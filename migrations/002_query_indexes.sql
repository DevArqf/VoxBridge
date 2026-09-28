CREATE INDEX IF NOT EXISTS idx_guild_settings_text_channel_id
  ON guild_settings(text_channel_id);

CREATE INDEX IF NOT EXISTS idx_guild_settings_voice_channel_id
  ON guild_settings(voice_channel_id);

CREATE INDEX IF NOT EXISTS idx_custom_slang_guild_id
  ON custom_slang(guild_id);
