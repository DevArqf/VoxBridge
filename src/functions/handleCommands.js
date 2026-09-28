const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../config');
const { withExternalError } = require('../utils/errors');

module.exports = async (client, folders) => {
  const commandRoot = path.join(__dirname, '..', 'commands');
  const commandData = [];
  for (const folder of folders) {
    const folderPath = path.join(commandRoot, folder);
    for (const file of fs.readdirSync(folderPath).filter((name) => name.endsWith('.js'))) {
      const command = require(path.join(folderPath, file));
      client.commands.set(command.data.name, command);
      commandData.push(command.data.toJSON());
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const route = config.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID)
    : Routes.applicationCommands(config.DISCORD_CLIENT_ID);
  await withExternalError('register Discord commands', () => rest.put(route, { body: commandData }));
  logger.info(`Registered ${commandData.length} VoxBridge slash commands.`);
  logger.debug('Loaded slash commands:', commandData.map((command) => command.name));
};
