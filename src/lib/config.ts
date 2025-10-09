import 'dotenv/config';
import { z } from 'zod';

const ConfigSchema = z.object({
  PORT: z.string().optional().default('8080'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_VERSION: z.string().optional().default('v1'),
  ALLOWED_ORIGINS: z.string().optional().default('http://localhost:3000'),
  GLOBAL_RATE_LIMIT: z.string().optional().default('100'),
  SESSION_RATE_LIMIT: z.string().optional().default('8'),
  WINDOW_SECONDS: z.string().optional().default('60'),
  MAX_TOKENS: z.string().optional().default('1024'),
  // Use currently published GA model names with -latest suffixes to avoid versioned deprecation 404s.
  GEMINI_MODEL: z.string().optional().default('gemini-1.5-pro-latest'),
  GEMINI_MODELS: z.string().optional().default('gemini-1.5-pro-latest,gemini-1.5-flash-latest,gemini-1.5-flash-8b-latest'),
  CHARLIE_NAME: z.string().optional().default('Charlie'),
  CHARLIE_CREATOR: z.string().optional().default('Charlie Bull'),
  CHARLIE_PERSONA_EXTRA: z.string().optional().default('')
  ,CHAR_TOKEN_ADDRESS: z.string().optional().default('')
  ,BULL_TOKEN_ADDRESS: z.string().optional().default('')
  ,TOKENOMICS_EXTRA: z.string().optional().default('')
  ,TELEGRAM_BOT_TOKEN: z.string().optional().default('')
  ,TELEGRAM_ALLOWED_USER_IDS: z.string().optional().default('')
  ,TELEGRAM_ALLOWED_CHAT_IDS: z.string().optional().default('')
  ,TELEGRAM_POLLING: z.string().optional().default('false')
});

const raw = ConfigSchema.parse(process.env);

export const config = {
  port: parseInt(raw.PORT, 10),
  geminiApiKey: raw.GEMINI_API_KEY,
  geminiApiVersion: raw.GEMINI_API_VERSION,
  allowedOrigins: raw.ALLOWED_ORIGINS.split(',').map(o => o.trim()),
  globalRateLimit: parseInt(raw.GLOBAL_RATE_LIMIT, 10),
  sessionRateLimit: parseInt(raw.SESSION_RATE_LIMIT, 10),
  windowSeconds: parseInt(raw.WINDOW_SECONDS, 10),
  maxTokens: parseInt(raw.MAX_TOKENS, 10),
  geminiModel: raw.GEMINI_MODEL,
  geminiModels: raw.GEMINI_MODELS.split(',').map(m => m.trim()).filter(Boolean),
  charlieName: raw.CHARLIE_NAME,
  charlieCreator: raw.CHARLIE_CREATOR,
  charliePersonaExtra: raw.CHARLIE_PERSONA_EXTRA
  ,charTokenAddress: raw.CHAR_TOKEN_ADDRESS
  ,bullTokenAddress: raw.BULL_TOKEN_ADDRESS
  ,tokenomicsExtra: raw.TOKENOMICS_EXTRA
  ,telegramBotToken: raw.TELEGRAM_BOT_TOKEN
  ,telegramAllowedUserIds: raw.TELEGRAM_ALLOWED_USER_IDS.split(',').map(s => s.trim()).filter(Boolean)
  ,telegramAllowedChatIds: raw.TELEGRAM_ALLOWED_CHAT_IDS.split(',').map(s => s.trim()).filter(Boolean)
  ,telegramPolling: raw.TELEGRAM_POLLING.toLowerCase() === 'true'
};

export type AppConfig = typeof config;
