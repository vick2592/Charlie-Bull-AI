import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { registerHealthRoute } from './routes/health.js';
import { registerChatRoute } from './routes/chat.js';

async function buildServer() {
  const app = Fastify({ logger });
  await app.register(cors, {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true); // non-browser / curl
      if (config.allowedOrigins.includes('*') || config.allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Origin not allowed'), false);
      }
    }
  });

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
