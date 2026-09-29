const { SlashCommandBuilder } = require('discord.js');
const { getGuildUsage } = require('../../db');
const { panel } = require('../../utils/ui');

function resetLabel(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toLocaleDateString('en-US', {
    timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric',
  });
}

module.exports = {
  data: new SlashCommandBuilder().setName('usage').setDescription('View this server’s monthly translation usage and tier.'),
  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply(panel('Server only', 'Run /usage inside a server.', { ephemeral: true }));
    const usage = getGuildUsage(interaction.guildId);
    const percentage = Math.min(100, Math.floor((usage.used / usage.limit) * 100));
    const filled = Math.round(percentage / 10);
    const meter = `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${percentage}%`;
    const priority = usage.tier === 'pro' ? 'Priority queue' : 'Standard queue';
    const body = [
      `**Plan** · ${usage.tier === 'pro' ? '✨ Pro' : 'Free'}`,
      `**Monthly usage** · ${usage.used.toLocaleString()} / ${usage.limit.toLocaleString()} characters`,
      `\`${meter}\``,
      `**Remaining** · ${usage.remaining.toLocaleString()} characters`,
      `**TTS queue** · ${priority}`,
      `**Resets** · ${resetLabel()}`,
    ].join('\n');
    return interaction.reply(panel('VoxBridge · Monthly usage', body, { ephemeral: true }));
  },
};
