const {
  MessageFlags,
  SlashCommandBuilder,
} = require('discord.js');
const { getUserProfile, reserveTranslationUsage, releaseTranslationUsage } = require('../../db');
const logger = require('../../utils/logger');
const { panel } = require('../../utils/ui');
const { translate, translationCharacterCount } = require('../../utils/translator');
const { DEEPL_LANGUAGES } = require('../../utils/languages');
const { languageLabel } = require('../../utils/languageLabels');
const { sanitizeText } = require('../../utils/inputValidation');

const languageChoices = DEEPL_LANGUAGES.map(([value]) => ({
  name: languageLabel(value),
  value,
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate a message on demand with DeepL.')
    .addStringOption((option) => option
      .setName('text')
      .setDescription('Text to translate.')
      .setMinLength(1)
      .setMaxLength(2000)
      .setRequired(true))
    .addStringOption((option) => option
      .setName('target_lang')
      .setDescription('Language to translate the text into.')
      .addChoices(...languageChoices)
      .setRequired(true))
    .addBooleanOption((option) => option
      .setName('private')
      .setDescription('Only you can see the result (defaults to true).')),

  async execute(interaction) {
    const text = sanitizeText(interaction.options.getString('text', true), { maxLength: 2000 });
    const targetLanguage = interaction.options.getString('target_lang', true);
    const isPrivate = interaction.options.getBoolean('private') ?? true;
    if (!text) {
      await interaction.reply(panel('Invalid text', 'Enter text between 1 and 2,000 characters.', { tone: 'warning', ephemeral: true }));
      return;
    }

    await interaction.deferReply({
      flags: MessageFlags.IsComponentsV2 | (isPrivate ? MessageFlags.Ephemeral : 0),
    });
    const profile = getUserProfile(interaction.user.id);
    let reservation;
    if (interaction.guildId) {
      reservation = reserveTranslationUsage(interaction.guildId, translationCharacterCount(text));
      if (!reservation.allowed) {
        await interaction.editReply(panel('Monthly limit reached', `This server has used ${reservation.used.toLocaleString()} of ${reservation.limit.toLocaleString()} characters on the ${reservation.tier} tier. A server admin can run **/upgrade** to unlock Pro.`, { tone: 'warning', ephemeral: isPrivate }));
        return;
      }
    }
    let translated;
    try {
      translated = await translate(text, profile?.native_language, [], targetLanguage);
    } catch (error) {
      if (reservation?.allowed) releaseTranslationUsage(interaction.guildId, translationCharacterCount(text), reservation.month);
      throw error;
    }

    const targetName = languageChoices.find((choice) => choice.value === targetLanguage)?.name || targetLanguage;
    logger.info({
      userId: interaction.user.id,
      guildId: interaction.guildId,
      targetLanguage,
      characterCount: translationCharacterCount(text),
      private: isPrivate,
    }, 'On-demand translation completed.');
    await interaction.editReply(panel(`Translation Completed - ${targetName}`, translated, { tone: 'success', ephemeral: isPrivate }));
  },
};
