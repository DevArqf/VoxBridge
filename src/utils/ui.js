const {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} = require('discord.js');

const THEME_ACCENT = 0x39FF14;

function panel(title, body, { components = [], ephemeral = false } = {}) {
  const container = new ContainerBuilder()
    .setAccentColor(THEME_ACCENT)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
    .addSeparatorComponents(new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));

  return {
    components: [container, ...components],
    flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0),
  };
}

module.exports = { panel };
