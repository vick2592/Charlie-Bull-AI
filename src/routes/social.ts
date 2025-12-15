/**
 * Social Media Management Routes
 * Endpoints for monitoring and managing social media integrations
 */

import type { FastifyInstance } from 'fastify';
import { socialMediaScheduler } from '../services/socialMediaScheduler.js';
import { socialMediaQueue } from '../services/socialMediaQueue.js';
import { blueskyClient } from '../services/blueskyClient.js';
import { xClient } from '../services/xClient.js';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';

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
