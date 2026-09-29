const { translate, translationCharacterCount } = require('../utils/translator');
const { connectQueueToVoiceChannel } = require('../utils/audioQueue');
const {
  getGuildSettings,
  getUserProfile,
  getCustomSlang,
  reserveTranslationUsage,
  releaseTranslationUsage,
  isUserMuted,
  claimUsageAlert,
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
    let reservation;
    let translationCompleted = false;
    try {
      const voiceChannel = message.guild.channels.cache.get(settings.voice_channel_id);
      if (!voiceChannel?.isVoiceBased()) {
        logger.warn(`Configured voice channel ${settings.voice_channel_id} is missing or not a voice channel in guild ${message.guildId}.`);
        return;
      }
      const profile = getUserProfile(message.author.id);
      const slang = getCustomSlang(message.guildId);
      const targetLanguage = profile?.target_language || settings.target_language;
      const characterCount = translationCharacterCount(text, slang);
      reservation = reserveTranslationUsage(message.guildId, characterCount);
      if (!reservation.allowed) {
        const projected = reservation.used + characterCount;
        if (reservation.tier === 'free' && projected >= reservation.limit * 0.8
          && claimUsageAlert(message.guildId, reservation.month, 80)) {
          await message.channel.send(panel('VoxBridge · Usage is getting close', `This server has used **${reservation.used.toLocaleString()} / ${reservation.limit.toLocaleString()}** free characters this month. Server admins can review usage with **/usage** and upgrade with **/upgrade**.`)).catch(() => {});
        }
        if (reservation.tier === 'free' && projected >= reservation.limit) {
          const reachedCap = reservation.used >= reservation.limit
            && claimUsageAlert(message.guildId, reservation.month, 100);
          const text = reachedCap
            ? `This server has reached its **${reservation.limit.toLocaleString()}** character monthly limit. Server admins can run **/upgrade** to unlock Pro.`
            : `This message would exceed the **${reservation.limit.toLocaleString()}** character monthly limit. Server admins can run **/upgrade** to unlock Pro.`;
          // Discord does not support ephemeral replies to ordinary chat messages; DM the author instead.
          await message.author.send(panel('VoxBridge · Free limit reached', text)).catch(async () => {
            await message.reply(panel('VoxBridge · Free limit reached', 'This message cannot fit in the remaining monthly quota. Ask a server admin to run **/upgrade**.')).catch(() => {});
          });
        }
        logger.info({ guildId: message.guildId, tier: reservation.tier, used: reservation.used }, 'Translation blocked by monthly limit.');
        return;
      }
      const translated = await translate(text, profile?.native_language, slang, targetLanguage);
      translationCompleted = true;
      if (reservation.tier === 'free' && reservation.used >= reservation.limit * 0.8
        && claimUsageAlert(message.guildId, reservation.month, 80)) {
        await message.channel.send(panel('VoxBridge · Usage is getting close', `This server has used **${reservation.used.toLocaleString()} / ${reservation.limit.toLocaleString()}** free characters this month. Server admins can review usage with **/usage** and upgrade with **/upgrade**.`)).catch(() => {});
      }
      if (reservation.tier === 'free' && reservation.used >= reservation.limit
        && claimUsageAlert(message.guildId, reservation.month, 100)) {
        await message.author.send(panel('VoxBridge · Free limit reached', `This server has reached its **${reservation.limit.toLocaleString()}** character monthly limit. Server admins can run **/upgrade** to unlock Pro.`)).catch(async () => {
          await message.reply(panel('VoxBridge · Free limit reached', 'This server has reached the monthly quota. Ask a server admin to run **/upgrade**.')).catch(() => {});
        });
      }
      const queue = await connectQueueToVoiceChannel(message.guild, voiceChannel);
      logger.debug({ guildId: message.guildId, outputLength: translated.length }, 'Translation completed.');
      let notifiedOfAudioFailure = false;
      await queue.enqueueText(translated, targetLanguage, {
        preferredVoice: profile?.preferred_voice,
        defaultVoice: settings.default_voice,
        priority: reservation.tier === 'pro',
        onError: async (error) => {
          if (notifiedOfAudioFailure) return;
          notifiedOfAudioFailure = true;
          await message.reply(panel('Audio unavailable', userFacingMessage(error), { tone: 'error' })).catch(() => {});
        },
      });
      await message.react('🔊').catch(() => {});
    } catch (error) {
      if (reservation?.allowed && !translationCompleted) {
        try {
          releaseTranslationUsage(message.guildId, translationCharacterCount(text, getCustomSlang(message.guildId)), reservation.month);
        } catch (usageError) {
          logger.warn({ guildId: message.guildId, err: usageError }, 'Could not release failed translation usage reservation.');
        }
      }
      logger.error({ guildId: message.guildId, userId: message.author.id, err: error }, 'Translation/audio enqueue failed.');
      await message.reply(panel('Translation unavailable', userFacingMessage(error), { tone: 'error' })).catch(() => {});
    }
  },
};
