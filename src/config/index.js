const dotenv = require('dotenv');
const { z } = require('zod');
const path = require('node:path');
const { TARGET_LANGUAGE_CODES } = require('../utils/languages');

dotenv.config();

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  return /^(1|true|yes|on)$/i.test(value.trim());
}, z.boolean());

const schema = z.object({
  DISCORD_TOKEN: z.string().trim().min(20),
  DISCORD_CLIENT_ID: z.string().trim().regex(/^\d{17,20}$/),
  DEEPL_AUTH_KEY: z.string().trim().min(10),
  TARGET_VOICE_LANG: z.string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => TARGET_LANGUAGE_CODES.has(value), 'Unsupported target language code.'),
  DB_PATH: z.string().trim().min(1).default('./app.db'),
  DISCORD_GUILD_ID: z.union([z.string().trim().regex(/^\d{17,20}$/), z.literal('')]).optional().transform((value) => value || undefined),
  DEBUG: booleanFromEnv.optional().default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n- ${problems.join('\n- ')}`);
}

module.exports = Object.freeze({
  ...parsed.data,
  DB_PATH: path.resolve(parsed.data.DB_PATH),
  LOG_LEVEL: parsed.data.DEBUG ? 'debug' : parsed.data.LOG_LEVEL,
});
