const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const {
  connectQueueToVoiceChannel,
  getQueue,
} = require('../../utils/audioQueue');
const logger = require('../../utils/logger');
const { panel } = require('../../utils/ui');
const { getGuildSettings, getUserProfile } = require('../../db');
const { languageLabel } = require('../../utils/languageLabels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join your current voice channel.'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });

    const channel = interaction.member?.voice?.channel;
    if (!channel) {
      return interaction.editReply(panel('Voice channel required', 'Join a voice channel, then run `/join` again.', { tone: 'warning', ephemeral: true }));
    }

    const permissions = channel.permissionsFor(interaction.guild.members.me);
    if (!permissions?.has('Connect') || !permissions.has('Speak')) {
      return interaction.editReply(panel('Missing permissions', 'I need **Connect** and **Speak** permissions in that voice channel.', { tone: 'error', ephemeral: true }));
    }

    const queue = getQueue(interaction.guildId);
    logger.debug(
      `Joining voice channel ${channel.id} in guild ${interaction.guildId}.`,
    );
    queue.stop();

    try {
      await connectQueueToVoiceChannel(interaction.guild, channel);
      logger.debug(`Voice connection is ready in guild ${interaction.guildId}.`);
    } catch (error) {
      logger.warn(
        `Voice connection did not become ready in guild ${interaction.guildId}.`,
        error,
      );
      queue.connection?.destroy();
      queue.connection = null;

      if (error.name === 'AbortError') {
        return interaction.editReply(panel('Voice connection timed out', 'I could not connect within 20 seconds. Check my **Connect** and **Speak** permissions, then check the server or network voice connection.', { tone: 'error', ephemeral: true }));
      }

      throw error;
    }

    queue.cancelEmptyDisconnect();
    const settings = getGuildSettings(interaction.guildId);
    if (!settings) {
      return interaction.editReply(panel(
        'Connected to voice',
        `Joined **${channel.name}**. A server admin can configure translated chat with \`/proxy bind\`.`,
        { tone: 'success', ephemeral: true },
      ));
    }

    const textChannel = interaction.guild.channels.cache.get(settings.text_channel_id);
    const proxyVoiceChannel = interaction.guild.channels.cache.get(settings.voice_channel_id);
    const textChannelLabel = textChannel ? `<#${textChannel.id}>` : `channel \`${settings.text_channel_id}\``;
    const voiceChannelLabel = proxyVoiceChannel
      ? `<#${proxyVoiceChannel.id}>`
      : `voice channel \`${settings.voice_channel_id}\``;
    const targetLanguage = languageLabel(getUserProfile(interaction.user.id)?.target_language || settings.target_language);
    const body = `I have successfully joined ${voiceChannelLabel}.\n\nYou can now type in ${textChannelLabel} in any language and **VoxBridge** will translate your messages into **${targetLanguage}** and speak them in ${voiceChannelLabel}`;
    return interaction.editReply(panel('Connected to voice', body, { tone: 'success', ephemeral: true }));
  },
};
