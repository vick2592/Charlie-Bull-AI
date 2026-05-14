import 'dotenv/config';
import { z } from 'zod';

const ConfigSchema = z.object({
  PORT: z.string().optional().default('8080'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_VERSION: z.string().optional().default('v1beta'),
  ALLOWED_ORIGINS: z.string().optional().default('http://localhost:3000'),
  GLOBAL_RATE_LIMIT: z.string().optional().default('100'),
  SESSION_RATE_LIMIT: z.string().optional().default('8'),
  WINDOW_SECONDS: z.string().optional().default('60'),
  MAX_TOKENS: z.string().optional().default('1024'),
  // Free-tier optimised chain (May 2026):
  //   gemini-3.1-flash-lite → 15 RPM (best free tier, GA since May 7, 2026)
  //   gemini-2.5-flash-lite → 10 RPM (fallback)
  // gemini-3.1-pro-preview has 0 RPM on free tier — omitted from default chain.
  // Upgrade to paid and add gemini-3.1-pro-preview as primary once rate limits allow.
  GEMINI_MODEL: z.string().optional().default('gemini-3.1-flash-lite'),
  GEMINI_MODELS: z.string().optional().default('gemini-3.1-flash-lite,gemini-2.5-flash-lite'),
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
  // Bluesky Configuration
  ,BLUESKY_IDENTIFIER: z.string().optional().default('')
  ,BLUESKY_PASSWORD: z.string().optional().default('')
  ,BLUESKY_SERVICE: z.string().optional().default('https://bsky.social')
  // X/Twitter Configuration
  ,X_API_KEY: z.string().optional().default('')
  ,X_API_SECRET: z.string().optional().default('')
  ,X_ACCESS_TOKEN: z.string().optional().default('')
  ,X_ACCESS_SECRET: z.string().optional().default('')
  ,X_BEARER_TOKEN: z.string().optional().default('')
  // Social Media Features
  ,SOCIAL_POSTS_ENABLED: z.string().optional().default('false')
  ,SOCIAL_REPLIES_ENABLED: z.string().optional().default('false')
  // Dev mode: logs error details verbosely but never posts error messages to social media
  ,SOCIAL_DEV_MODE: z.string().optional().default('false')
  // Admin API Key for write endpoints
  ,ADMIN_API_KEY: z.string().optional().default('')
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
  // Bluesky Configuration
  ,blueskyIdentifier: raw.BLUESKY_IDENTIFIER
  ,blueskyPassword: raw.BLUESKY_PASSWORD
  ,blueskyService: raw.BLUESKY_SERVICE
  // X/Twitter Configuration
  ,xApiKey: raw.X_API_KEY
  ,xApiSecret: raw.X_API_SECRET
  ,xAccessToken: raw.X_ACCESS_TOKEN
  ,xAccessSecret: raw.X_ACCESS_SECRET
  ,xBearerToken: raw.X_BEARER_TOKEN
  // Social Media Features
  ,socialPostsEnabled: raw.SOCIAL_POSTS_ENABLED.toLowerCase() === 'true'
  ,socialRepliesEnabled: raw.SOCIAL_REPLIES_ENABLED.toLowerCase() === 'true'
  ,socialDevMode: raw.SOCIAL_DEV_MODE.toLowerCase() === 'true'
  // Admin API Key
  ,adminApiKey: raw.ADMIN_API_KEY
};

export type AppConfig = typeof config;
