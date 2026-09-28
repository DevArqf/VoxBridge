const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
} = require('discord.js');
const { getAllGuildSettings } = require('../../db');
const logger = require('../../utils/logger');
const { panel } = require('../../utils/ui');

const DEVELOPER_ID = '899385550585364481';
const MAX_EXPORT_MESSAGES = 100;
const PAGE_LIMIT = 3600;

const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Developer-only VoxBridge administration.')
  .addSubcommand((subcommand) => subcommand
    .setName('proxied-chats')
    .setDescription('List all servers and channels configured for proxy chat.'))
  .addSubcommand((subcommand) => subcommand
    .setName('export-proxy-chat')
    .setDescription('Export recent messages from one configured proxy channel.')
    .addStringOption((option) => option
      .setName('guild_id')
      .setDescription('Server ID shown by /admin proxied-chats.')
      .setMinLength(17)
      .setMaxLength(20)
      .setRequired(true))
    .addIntegerOption((option) => option
      .setName('limit')
      .setDescription('Number of recent messages to export (maximum 100).')
      .setMinValue(1)
      .setMaxValue(MAX_EXPORT_MESSAGES)));

function escapeCodeBlock(value) {
  return String(value ?? '')
    .replace(/```/g, 'ˋˋˋ')
    .replace(/`/g, 'ˋ')
    .replace(/[\r\n\t]+/g, ' ')
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || (code >= 127 && code <= 159) ? ' ' : character;
    })
    .join('');
}

function splitIntoPages(lines, limit = PAGE_LIMIT) {
  const pages = [];
  let current = '';
  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > limit && current) {
      pages.push(current);
      current = line.slice(0, limit);
    } else {
      current = next.slice(0, limit);
    }
  }
  if (current) pages.push(current);
  return pages;
}

function buttons(pageIndex, pageCount, ownerId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`voxbridge-page:${ownerId}:prev`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId(`voxbridge-page:${ownerId}:next`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(pageIndex >= pageCount - 1),
  )];
}

async function paginate(interaction, { title, pages, tone = 'info' }) {
  let pageIndex = 0;
  const makePayload = (withButtons = true) => panel(
    title,
    `${pages[pageIndex]}\n\n-# Page ${pageIndex + 1} of ${pages.length}`,
    {
      tone,
      ephemeral: true,
      components: withButtons && pages.length > 1
        ? buttons(pageIndex, pages.length, interaction.user.id)
        : [],
    },
  );

  if (interaction.deferred) await interaction.editReply(makePayload());
  else await interaction.reply(makePayload());
  if (pages.length < 2) return;

  const response = await interaction.fetchReply();
  const collector = response.createMessageComponentCollector({
    time: 120_000,
    filter: (component) => component.user.id === interaction.user.id
      && component.customId.startsWith(`voxbridge-page:${interaction.user.id}:`),
  });
  collector.on('collect', async (component) => {
    pageIndex += component.customId.endsWith(':next') ? 1 : -1;
    pageIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));
    await component.update(makePayload());
  });
  collector.on('end', () => {
    interaction.editReply(makePayload(false)).catch(() => {});
  });
}

async function listProxyChats(interaction, client) {
  const configs = getAllGuildSettings();
  const lines = configs.map((settings) => {
    const guildName = client.guilds.cache.get(settings.guild_id)?.name || 'Server not cached';
    return `• **${guildName}** (\`${settings.guild_id}\`)\n  Text: <#${settings.text_channel_id}>  •  Voice: <#${settings.voice_channel_id}>  •  Target: **${settings.target_language}**`;
  });
  const pages = splitIntoPages(lines.length ? lines : ['No proxy chat configurations are saved.']);
  await paginate(interaction, { title: `Proxy Chat Directory`, pages });
  logger.info({ developerId: interaction.user.id, configurationCount: configs.length }, 'Developer listed proxy configurations.');
}

function exportPages(messages) {
  const lines = messages.map((message) => {
    const timestamp = message.createdAt.toISOString();
    const author = escapeCodeBlock(message.author?.tag || message.author?.username || 'unknown');
    const content = escapeCodeBlock(message.content || '[no text content]');
    return `[${timestamp}] ${author}: ${content}`;
  });
  const bodyPages = splitIntoPages(lines.length ? lines : ['No messages were found.'], PAGE_LIMIT - 20);
  return bodyPages.map((body) => `\`\`\`text\n${body}\n\`\`\``);
}

async function exportProxyChat(interaction, client) {
  const guildId = interaction.options.getString('guild_id', true);
  const limit = interaction.options.getInteger('limit') || MAX_EXPORT_MESSAGES;
  const settings = getAllGuildSettings().find((entry) => entry.guild_id === guildId);
  if (!settings) {
    await interaction.reply(panel('Proxy chat not found', 'No proxy configuration exists for that server ID.', { tone: 'warning', ephemeral: true }));
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
  const channel = guild?.channels.cache.get(settings.text_channel_id)
    || await guild?.channels.fetch(settings.text_channel_id).catch(() => null);
  if (!channel?.isTextBased() || typeof channel.messages?.fetch !== 'function') {
    await interaction.editReply(panel('Channel unavailable', 'I cannot access the configured text channel. Check that I have **View Channel** and **Read Message History** permissions.', { tone: 'error', ephemeral: true }));
    return;
  }

  const messages = [];
  let before;
  while (messages.length < limit) {
    const requested = Math.min(100, limit - messages.length);
    const page = await channel.messages.fetch({ limit: requested, ...(before ? { before } : {}) });
    if (!page.size) break;
    const ordered = [...page.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    messages.push(...ordered);
    before = ordered[ordered.length - 1]?.id;
    if (page.size < requested) break;
  }

  const pages = exportPages(messages);
  await paginate(interaction, {
    title: `Proxy History ${guild.name}`,
    pages,
  });
  logger.info({ developerId: interaction.user.id, guildId, channelId: channel.id, messageCount: messages.length, pageCount: pages.length }, 'Developer exported proxy chat history.');
}

module.exports = {
  data,
  async execute(interaction, client) {
    if (interaction.user.id !== DEVELOPER_ID) {
      await interaction.reply(panel('Restricted command', 'This developer-only command is not available to you.', { tone: 'error', ephemeral: true }));
      return;
    }
    if (interaction.options.getSubcommand() === 'proxied-chats') return listProxyChats(interaction, client);
    return exportProxyChat(interaction, client);
  },
};
