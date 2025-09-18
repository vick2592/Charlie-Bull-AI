import 'dotenv/config';
import { z } from 'zod';

const ConfigSchema = z.object({
  PORT: z.string().optional().default('8080'),
  GEMINI_API_KEY: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional().default('http://localhost:3000'),
  GLOBAL_RATE_LIMIT: z.string().optional().default('100'),
  SESSION_RATE_LIMIT: z.string().optional().default('8'),
  WINDOW_SECONDS: z.string().optional().default('60'),
  MAX_TOKENS: z.string().optional().default('1024')
});

const raw = ConfigSchema.parse(process.env);

export const config = {
  port: parseInt(raw.PORT, 10),
  geminiApiKey: raw.GEMINI_API_KEY,
  allowedOrigins: raw.ALLOWED_ORIGINS.split(',').map(o => o.trim()),
  globalRateLimit: parseInt(raw.GLOBAL_RATE_LIMIT, 10),
  sessionRateLimit: parseInt(raw.SESSION_RATE_LIMIT, 10),
  windowSeconds: parseInt(raw.WINDOW_SECONDS, 10),
  maxTokens: parseInt(raw.MAX_TOKENS, 10)
};

export type AppConfig = typeof config;
