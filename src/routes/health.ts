import { FastifyInstance } from 'fastify';

export function registerHealthRoute(app: FastifyInstance) {
  app.get('/healthz', async () => {
    return { status: 'ok' };
  });
}
