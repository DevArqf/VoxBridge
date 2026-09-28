const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} = require('discord.js');
const path = require('node:path');
const fs = require('node:fs');
const loadCommands = require('./functions/handleCommands');
const loadEvents = require('./functions/handleEvents');
const logger = require('./utils/logger');
const config = require('./config');
const { closeDatabase, initializeDatabase } = require('./db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});
client.commands = new Collection();
client.on('error', (error) => logger.error('Discord client error.', error));
client.on('shardError', (error, shardId) => logger.error({ err: error, shardId }, 'Discord shard error.'));

async function start() {
  logger.info(`Debug logging is ${logger.enabled ? 'enabled' : 'disabled'}.`);
  initializeDatabase();
  const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'))
    .filter((name) => fs.statSync(path.join(__dirname, 'commands', name)).isDirectory());
  const eventFiles = fs.readdirSync(path.join(__dirname, 'events'))
    .filter((name) => name.endsWith('.js'));
  await loadCommands(client, commandFolders);
  loadEvents(client, eventFiles);
  await client.login(config.DISCORD_TOKEN);
}

start().catch((error) => {
  logger.error('VoxBridge startup failed.', error);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    logger.info({ signal }, 'Shutting down VoxBridge.');
    if (client.vpbActivityTimer) clearInterval(client.vpbActivityTimer);
    client.destroy();
    closeDatabase();
    process.exit(0);
  });
}
