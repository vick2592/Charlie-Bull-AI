import { FastifyInstance } from 'fastify';

export function registerHealthRoute(app: FastifyInstance) {
  // Health check at /api/health for consistency
  app.get('/api/health', async () => {
    return { status: 'ok' };
  });
  
  // Legacy endpoint for backwards compatibility
  app.get('/healthz', async () => {
    return { status: 'ok' };
  });
}
