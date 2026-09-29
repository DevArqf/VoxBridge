const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType,
  ModalBuilder, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder,
  TextInputBuilder, TextInputStyle,
} = require('discord.js');
const db = require('../../db');
const { panel } = require('../../utils/ui');
const { DEEPL_LANGUAGES } = require('../../utils/languages');
const { languageLabel } = require('../../utils/languageLabels');
const { getAvailableVoices, voiceMatchesLanguage } = require('../../utils/ttsVoices');
const logger = require('../../utils/logger');

const ID = 'vb_settings';
const AUTO_VOICE = '__auto__';
const data = new SlashCommandBuilder().setName('settings').setDescription('Configure VoxBridge from Discord.');

function isAdmin(interaction) {
  return [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.Administrator]
    .some((permission) => interaction.memberPermissions?.has(permission));
}

function customId(action, interaction, suffix = '') {
  return [ID, action, interaction.guildId, interaction.user.id, suffix].filter(Boolean).join(':');
}

function parseId(interaction) {
  const [, action, guildId, userId, suffix] = interaction.customId.split(':');
  if (!action || guildId !== interaction.guildId || userId !== interaction.user.id || !isAdmin(interaction)) return null;
  return { action, suffix };
}

function selectRow(menu) { return new ActionRowBuilder().addComponents(menu); }
function buttonRow(buttons) { return new ActionRowBuilder().addComponents(...buttons); }
function ui(title, body, rows = []) { return panel(title, body, { ephemeral: true, components: rows }); }

function rootMenu(interaction) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId('root', interaction))
    .setPlaceholder('Choose a setting to configure')
    .addOptions(
      { label: 'Proxy channels', value: 'channels', description: 'Choose where VoxBridge listens and speaks' },
      { label: 'Target language', value: 'language', description: 'Set the server’s spoken translation language' },
      { label: 'Default TTS voice', value: 'voice', description: 'Choose the server fallback voice' },
      { label: 'Custom slang', value: 'slang', description: 'Add, edit, or remove server slang replacements' },
      { label: 'Muted users', value: 'muted', description: 'Manage members excluded from proxy playback' },
    );
  return ui('VoxBridge · Server settings', 'Select a section below. Changes apply to this server and are saved in SQLite.', [selectRow(menu)]);
}

function modal(interaction, action, title, fields) {
  const form = new ModalBuilder().setCustomId(customId(action, interaction)).setTitle(title);
  for (const field of fields) {
    const input = new TextInputBuilder()
      .setCustomId(field.id).setLabel(field.label).setStyle(field.style || TextInputStyle.Short)
      .setRequired(field.required !== false).setMaxLength(field.maxLength || 100);
    if (field.value) input.setValue(field.value);
    if (field.placeholder) input.setPlaceholder(field.placeholder);
    form.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return interaction.showModal(form);
}

async function showSection(interaction, section) {
  const settings = db.getGuildSettings(interaction.guildId);
  if (section === 'channels') {
    const text = new ChannelSelectMenuBuilder().setCustomId(customId('text-channel', interaction))
      .setPlaceholder('Select the proxy text channel').setChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1);
    return interaction.update(ui('Proxy channels', 'First select the text channel members will type in. You’ll then choose a voice channel.', [selectRow(text)]));
  }
  if (section === 'language') {
    if (!settings) return interaction.update(ui('Bind channels first', 'Set the proxy text and voice channels before selecting a server language.'));
    const language = new StringSelectMenuBuilder().setCustomId(customId('language', interaction))
      .setPlaceholder(`Current: ${languageLabel(settings.target_language)}`)
      .addOptions(DEEPL_LANGUAGES.map(([value]) => ({ label: languageLabel(value), value, default: value === settings.target_language })));
    return interaction.update(ui('Default target language', 'VoxBridge will speak translated messages in this language unless a member has a personal target-language preference.', [selectRow(language)]));
  }
  if (section === 'voice') {
    if (!settings) return interaction.update(ui('Bind channels first', 'Set the proxy text and voice channels before choosing a server voice.'));
    await interaction.deferUpdate();
    const voices = await getAvailableVoices();
    const compatible = voices.filter((voice) => voiceMatchesLanguage(voice, settings.target_language)).slice(0, 24);
    const choices = [{ label: 'Automatic language matching', value: AUTO_VOICE, description: 'Use the best matching voice automatically', default: !settings.default_voice },
      ...compatible.map((voice) => ({ label: `${voice.FriendlyName} · ${voice.Gender}`.slice(0, 100), value: voice.ShortName, default: voice.ShortName === settings.default_voice }))];
    const menu = new StringSelectMenuBuilder().setCustomId(customId('voice', interaction)).setPlaceholder('Choose the server fallback voice').addOptions(choices);
    return interaction.editReply(ui('Default TTS voice', `Voices compatible with ${languageLabel(settings.target_language)}. Individual users may still set personal voices with /proxy voice.`, [selectRow(menu)]));
  }
  if (section === 'slang') {
    const entries = db.getCustomSlang(interaction.guildId);
    const summary = entries.length
      ? entries.slice(0, 20).map((entry) => `• **${entry.original_term}** → ${entry.replacement_term}`).join('\n')
      : 'No custom replacements are configured yet.';
    const buttons = buttonRow([
      new ButtonBuilder().setCustomId(customId('slang-add', interaction)).setLabel('Add rule').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(customId('slang-edit', interaction)).setLabel('Edit rule').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(customId('slang-remove', interaction)).setLabel('Remove rule').setStyle(ButtonStyle.Danger),
    ]);
    return interaction.update(ui('Custom slang', `${summary}\n\nReplacement text is processed before translation.`, [buttons]));
  }
  if (section === 'muted') {
    const users = db.listMutedUsers(interaction.guildId);
    const summary = users.length ? users.slice(0, 30).map((user) => `• <@${user.user_id}>`).join('\n') : 'No users are muted.';
    const buttons = buttonRow([
      new ButtonBuilder().setCustomId(customId('mute', interaction)).setLabel('Mute user').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(customId('unmute', interaction)).setLabel('Unmute user').setStyle(ButtonStyle.Secondary),
    ]);
    return interaction.update(ui('Muted users', `${summary}\n\nMuted members can still type, but VoxBridge will skip translating their messages.`, [buttons]));
  }
  return interaction.update(rootMenu(interaction));
}

async function onComponent(interaction) {
  const parsed = parseId(interaction);
  if (!parsed) return interaction.reply(ui('Settings unavailable', 'Only the administrator who opened this settings panel can use it, and they must still have Manage Server or Administrator permission.'));

  if (interaction.isStringSelectMenu()) {
    if (parsed.action === 'root') return showSection(interaction, interaction.values[0]);
    if (parsed.action === 'language') {
      const settings = db.getGuildSettings(interaction.guildId);
      if (!settings) return interaction.update(ui('Bind channels first', 'Configure proxy channels before setting the server language.'));
      db.saveGuildSettings({ guildId: interaction.guildId, textChannelId: settings.text_channel_id, voiceChannelId: settings.voice_channel_id, targetLanguage: interaction.values[0] });
      logger.info({ guildId: interaction.guildId, targetLanguage: interaction.values[0] }, 'Server target language updated from settings UI.');
      return interaction.update(ui('Language saved', `The server target language is now **${languageLabel(interaction.values[0])}**.`));
    }
    if (parsed.action === 'voice') {
      await interaction.deferUpdate();
      const selected = interaction.values[0];
      const voice = selected === AUTO_VOICE ? null : (await getAvailableVoices()).find((item) => item.ShortName === selected);
      if (selected !== AUTO_VOICE && !voice) return interaction.editReply(ui('Voice unavailable', 'Please reopen /settings and choose an available voice.'));
      db.setGuildDefaultVoice(interaction.guildId, voice?.ShortName || null);
      return interaction.editReply(ui('Voice saved', `Server fallback voice: **${voice?.FriendlyName || 'Automatic language matching'}**.`));
    }
  }

  if (interaction.isChannelSelectMenu()) {
    const channelId = interaction.values[0];
    if (parsed.action === 'text-channel') {
      const voice = new ChannelSelectMenuBuilder().setCustomId(customId('voice-channel', interaction, channelId))
        .setPlaceholder('Select the target voice channel').setChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice).setMinValues(1).setMaxValues(1);
      return interaction.update(ui('Choose voice channel', `Text channel selected: <#${channelId}>. Now select where VoxBridge should speak.`, [selectRow(voice)]));
    }
    if (parsed.action === 'voice-channel') {
      const textChannel = interaction.guild.channels.cache.get(parsed.suffix);
      const voiceChannel = interaction.guild.channels.cache.get(channelId);
      const botMember = interaction.guild.members.me;
      if (!textChannel?.isTextBased() || !voiceChannel?.isVoiceBased()) return interaction.update(ui('Invalid channel', 'Choose valid text and voice channels from this server. Please reopen /settings.'));
      if (!textChannel.permissionsFor(botMember)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])
        || !voiceChannel.permissionsFor(botMember)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
        return interaction.update(ui('Missing bot permissions', 'Give VoxBridge View Channel and Send Messages in the text channel, and View Channel, Connect, and Speak in the voice channel.'));
      }
      const existing = db.getGuildSettings(interaction.guildId);
      db.saveGuildSettings({ guildId: interaction.guildId, textChannelId: textChannel.id, voiceChannelId: voiceChannel.id, targetLanguage: existing?.target_language || require('../../config').TARGET_VOICE_LANG });
      return interaction.update(ui('Channels saved', `VoxBridge listens in <#${textChannel.id}> and speaks in <#${voiceChannel.id}>.`));
    }
  }

  if (interaction.isButton()) {
    const actions = {
      'slang-add': ['slang-add', 'Add slang replacement', [{ id: 'original', label: 'Original term or phrase', maxLength: 100 }, { id: 'replacement', label: 'Replacement text', maxLength: 200 }]],
      'slang-edit': ['slang-edit', 'Edit slang replacement', [{ id: 'original', label: 'Existing term', maxLength: 100 }, { id: 'replacement', label: 'New replacement text', maxLength: 200 }]],
      'slang-remove': ['slang-remove', 'Remove slang replacement', [{ id: 'original', label: 'Term to remove', maxLength: 100 }]],
      mute: ['mute-submit', 'Mute a proxy user', [{ id: 'user_id', label: 'Discord user ID', placeholder: '17–20 digit ID', maxLength: 20 }]],
      unmute: ['unmute-submit', 'Unmute a proxy user', [{ id: 'user_id', label: 'Discord user ID', placeholder: '17–20 digit ID', maxLength: 20 }]],
    };
    const entry = actions[parsed.action];
    if (entry) return modal(interaction, entry[0], entry[1], entry[2]);
  }

  if (interaction.isModalSubmit()) {
    const original = interaction.fields.getTextInputValue('original')?.trim();
    if (parsed.action === 'slang-add') {
      db.addCustomSlang(interaction.guildId, original, interaction.fields.getTextInputValue('replacement'));
      return interaction.reply(ui('Slang rule added', `**${original}** will be replaced before text is sent for translation.`));
    }
    if (parsed.action === 'slang-edit') {
      const replacement = interaction.fields.getTextInputValue('replacement');
      const changes = db.editCustomSlang(interaction.guildId, original, original, replacement);
      return interaction.reply(ui(changes ? 'Slang rule updated' : 'Term not found', changes ? `Updated **${original}**.` : 'No existing rule matched that term.'));
    }
    if (parsed.action === 'slang-remove') {
      const changes = db.removeCustomSlang(interaction.guildId, original);
      return interaction.reply(ui(changes ? 'Slang rule removed' : 'Term not found', changes ? `Removed **${original}**.` : 'No existing rule matched that term.'));
    }
    const userId = interaction.fields.getTextInputValue('user_id').trim();
    if (parsed.action === 'mute-submit') {
      db.muteUser(interaction.guildId, userId, interaction.user.id);
      return interaction.reply(ui('User muted', `<@${userId}> will no longer trigger proxy translation or audio.`));
    }
    if (parsed.action === 'unmute-submit') {
      const changes = db.unmuteUser(interaction.guildId, userId);
      return interaction.reply(ui(changes ? 'User unmuted' : 'User was not muted', changes ? `<@${userId}> may trigger proxy translation again.` : 'That user was not in the muted list.'));
    }
  }
}

module.exports = {
  data,
  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply(ui('Server only', 'Run /settings inside a server.'));
    if (!isAdmin(interaction)) return interaction.reply(ui('Administrator permission required', 'You need Manage Server or Administrator permission to edit VoxBridge settings.'));
    return interaction.reply(rootMenu(interaction));
  },
  onComponent,
};
