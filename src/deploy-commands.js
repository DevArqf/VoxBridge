const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');
const { withExternalError } = require('./utils/errors');

async function deployCommands() {
  const commandRoot = path.join(__dirname, 'commands');
  const commands = [];

  for (const folder of fs.readdirSync(commandRoot)) {
    const folderPath = path.join(commandRoot, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    for (const filename of fs.readdirSync(folderPath).filter((file) => file.endsWith('.js'))) {
      const command = require(path.join(folderPath, filename));
      commands.push(command.data.toJSON());
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const route = config.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID)
    : Routes.applicationCommands(config.DISCORD_CLIENT_ID);

  await withExternalError('register Discord commands', () => rest.put(route, { body: commands }));
  logger.info({ commandCount: commands.length }, 'Slash commands registered.');
}

deployCommands().catch((error) => {
  logger.error('Command deployment failed.', error);
  process.exitCode = 1;
});
