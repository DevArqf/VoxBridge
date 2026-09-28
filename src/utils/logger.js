const pino = require('pino');
const config = require('../config');

const debugEnabled = config.LOG_LEVEL === 'debug' || config.LOG_LEVEL === 'trace';
const baseLogger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'voxbridge' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(debugEnabled ? {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: Boolean(process.stdout.isTTY),
        levelFirst: true,
        messageFormat: '[VoxBridge] {msg}',
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname,service',
        singleLine: false,
        errorLikeObjectKeys: ['err', 'error'],
      },
    },
  } : {}),
  redact: {
    paths: [
      'authorization',
      'headers.authorization',
      'headers.Authorization',
      'config.headers.Authorization',
      'DISCORD_TOKEN',
      'DEEPL_AUTH_KEY',
    ],
    censor: '[REDACTED]',
  },
});

function safeError(error) {
  return {
    type: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    status: error.response?.status,
    responseMessage: error.response?.data?.message,
    traceId: error.response?.headers?.['x-trace-id'],
    hostname: error.hostname,
  };
}

function write(level, message, details) {
  if (typeof message === 'object' && message !== null) {
    const context = Object.fromEntries(Object.entries(message).map(([key, value]) => [
      key,
      value instanceof Error ? safeError(value) : value,
    ]));
    baseLogger[level](context, typeof details === 'string' ? details : undefined);
    return;
  }

  const context = details instanceof Error
    ? { err: safeError(details) }
    : details === undefined
      ? {}
      : { context: details };

  baseLogger[level](context, message);
}

module.exports = {
  enabled: debugEnabled,
  debug: (message, details) => write('debug', message, details),
  info: (message, details) => write('info', message, details),
  warn: (message, details) => write('warn', message, details),
  error: (message, details) => write('error', message, details),
};
