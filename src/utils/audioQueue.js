const {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  StreamType,
  VoiceConnectionStatus,
} = require('@discordjs/voice');
const { spawn } = require('node:child_process');
const { Readable } = require('node:stream');
const ffmpegPath = require('ffmpeg-static');
const logger = require('./logger');
const { AppError, withExternalError } = require('./errors');
const {
  getAvailableVoices,
  getVoiceForLanguage,
  synthesize,
  voiceMatchesLanguage,
} = require('./ttsVoices');

const queues = new Map();
const MAX_TTS_CHARS = 200;
const MAX_PENDING_CHUNKS = 100;

function splitText(text, limit = MAX_TTS_CHARS) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('Chunk size must be a positive integer.');
  }

  const chunks = [];
  let current = '';
  const words = text.match(/\S+/gu) || [];

  for (const word of words) {
    if (Array.from(word).length > limit) {
      if (current) chunks.push(current), current = '';
      const characters = Array.from(word);
      for (let index = 0; index < characters.length; index += limit) {
        chunks.push(characters.slice(index, index + limit).join(''));
      }
      continue;
    }

    const nextLength = current.length ? current.length + 1 + word.length : word.length;
    if (nextLength > limit) {
      chunks.push(current);
      current = word;
    } else {
      current += `${current ? ' ' : ''}${word}`;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

class GuildAudioQueue {
  constructor() {
    this.connection = null;
    this.items = [];
    this.playing = false;
    this.emptyTimer = null;
    this.generation = 0;
    this.sequence = 0;
    this.player = createAudioPlayer();

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.playing = false;
      this.playNext();
    });
    this.player.on('error', (error) => {
      logger.error('Audio player error.', error);
      this.playing = false;
      this.playNext();
    });
  }

  attachPlayer() {
    this.connection?.subscribe(this.player);
  }

  async enqueueText(text, language, { preferredVoice, defaultVoice, onError, priority = false } = {}) {
    const chunks = splitText(text);
    if (this.items.length + chunks.length > MAX_PENDING_CHUNKS) {
      throw new AppError('QUEUE_FULL', 'The voice queue is busy. Please try again shortly.');
    }

    const selectedVoice = await withExternalError('TTS voice selection', () =>
      getVoiceForLanguage(preferredVoice, defaultVoice, language));
    const storedVoice = preferredVoice
      ? (await getAvailableVoices()).find((voice) => voice.ShortName === preferredVoice)
      : null;
    if (storedVoice && !voiceMatchesLanguage(storedVoice, language)) {
      logger.warn({ preferredVoice, targetLanguage: language, selectedVoice: selectedVoice.ShortName }, 'Personal TTS voice does not match this server target language; using a compatible voice instead.');
    }
    const audioBuffers = [];
    for (const chunk of chunks) {
      const audio = await withExternalError('Edge TTS synthesis', () =>
        synthesize(chunk, selectedVoice.ShortName));
      audioBuffers.push(audio);
    }

    const queued = audioBuffers.map((audio) => ({ audio, onError, priority: Boolean(priority), sequence: this.sequence++ }));
    for (const item of queued) {
      const index = this.items.findIndex((existing) => Number(existing.priority) < Number(item.priority));
      if (index < 0) this.items.push(item);
      else this.items.splice(index, 0, item);
    }
    logger.debug({
      addedChunks: audioBuffers.length,
      pendingChunks: this.items.length,
      voice: selectedVoice.ShortName,
      preferredVoice: preferredVoice || null,
      serverDefaultVoice: defaultVoice || null,
      priority,
    }, 'Audio added to queue.');
    this.playNext();
  }

  async makeResource(audio) {
    const ffmpeg = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
      '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1',
    ]);

    ffmpeg.on('error', (error) => logger.error('FFmpeg process failed.', error));
    Readable.from([audio]).pipe(ffmpeg.stdin);
    return createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw });
  }

  async playNext() {
    if (this.playing || !this.connection || this.items.length === 0) return;

    this.playing = true;
    const generation = this.generation;
    const item = this.items.shift();

    try {
      const resource = await this.makeResource(item.audio);
      if (!this.connection || generation !== this.generation) {
        resource.playStream.destroy();
        this.playing = false;
        return;
      }

      logger.debug('Starting next TTS audio chunk.');
      this.player.play(resource);
    } catch (error) {
      logger.error('Could not prepare TTS audio.', error);
      if (generation === this.generation && item.onError) {
        await item.onError(error).catch(() => {});
      }
      this.playing = false;
      this.playNext();
    }
  }

  stop() {
    this.generation += 1;
    this.items = [];
    this.playing = false;
    this.player.stop(true);
  }

  clear() {
    this.stop();
    this.cancelEmptyDisconnect();
  }

  scheduleEmptyDisconnect() {
    this.cancelEmptyDisconnect();
    logger.debug('Scheduling disconnect in five minutes because the voice channel is empty.');
    this.emptyTimer = setTimeout(() => {
      this.clear();
      this.connection?.destroy();
      this.connection = null;
      logger.info('Disconnected from an empty voice channel.');
    }, 5 * 60 * 1000);
    this.emptyTimer.unref?.();
  }

  cancelEmptyDisconnect() {
    if (this.emptyTimer) clearTimeout(this.emptyTimer);
    this.emptyTimer = null;
  }
}

function getQueue(guildId) {
  if (!queues.has(guildId)) queues.set(guildId, new GuildAudioQueue());
  return queues.get(guildId);
}

async function connectQueueToVoiceChannel(guild, channel) {
  const queue = getQueue(guild.id);
  const current = queue.connection;
  const disconnected = current?.state.status === VoiceConnectionStatus.Destroyed;
  const changedChannel = current && current.joinConfig.channelId !== channel.id;

  if (current && (disconnected || changedChannel)) {
    queue.stop();
    current.destroy();
    queue.connection = null;
  }

  if (!queue.connection) {
    queue.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    queue.connection.on('error', (error) => {
      logger.error({ guildId: guild.id, err: error }, 'Voice connection error; the library may retry.');
      if (error.code === 'ENOTFOUND') {
        logger.warn({ guildId: guild.id, hostname: error.hostname }, 'Could not resolve Discord voice host.');
      }
    });
    queue.connection.on('stateChange', (oldState, newState) => {
      logger.debug({ guildId: guild.id, from: oldState.status, to: newState.status }, 'Voice connection state changed.');
    });
    queue.attachPlayer();
  }

  try {
    await entersState(queue.connection, VoiceConnectionStatus.Ready, 20_000);
    queue.cancelEmptyDisconnect();
    return queue;
  } catch (error) {
    queue.connection?.destroy();
    queue.connection = null;
    throw error;
  }
}

module.exports = { getQueue, splitText, connectQueueToVoiceChannel };
