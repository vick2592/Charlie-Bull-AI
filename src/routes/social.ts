/**
 * Social Media Management Routes
 * Endpoints for monitoring and managing social media integrations
 */

import type { FastifyInstance } from 'fastify';
import { socialMediaScheduler } from '../services/socialMediaScheduler.js';
import { socialMediaQueue } from '../services/socialMediaQueue.js';
import { blueskyClient } from '../services/blueskyClient.js';
import { xClient } from '../services/xClient.js';
import { generateWithGemini } from '../services/geminiClient.js';
import { formatForX } from '../services/responseFormatter.js';
import { knowledgeBase } from '../services/knowledgeBase.js';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';

/**
 * Verify admin API key for write endpoints
 */
function requireAdminKey(request: any, reply: any): boolean {
  if (!config.adminApiKey) return true; // No key configured = open (backwards compat)
  const authHeader = request.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${config.adminApiKey}`) {
    reply.status(401).send({ error: 'Unauthorized - set ADMIN_API_KEY env var and pass as Bearer token' });
    return false;
  }
  return true;
}

export async function socialRoutes(fastify: FastifyInstance) {
  /**
   * Get social media status
   */
  fastify.get('/social/status', async (request, reply) => {
    try {
      const schedulerStatus = socialMediaScheduler.getStatus();
      const queueStats = socialMediaQueue.getStats();

      return {
        enabled: {
          posts: config.socialPostsEnabled,
          replies: config.socialRepliesEnabled
        },
        platforms: {
          bluesky: !!config.blueskyIdentifier,
          x: !!config.xApiKey
        },
        scheduler: schedulerStatus,
        queue: queueStats
      };
    } catch (error) {
      logger.error({ error }, 'Error fetching social status');
      reply.status(500).send({ error: 'Failed to fetch status' });
    }
  });

  /**
   * Get daily quota information
   */
  fastify.get('/social/quota', async (request, reply) => {
    try {
      const quota = socialMediaQueue.getDailyQuota();
      return quota;
    } catch (error) {
      logger.error({ error }, 'Error fetching quota');
      reply.status(500).send({ error: 'Failed to fetch quota' });
    }
  });

  /**
   * Test Bluesky post (development only)
   */
  fastify.post('/social/test/bluesky', async (request, reply) => {
    if (!requireAdminKey(request, reply)) return;
    try {
      const { content } = request.body as { content?: string };

      if (!content) {
        return reply.status(400).send({ error: 'Content is required' });
      }

      if (!config.blueskyIdentifier) {
        return reply.status(400).send({ error: 'Bluesky not configured' });
      }

      const post = await blueskyClient.createPost(content);
      
      if (post) {
        return { success: true, post };
      } else {
        return reply.status(500).send({ error: 'Failed to create post' });
      }
    } catch (error) {
      logger.error({ error }, 'Error testing Bluesky post');
      reply.status(500).send({ error: 'Failed to test post' });
    }
  });

  /**
   * Test X post (development only)
   */
  fastify.post('/social/test/x', async (request, reply) => {
    if (!requireAdminKey(request, reply)) return;
    try {
      const { content } = request.body as { content?: string };
      
      if (!content) {
        return reply.status(400).send({ error: 'Content is required' });
      }

      if (!config.xApiKey) {
        return reply.status(400).send({ error: 'X/Twitter not configured' });
      }

      const post = await xClient.createPost(content);
      
      if (post) {
        return { success: true, post };
      } else {
        return reply.status(500).send({ error: 'Failed to create post' });
      }
    } catch (error) {
      logger.error({ error }, 'Error testing X post');
      reply.status(500).send({ error: 'Failed to test post' });
    }
  });

  /**
   * Manually check for interactions
   */
  fastify.post('/social/check-interactions', async (request, reply) => {
    if (!requireAdminKey(request, reply)) return;
    try {
      const bskyInteractions = config.blueskyIdentifier 
        ? await blueskyClient.fetchInteractions()
        : [];
      
      const xInteractions = config.xApiKey
        ? await xClient.fetchInteractions()
        : [];

      for (const interaction of [...bskyInteractions, ...xInteractions]) {
        socialMediaQueue.addPendingInteraction(interaction);
      }

      return {
        success: true,
        fetched: {
          bluesky: bskyInteractions.length,
          x: xInteractions.length
        }
      };
    } catch (error) {
      logger.error({ error }, 'Error checking interactions');
      reply.status(500).send({ error: 'Failed to check interactions' });
    }
  });

  /**
   * Manual reply to a tweet (works on free tier)
   * Since free tier can't read mentions via userMentionTimeline,
   * this lets you reply to specific tweets by providing the tweetId.
   * If no content is provided, generates a reply using Gemini.
   */
  fastify.post('/social/reply/x', async (request, reply) => {
    if (!requireAdminKey(request, reply)) return;
    try {
      const { tweetId, content, originalMessage } = request.body as {
        tweetId: string;
        content?: string;
        originalMessage?: string;
      };

      if (!tweetId || !/^\d{1,20}$/.test(tweetId)) {
        return reply.status(400).send({ error: 'tweetId is required and must be a numeric string' });
      }

      if (!config.xApiKey) {
        return reply.status(400).send({ error: 'X/Twitter not configured' });
      }

      if (!socialMediaQueue.canReplyOnPlatform('x')) {
        return reply.status(429).send({ error: 'Daily X reply quota reached (1/day)' });
      }

      let replyContent: string | undefined;

      if (content) {
        // Raw content provided - enforce length limit and always format
        if (content.length > 500) {
          return reply.status(400).send({ error: 'Content too long (max 500 chars)' });
        }
        const formatted = formatForX(content);
        replyContent = formatted.text;
      } else if (originalMessage) {
        // Generate reply with Gemini from the original tweet text
        const sanitized = originalMessage.slice(0, 300).replace(/"/g, "'");
        const { project } = knowledgeBase;
        const maxContentChars = 269; // 300 - signature length

        const prompt = `You received this message on X/Twitter: "${sanitized}"

You are Charlie Bull, a playful puppy mascot for a cross-chain cryptocurrency project.

About Charlie Bull:
- ${project.description}
- Cross-chain token across 9+ blockchains

CRITICAL: Reply must be ${maxContentChars} characters or LESS. No emojis, no sign-off.

Generate ONLY the reply text:`;

        const response = await generateWithGemini([
          { role: 'user', content: prompt }
        ]);
        const formatted = formatForX((response.text || '').trim());
        replyContent = formatted.text;
      }

      if (!replyContent) {
        return reply.status(400).send({ error: 'Either content or originalMessage is required' });
      }

      const result = await xClient.replyToPost(tweetId, replyContent);

      if (result) {
        socialMediaQueue.incrementReplyCount('x');
        logger.info({ tweetId, replyId: result.id }, 'Manual reply sent on X');
        return { success: true, reply: result };
      } else {
        return reply.status(500).send({ error: 'Failed to send reply' });
      }
    } catch (error) {
      logger.error({ error }, 'Error sending manual X reply');
      reply.status(500).send({ error: 'Failed to send reply' });
    }
  });

  /**
   * Get X API tier status
   */
  fastify.get('/social/x/tier', async (request, reply) => {
    try {
      return {
        freeTierLimited: xClient.isFreeTierLimited(),
        configured: !!config.xApiKey,
        canPost: socialMediaQueue.canPostOnPlatform('x'),
        canReply: socialMediaQueue.canReplyOnPlatform('x'),
        note: xClient.isFreeTierLimited()
          ? 'Free tier detected - userMentionTimeline unavailable. Use POST /api/social/reply/x for manual replies.'
          : 'Full API access or not yet determined (first mention fetch will detect tier).'
      };
    } catch (error) {
      logger.error({ error }, 'Error fetching X tier status');
      reply.status(500).send({ error: 'Failed to fetch tier status' });
    }
  });

  /**
   * Get pending interactions
   */
  fastify.get('/social/interactions/pending', async (request, reply) => {
    try {
      const interactions = socialMediaQueue.getPendingInteractions();
      return {
        count: interactions.length,
        interactions: interactions.map(i => ({
          id: i.id,
          platform: i.platform,
          type: i.type,
          author: i.authorHandle,
          content: i.content.substring(0, 100),
          timestamp: i.timestamp,
          processed: i.processed
        }))
      };
    } catch (error) {
      logger.error({ error }, 'Error fetching pending interactions');
      reply.status(500).send({ error: 'Failed to fetch interactions' });
    }
  });
}
