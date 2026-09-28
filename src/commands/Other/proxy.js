const {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');
const {
  removeGuildSettings,
  removeCustomSlang,
  addCustomSlang,
  getGuildSettings,
  getUserProfile,
  getMonthlyTranslationUsage,
  currentUsageMonth,
  saveGuildSettings,
  setUserNativeLanguage,
  setUserTargetLanguage,
  setUserPreferredVoice,
  setGuildDefaultVoice,
  muteUser,
  unmuteUser,
} = require('../../db');
const { getQueue } = require('../../utils/audioQueue');
const { DEEPL_LANGUAGES } = require('../../utils/languages');
const { languageLabel } = require('../../utils/languageLabels');
const logger = require('../../utils/logger');
const config = require('../../config');
const { panel } = require('../../utils/ui');
const { checkTranslationApi } = require('../../utils/translator');
const {
  USE_SERVER_DEFAULT,
  autocompleteVoices,
  getAvailableVoices,
  voiceMatchesLanguage,
} = require('../../utils/ttsVoices');

const languageChoices = DEEPL_LANGUAGES.map(([value]) => ({
  name: languageLabel(value),
  value,
}));

const data = new SlashCommandBuilder()
  .setName('proxy')
  .setDescription('Configure VoxBridge proxy settings.')
  .addSubcommand((subcommand) => subcommand
    .setName('bind')
    .setDescription('Bind a text channel and voice channel for this server.')
    .addChannelOption((option) => option
      .setName('text_channel')
      .setDescription('Channel where translated messages will be read.')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true))
    .addChannelOption((option) => option
      .setName('voice_channel')
      .setDescription('Voice channel where translations will be spoken.')
      .addChannelTypes(ChannelType.GuildVoice)
      .setRequired(true))
    .addStringOption((option) => option
      .setName('target_language')
      .setDescription('Language VoxBridge should speak.')
      .addChoices(...languageChoices)))
  .addSubcommand((subcommand) => subcommand
    .setName('unbind')
    .setDescription('Remove this server\'s VoxBridge channel configuration.'))
  .addSubcommand((subcommand) => subcommand
    .setName('status')
    .setDescription('Check channel binding, database usage, and DeepL API health.'))
  .addSubcommand((subcommand) => subcommand
    .setName('mute-user')
    .setDescription('Prevent a user from triggering voice proxy audio in this server.')
    .addUserOption((option) => option
      .setName('user')
      .setDescription('User to mute from the voice proxy.')
      .setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('unmute-user')
    .setDescription('Allow a muted user to trigger voice proxy audio again.')
    .addUserOption((option) => option
      .setName('user')
      .setDescription('User to unmute from the voice proxy.')
      .setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('language')
    .setDescription('Set your message language; leave unset for automatic detection.')
    .addStringOption((option) => option
      .setName('native_language')
      .setDescription('Language you usually type in.')
      .addChoices(...languageChoices)
      .setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('target-language')
    .setDescription('Choose the language you want to hear; leave blank to use the server default.')
    .addStringOption((option) => option
      .setName('language')
      .setDescription('Your preferred spoken language (optional).')
      .addChoices(...languageChoices)))
  .addSubcommand((subcommand) => subcommand
    .setName('voice')
    .setDescription('Choose your personal text-to-speech voice.')
    .addStringOption((option) => option
      .setName('voice')
      .setDescription('Search for a voice by name, language, or locale.')
      .setAutocomplete(true)
      .setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('default-voice')
    .setDescription('Set the server fallback voice used when users have no matching preference.')
    .addStringOption((option) => option
      .setName('voice')
      .setDescription('Choose a voice or use the automatic language-matched default.')
      .setAutocomplete(true)
      .setRequired(true)))
  .addSubcommandGroup((group) => group
    .setName('slang')
    .setDescription('Manage server-specific gaming slang replacements.')
    .addSubcommand((subcommand) => subcommand
      .setName('add')
      .setDescription('Add a slang replacement.')
      .addStringOption((option) => option
        .setName('original_term')
        .setDescription('Term or phrase members type.')
        .setMinLength(1)
        .setMaxLength(100)
        .setRequired(true))
      .addStringOption((option) => option
        .setName('replacement_term')
        .setDescription('Text to translate instead.')
        .setMinLength(1)
        .setMaxLength(200)
        .setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('remove')
      .setDescription('Remove a slang replacement by its original term.')
      .addStringOption((option) => option
        .setName('original_term')
        .setDescription('Term or phrase to remove.')
        .setMinLength(1)
        .setMaxLength(100)
        .setRequired(true))));

function replyPrivately(interaction, content, tone = 'info') {
  return interaction.reply(panel('VoxBridge Proxy Connection', content, { tone, ephemeral: true }));
}

function canManageGuild(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

function canModerateProxyUsers(interaction) {
  return [
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ModerateMembers,
  ].some((permission) => interaction.memberPermissions?.has(permission));
}

async function moderateProxyUser(interaction, mute) {
  if (!canModerateProxyUsers(interaction)) {
    return replyPrivately(interaction, 'You need Manage Server, Manage Messages, or Moderate Members permission to change proxy mutes.', 'error');
  }
  const user = interaction.options.getUser('user', true);
  const changed = mute
    ? muteUser(interaction.guildId, user.id, interaction.user.id)
    : unmuteUser(interaction.guildId, user.id);
  logger.info({
    guildId: interaction.guildId,
    targetUserId: user.id,
    moderatorId: interaction.user.id,
    action: mute ? 'mute' : 'unmute',
    changed,
  }, 'Proxy user moderation updated.');

  const response = mute
    ? (changed ? `Successfully muted **${user.tag}** from triggering voice proxy audio in this server.` : `**${user.tag}** is already muted from the voice proxy.`)
    : (changed ? `Successfully unmuted **${user.tag}**.\nThey can trigger voice proxy audio again.` : `**${user.tag}** was not muted from the voice proxy.`);
  return replyPrivately(interaction, response, changed ? 'success' : 'warning');
}

async function bindGuild(interaction) {
  const textChannel = interaction.options.getChannel('text_channel');
  const voiceChannel = interaction.options.getChannel('voice_channel');
  const targetLanguage = interaction.options.getString('target_language')
    || config.TARGET_VOICE_LANG;
  const botMember = interaction.guild.members.me;

  const textPermissions = textChannel.permissionsFor(botMember);
  const voicePermissions = voiceChannel.permissionsFor(botMember);

  if (!textPermissions?.has([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
  ])) {
    return replyPrivately(
      interaction,
      `I need View Channel and Send Messages permissions in ${textChannel}.`,
      'error',
    );
  }

  if (!voicePermissions?.has([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
    ])) {
    return replyPrivately(
      interaction,
      `I need View Channel, Connect, and Speak permissions in ${voiceChannel}.`,
      'error',
    );
  }

  saveGuildSettings({
    guildId: interaction.guildId,
    textChannelId: textChannel.id,
    voiceChannelId: voiceChannel.id,
    targetLanguage,
  });

  logger.info({
    guildId: interaction.guildId,
    textChannelId: textChannel.id,
    voiceChannelId: voiceChannel.id,
    targetLanguage,
  }, 'Proxy configuration saved.');

  return replyPrivately(
    interaction,
    `The proxy has been connected successfully.\n\nMessages in ${textChannel} will be translated and spoken in `
      + `${voiceChannel} using **${languageLabel(targetLanguage)}**.\nUsers can set their source `
      + 'language with `/proxy language` otherwise the language will be detected automatically.',
  );
}

async function unbindGuild(interaction) {
  const removed = removeGuildSettings(interaction.guildId);
  const queue = getQueue(interaction.guildId);

  queue.clear();
  queue.connection?.destroy();
  queue.connection = null;

  logger.info({ guildId: interaction.guildId, removed }, 'Proxy configuration removed.');

  return replyPrivately(
    interaction,
    removed
    ? 'This server\'s proxy binding and pending audio were removed.'
      : 'This server had no saved proxy binding.',
    removed ? 'success' : 'warning',
  );
}

async function setNativeLanguage(interaction) {
  const language = interaction.options.getString('native_language');
  setUserNativeLanguage(interaction.user.id, language);

  return replyPrivately(
    interaction,
    `Your message language is saved as **${languageLabel(language)}**.`,
  );
}

async function setTargetLanguage(interaction) {
  const language = interaction.options.getString('language');
  setUserTargetLanguage(interaction.user.id, language);
  if (!language) {
    return replyPrivately(interaction, 'Your personal target-language preference was cleared. You will hear translations in each server\'s configured language.', 'success');
  }
  const name = languageChoices.find((choice) => choice.value === language)?.name || language;
  logger.info({ userId: interaction.user.id, targetLanguage: language }, 'User target language updated.');
  return replyPrivately(interaction, `Your translations will now be spoken in **${name}**.`, 'success');
}

async function showStatus(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  const settings = getGuildSettings(interaction.guildId);
  const month = currentUsageMonth();
  let databaseHealthy = false;
  let monthlyCharacters = 0;
  try {
    monthlyCharacters = getMonthlyTranslationUsage(interaction.guildId, month);
    databaseHealthy = true;
  } catch (error) {
    logger.error({ guildId: interaction.guildId, err: error }, 'Proxy status database check failed.');
  }

  let apiLatency;
  try {
    apiLatency = await checkTranslationApi();
  } catch (error) {
    logger.warn({ guildId: interaction.guildId, err: error }, 'Proxy status Translation API health check failed.');
  }

  const isBoundHere = Boolean(settings && settings.text_channel_id === interaction.channelId);
  const bindingLine = settings
    ? `${isBoundHere ? '✅' : 'ℹ️'} ${isBoundHere ? 'This channel is bound' : `Not bound here. The proxy chat is <#${settings.text_channel_id}>`}`
    : '⚠️ No proxy channels are configured for this server.';
  const databaseLine = databaseHealthy
    ? `✅ SQLite is responding\n✅ **${monthlyCharacters.toLocaleString()}** characters this month (${month} UTC)`
    : '❌ SQLite query failed. Please join [Support Server](https://discord.gg/support-server) for assistance.';
  const apiLine = Number.isFinite(apiLatency)
    ? `✅ Reachable\n✅ ${apiLatency} ms`
    : '⚠️ Health check failed. Please join [Support Server](https://discord.gg/support-server) for assistance.';
  const body = [
    `**Channel binding**\n${bindingLine}`,
    `**Database**\n${databaseLine}`,
    `**DeepL API**\n${apiLine}`,
  ].join('\n\n');

  logger.info({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    isBoundHere,
    databaseHealthy,
    monthlyCharacters,
    apiLatency: apiLatency ?? null,
  }, 'Proxy status requested.');
  await interaction.editReply(panel('VoxBridge Status', body, { ephemeral: true }));
}

async function selectVoice(interaction, { serverDefault = false } = {}) {
  if (serverDefault && !canManageGuild(interaction)) {
    return replyPrivately(interaction, 'Only server admins with Manage Server permission can set the server default voice.', 'error');
  }
  const voiceId = interaction.options.getString('voice', true);
  const resetToDefault = voiceId === USE_SERVER_DEFAULT;
  const voice = resetToDefault
    ? null
    : (await getAvailableVoices()).find((candidate) => candidate.ShortName === voiceId);
  if (!resetToDefault && !voice) {
    return replyPrivately(interaction, 'That voice is no longer available. Please choose one from the voice picker.', 'warning');
  }
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const userTargetLanguage = !serverDefault
    ? getUserProfile(interaction.user.id)?.target_language
    : null;
  const effectiveTargetLanguage = userTargetLanguage || settings?.target_language;
  if (voice && effectiveTargetLanguage && !voiceMatchesLanguage(voice, effectiveTargetLanguage)) {
    return replyPrivately(
      interaction,
      `That voice speaks **${voice.LocaleName}**, but your effective target language is **${languageLabel(effectiveTargetLanguage)}**. Select a voice for that language so it can be used for your messages.`,
      'warning',
    );
  }

  if (serverDefault) {
    setGuildDefaultVoice(interaction.guildId, voice?.ShortName ?? null);
    const name = voice?.FriendlyName || 'automatic voice matching';
    logger.info({ guildId: interaction.guildId, voice: voice?.ShortName || null }, 'Server default voice updated.');
    return replyPrivately(interaction, `The server default TTS voice has been updated to **${name}**!`, 'success');
  }

  setUserPreferredVoice(interaction.user.id, voice?.ShortName ?? null);
  if (voice) {
    logger.info({ userId: interaction.user.id, voice: voice.ShortName }, 'User preferred TTS voice updated.');
    return replyPrivately(interaction, `Your default TTS voice has been updated to **${voice.FriendlyName}**`, 'success');
  }
  logger.info({ userId: interaction.user.id }, 'User reset preferred TTS voice.');
  return replyPrivately(interaction, 'Your voice preference was cleared. VoxBridge will use the server voice or match the target language automatically.', 'success');
}

async function manageSlang(interaction) {
  if (!canManageGuild(interaction)) {
    return replyPrivately(interaction, 'Only server admins with Manage Server permission can manage slang replacements.', 'error');
  }

  const action = interaction.options.getSubcommand();
  const originalTerm = interaction.options.getString('original_term');
  if (action === 'add') {
    const replacementTerm = interaction.options.getString('replacement_term');
    addCustomSlang(interaction.guildId, originalTerm, replacementTerm);
    logger.info({ guildId: interaction.guildId }, 'Custom slang replacement added.');
    return replyPrivately(interaction, 'Saved the slang replacement.');
  }

  const removed = removeCustomSlang(interaction.guildId, originalTerm);
  logger.info({ guildId: interaction.guildId, removed }, 'Custom slang replacement removed.');
  return replyPrivately(
    interaction,
    removed ? 'Removed the slang replacement.' : 'No matching slang replacement was found.',
  );
}

module.exports = {
  data,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (interaction.options.getSubcommandGroup() === 'slang') {
      return manageSlang(interaction);
    }

    if (subcommand === 'language') {
      return setNativeLanguage(interaction);
    }
    if (subcommand === 'target-language') return setTargetLanguage(interaction);
    if (subcommand === 'status') return showStatus(interaction);
    if (subcommand === 'mute-user') return moderateProxyUser(interaction, true);
    if (subcommand === 'unmute-user') return moderateProxyUser(interaction, false);

    if (subcommand === 'voice') return selectVoice(interaction);
    if (subcommand === 'default-voice') return selectVoice(interaction, { serverDefault: true });

    if (!canManageGuild(interaction)) {
      return replyPrivately(
        interaction,
        'Only server admins with Manage Server permission can change proxy settings.',
        'error',
      );
    }

    if (subcommand === 'unbind') {
      return unbindGuild(interaction);
    }

    return bindGuild(interaction);
  },

  async autocomplete(interaction) {
    const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
    const isServerDefault = interaction.options.getSubcommand() === 'default-voice';
    const userTargetLanguage = !isServerDefault
      ? getUserProfile(interaction.user.id)?.target_language
      : null;
    return autocompleteVoices(interaction, userTargetLanguage || settings?.target_language);
  },
};
