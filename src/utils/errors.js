const logger = require('./logger');

class AppError extends Error {
  constructor(code, userMessage, cause) {
    super(userMessage, { cause });
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

function withDatabaseError(context, operation) {
  try {
    return operation();
  } catch (error) {
    logger.error(`Database operation failed: ${context}`, error);
    throw new AppError('DATABASE_ERROR', 'VoxBridge storage is temporarily unavailable.', error);
  }
}

async function withExternalError(context, operation) {
  try {
    return await operation();
  } catch (error) {
    logger.error(`External service operation failed: ${context}`, error);
    const status = error.response?.status;
    const userMessage = status === 429
      ? 'The translation or speech service is rate-limited. Please try again shortly.'
      : 'The translation or speech service is temporarily unavailable. Please try again.';
    throw new AppError('EXTERNAL_SERVICE_ERROR', userMessage, error);
  }
}

function userFacingMessage(error, fallback = 'VoxBridge could not complete that request.') {
  if (error instanceof AppError) return error.userMessage;
  if (error?.code === 'INVALID_INPUT') return error.message;
  return fallback;
}

module.exports = { AppError, withDatabaseError, withExternalError, userFacingMessage };
