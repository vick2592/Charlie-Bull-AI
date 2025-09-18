import Fastify from 'fastify';
import cors, { FastifyCorsOptions } from '@fastify/cors';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { registerHealthRoute } from './routes/health.js';
import { registerChatRoute } from './routes/chat.js';

async function buildServer() {
  // Cast logger to any to satisfy Fastify's logger generic expectations (pino v9 type mismatch workaround)
  const app = Fastify({ logger: logger as any });
  // Use allowedOrigins directly or wildcard; simpler type-safe config
  const corsOptions: FastifyCorsOptions = {
    origin: config.allowedOrigins.includes('*') ? true : config.allowedOrigins,
    credentials: false
  };
  await app.register(cors, corsOptions);

  registerHealthRoute(app);
  registerChatRoute(app);

  app.setErrorHandler((error: any, _req: any, reply: any) => {
    app.log.error({ err: error }, 'unhandled_error');
    if ((error as any).validation) {
      reply.status(400).send({ error: 'bad_request', message: 'Invalid request.' });
      return;
    }
    reply.status(500).send({ error: 'server_error', message: 'Temporary tail-chasing. Try again soon.' });
  });

  app.setNotFoundHandler((_req: any, reply: any) => {
    reply.status(404).send({ error: 'not_found', message: 'Route not found' });
  });

  return app;
}

async function start() {
  const app = await buildServer();
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info({ port: config.port }, 'server_started');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
