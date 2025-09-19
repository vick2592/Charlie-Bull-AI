import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

// Use lazy transport init to avoid resolution issues with ESM loader
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isProd ? {} : {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' }
    }
  })
});
