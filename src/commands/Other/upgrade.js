const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const config = require('../../config');
const { panel } = require('../../utils/ui');

module.exports = {
  data: new SlashCommandBuilder().setName('upgrade').setDescription('Upgrade this Discord server to VoxBridge Pro.'),
  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply(panel('Server only', 'Run /upgrade inside a server.', { ephemeral: true }));
    if (![PermissionFlagsBits.ManageGuild, PermissionFlagsBits.Administrator]
      .some((permission) => interaction.memberPermissions?.has(permission))) {
      return interaction.reply(panel('Server admin required', 'You need Manage Server or Administrator permission to upgrade this server.', { ephemeral: true }));
    }
    if (!config.STRIPE_PAYMENT_LINK_URL || !config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET) {
      return interaction.reply(panel('Billing is not configured', 'The bot owner must configure the Stripe Payment Link, API key, and webhook signing secret before this server can upgrade.', { ephemeral: true }));
    }
    const checkout = new URL(config.STRIPE_PAYMENT_LINK_URL);
    checkout.searchParams.set('client_reference_id', interaction.guildId);
    const link = new ButtonBuilder().setLabel('Upgrade this server · $4.99/mo').setStyle(ButtonStyle.Link).setURL(checkout.toString());
    const row = new ActionRowBuilder().addComponents(link);
    return interaction.reply(panel('VoxBridge Pro', 'Get up to **1,000,000 translated characters/month** and **priority TTS queueing**. Your server ID is attached to checkout so the subscription can be activated automatically.', { ephemeral: true, components: [row] }));
  },
};
