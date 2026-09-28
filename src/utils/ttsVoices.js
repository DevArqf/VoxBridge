const logger = require('./logger');

const USE_SERVER_DEFAULT = '__server_default__';
let edgeTtsClass;
let voicesPromise;

async function getAvailableVoices() {
  if (!voicesPromise) {
    voicesPromise = import('@andresaya/edge-tts')
      .then(async ({ EdgeTTS }) => {
        edgeTtsClass = EdgeTTS;
        const service = new EdgeTTS();
        return service.getVoices();
      })
      .catch((error) => {
        voicesPromise = undefined;
        throw error;
      });
  }
  return voicesPromise;
}

async function autocompleteVoices(interaction, targetLanguage) {
  const query = (interaction.options.getFocused() || '').toLocaleLowerCase();
  try {
    const allVoices = await getAvailableVoices();
    const available = targetLanguage
      ? allVoices.filter((voice) => voiceMatchesLanguage(voice, targetLanguage))
      : allVoices;
    const choices = [{ name: 'Use server default voice', value: USE_SERVER_DEFAULT }];
    const matches = available
      .filter((voice) => !query
        || `${voice.FriendlyName} ${voice.ShortName} ${voice.Locale} ${voice.Gender}`.toLocaleLowerCase().includes(query))
      .slice(0, 24)
      .map((voice) => ({
        name: `${voice.FriendlyName} · ${voice.Gender}`.slice(0, 100),
        value: voice.ShortName,
      }));
    if (query && !'server default'.includes(query)) choices.shift();
    await interaction.respond([...choices, ...matches].slice(0, 25));
  } catch (error) {
    logger.warn({ err: error }, 'Could not load available speech voices for autocomplete.');
    await interaction.respond([]).catch(() => {});
  }
}

function localeForLanguage(language) {
  const code = String(language || '').toUpperCase();
  const aliases = {
    'ZH-HANS': 'zh-CN',
    'PT-BR': 'pt-BR',
    'PT-PT': 'pt-PT',
    'EN-GB': 'en-GB',
    'EN-US': 'en-US',
    NB: 'nb-NO',
  };
  if (aliases[code]) return aliases[code];
  return code.toLowerCase();
}

function voiceMatchesLanguage(voice, language) {
  const locale = localeForLanguage(language).toLowerCase();
  return Boolean(voice && voice.Locale.toLowerCase().split('-')[0] === locale.split('-')[0]);
}

async function getVoiceForLanguage(preferredVoice, defaultVoice, language) {
  const voices = await getAvailableVoices();
  const byName = new Map(voices.map((voice) => [voice.ShortName, voice]));
  const personal = byName.get(preferredVoice);
  if (voiceMatchesLanguage(personal, language)) return personal;

  const server = byName.get(defaultVoice);
  if (voiceMatchesLanguage(server, language)) return server;

  const preferredLocale = localeForLanguage(language).toLowerCase();
  const matches = voices
    .filter((voice) => voiceMatchesLanguage(voice, language))
    .sort((left, right) => Number(right.Locale.toLowerCase() === preferredLocale)
      - Number(left.Locale.toLowerCase() === preferredLocale));
  return matches.find((voice) => voice.Gender === 'Female')
    || matches[0]
    || byName.get('en-US-AriaNeural')
    || voices[0];
}

async function synthesize(text, voiceId) {
  const voices = await getAvailableVoices();
  const voice = voices.find((candidate) => candidate.ShortName === voiceId);
  if (!voice || !edgeTtsClass) throw new Error('The selected TTS voice is unavailable.');

  const service = new edgeTtsClass();
  await service.synthesize(text, voice.ShortName, {
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
  });
  const audio = service.toBuffer();
  if (!audio?.length) throw new Error('The TTS provider returned empty audio.');
  return Buffer.from(audio);
}

module.exports = {
  USE_SERVER_DEFAULT,
  autocompleteVoices,
  getAvailableVoices,
  getVoiceForLanguage,
  voiceMatchesLanguage,
  synthesize,
};
