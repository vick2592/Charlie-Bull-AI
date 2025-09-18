import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { memoryStore } from '../services/memoryStore.js';
import { safetyCheck, safetyRefusal } from '../services/safety.js';
import { buildPrompt } from '../services/persona.js';
import { generateWithGemini } from '../services/geminiClient.js';
import { SlidingWindowRateLimiter } from '../services/rateLimiter.js';
import { config } from '../lib/config.js';
import { ensureDogEmoji } from '../services/persona.js';

const bodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  message: z.string().min(1).max(300),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(2000)
  })).optional()
});

const limiter = new SlidingWindowRateLimiter(
  config.sessionRateLimit,
  config.globalRateLimit,
  config.windowSeconds * 1000
);

export function registerChatRoute(app: FastifyInstance) {
  app.post('/v1/chat', async (req, reply) => {
    const start = Date.now();
    const parse = bodySchema.safeParse(req.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'bad_request', message: 'Invalid request body.' });
    }
    const { sessionId, message, history = [] } = parse.data;

    // Rate limiting
    const r = limiter.attempt(sessionId);
    if (!r.allowed) {
      return reply.status(429).send({ error: 'rate_limited', message: 'Rate limit exceeded. Please wait.', retryAfter: r.retryAfter });
    }

    // Safety check
    const safe = safetyCheck(message);
    if (!safe.allowed) {
      return reply.status(400).send({ error: 'filtered', message: safetyRefusal() });
    }

    // Retrieve + prune memory
    const { messages: prior, truncated } = memoryStore.prune(sessionId);
    // Merge prior server memory with provided frontend history (trust server memory first)
    const mergedHistory = [...prior, ...history];

    const { messages: promptMessages } = buildPrompt(mergedHistory, message);

    const gen = await generateWithGemini(promptMessages);
    const assistantMessage = ensureDogEmoji(gen.text);

    // Persist user + assistant messages
    memoryStore.append(sessionId, [
      { role: 'user', content: message },
      { role: 'assistant', content: assistantMessage }
    ]);

    const latencyMs = Date.now() - start;
    return reply.send({
      message: assistantMessage,
      meta: { truncation: truncated, latencyMs }
    });
  });
}
