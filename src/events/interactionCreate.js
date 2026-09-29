const logger = require('../utils/logger');
const { userFacingMessage } = require('../utils/errors');
const { panel } = require('../utils/ui');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        logger.error(`Autocomplete for /${interaction.commandName} failed:`, error);
        await interaction.respond([]).catch(() => {});
      }
      return;
    }
    if (!interaction.isChatInputCommand()) {
      if (interaction.customId?.startsWith('vb_settings:')) {
        try {
          await client.commands.get('settings')?.onComponent?.(interaction);
        } catch (error) {
          logger.error({ err: error, guildId: interaction.guildId, userId: interaction.user?.id }, 'Settings interaction failed.');
          const message = userFacingMessage(error, 'Could not save that setting. Reopen /settings and try again.');
          const response = panel('Settings not saved', message, { ephemeral: true });
          if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => {});
          else await interaction.reply(response).catch(() => {});
        }
      }
      return;
    }
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    logger.debug({
      command: interaction.commandName,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    }, 'Executing slash command.');
    try {
      await command.execute(interaction, client);
    } catch (error) {
      logger.error(`Command /${interaction.commandName} failed:`, error);
      if (!interaction.isRepliable()) return;
      const message = userFacingMessage(error, 'There was an error while executing this command.');
      if (interaction.deferred) await interaction.editReply(panel('Something went wrong', message, { tone: 'error', ephemeral: true })).catch(() => {});
      else if (!interaction.replied) await interaction.reply(panel('Something went wrong', message, { tone: 'error', ephemeral: true })).catch(() => {});
    }
  },
};
