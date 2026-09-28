const { translate, translationCharacterCount } = require('../utils/translator');
const { connectQueueToVoiceChannel } = require('../utils/audioQueue');
const {
  getGuildSettings,
  getUserProfile,
  getCustomSlang,
  recordTranslationUsage,
  isUserMuted,
} = require('../db');
const logger = require('../utils/logger');
const { sanitizeText } = require('../utils/inputValidation');
const { userFacingMessage } = require('../utils/errors');
const { panel } = require('../utils/ui');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot) return;
    const settings = getGuildSettings(message.guildId);
    if (!settings || settings.text_channel_id !== message.channelId) return;
    if (isUserMuted(message.guildId, message.author.id)) {
      logger.debug({ guildId: message.guildId, userId: message.author.id }, 'Skipping proxy message from a muted user.');
      return;
    }

    const text = sanitizeText(message.content, { maxLength: 2000 });
    if (!text) {
      await message.reply(panel('Message not processed', 'Your message is empty or exceeds the supported length.', { tone: 'warning' })).catch(() => {});
      return;
    }

    logger.debug({ guildId: message.guildId, userId: message.author.id, inputLength: text.length }, 'Processing configured proxy message.');
    try {
      const voiceChannel = message.guild.channels.cache.get(settings.voice_channel_id);
      if (!voiceChannel?.isVoiceBased()) {
        logger.warn(`Configured voice channel ${settings.voice_channel_id} is missing or not a voice channel in guild ${message.guildId}.`);
        return;
      }
      const queue = await connectQueueToVoiceChannel(message.guild, voiceChannel);
      const profile = getUserProfile(message.author.id);
      const slang = getCustomSlang(message.guildId);
      const targetLanguage = profile?.target_language || settings.target_language;
      const translated = await translate(text, profile?.native_language, slang, targetLanguage);
      try {
        recordTranslationUsage(message.guildId, translationCharacterCount(text, slang));
      } catch (usageError) {
        logger.warn({ guildId: message.guildId, err: usageError }, 'Could not record translation usage; continuing audio delivery.');
      }
      logger.debug({ guildId: message.guildId, outputLength: translated.length }, 'Translation completed.');
      let notifiedOfAudioFailure = false;
      await queue.enqueueText(translated, targetLanguage, {
        preferredVoice: profile?.preferred_voice,
        defaultVoice: settings.default_voice,
        onError: async (error) => {
          if (notifiedOfAudioFailure) return;
          notifiedOfAudioFailure = true;
          await message.reply(panel('Audio unavailable', userFacingMessage(error), { tone: 'error' })).catch(() => {});
        },
      });
      await message.react('🔊').catch(() => {});
    } catch (error) {
      logger.error({ guildId: message.guildId, userId: message.author.id, err: error }, 'Translation/audio enqueue failed.');
      await message.reply(panel('Translation unavailable', userFacingMessage(error), { tone: 'error' })).catch(() => {});
    }
  },
};
