const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../../utils/audioQueue');
const { panel } = require('../../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave voice and clear pending audio.'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    queue.clear();
    queue.connection?.destroy();
    queue.connection = null;

    return interaction.reply(panel('Disconnected', 'I have left the voice channel and cleared the pending audio queue.', { tone: 'success', ephemeral: true }));
  },
};
