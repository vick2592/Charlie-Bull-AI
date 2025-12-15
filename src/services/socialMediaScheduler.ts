/**
 * Social Media Scheduler
 * Manages cron jobs for automated posting and interaction processing
 */

import cron from 'node-cron';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import { socialMediaQueue } from './socialMediaQueue.js';
import { blueskyClient } from './blueskyClient.js';
import { xClient } from './xClient.js';
import { generateWithGemini } from './geminiClient.js';
import { DEFAULT_SCHEDULE } from '../types/social.js';
import type { Platform } from '../types/social.js';

export class SocialMediaScheduler {
  private jobs: cron.ScheduledTask[] = [];
  private currentAfternoonIndex = 0; // For alternating 5pm/9pm

  /**
   * Initialize all scheduled jobs
   */
  async initialize(): Promise<void> {
    if (!config.socialPostsEnabled && !config.socialRepliesEnabled) {
      logger.info('Social media features disabled');
      return;
    }

    logger.info('Initializing social media scheduler');

    // Authenticate clients
    if (config.blueskyIdentifier && config.blueskyPassword) {
      await blueskyClient.authenticate();
    }

    if (config.xApiKey && config.xAccessToken) {
      await xClient.authenticate();
    }

    // Schedule queue processing at midnight (00:00)
    this.scheduleQueueProcessing();

    // Schedule morning post (08:00)
    this.scheduleMorningPost();

    // Schedule afternoon/evening post (alternating 17:00 and 21:00)
    this.scheduleAfternoonPost();

    // Schedule interaction checking (every 30 minutes)
    this.scheduleInteractionCheck();

    // Schedule cleanup (daily at 01:00)
    this.scheduleCleanup();

    logger.info('Social media scheduler initialized');
  }

  /**
   * Schedule queue processing at midnight
   */
  private scheduleQueueProcessing(): void {
    const job = cron.schedule('0 0 * * *', async () => {
      logger.info('Running midnight queue processing');
      await this.processQueueAtMidnight();
    });

    this.jobs.push(job);
    logger.info('Scheduled queue processing at midnight');
  }

  /**
   * Schedule morning post at 8 AM
   */
  private scheduleMorningPost(): void {
    const job = cron.schedule('0 8 * * *', async () => {
      logger.info('Running morning post');
      await this.createScheduledPost('morning');
    });

    this.jobs.push(job);
    logger.info('Scheduled morning post at 8:00 AM');
  }

  /**
   * Schedule afternoon post (alternating 5 PM and 9 PM)
   */
  private scheduleAfternoonPost(): void {
    // Schedule at 5 PM
    const job5pm = cron.schedule('0 17 * * *', async () => {
      if (this.currentAfternoonIndex === 0) {
        logger.info('Running afternoon post at 5 PM');
        await this.createScheduledPost('afternoon');
        this.currentAfternoonIndex = 1;
      }
    });

    // Schedule at 9 PM
    const job9pm = cron.schedule('0 21 * * *', async () => {
      if (this.currentAfternoonIndex === 1) {
        logger.info('Running evening post at 9 PM');
        await this.createScheduledPost('evening');
        this.currentAfternoonIndex = 0;
      }
    });

    this.jobs.push(job5pm, job9pm);
    logger.info('Scheduled afternoon/evening posts (alternating 5 PM and 9 PM)');
  }

  /**
   * Schedule interaction checking every 30 minutes
   */
  private scheduleInteractionCheck(): void {
    const job = cron.schedule('*/30 * * * *', async () => {
      logger.info('Checking for new interactions');
      await this.checkInteractions();
    });

    this.jobs.push(job);
    logger.info('Scheduled interaction checking every 30 minutes');
  }

  /**
   * Schedule daily cleanup at 1 AM
   */
  private scheduleCleanup(): void {
    const job = cron.schedule('0 1 * * *', () => {
      logger.info('Running daily cleanup');
      socialMediaQueue.cleanup();
    });

    this.jobs.push(job);
    logger.info('Scheduled daily cleanup at 1:00 AM');
  }

  /**
   * Process pending interactions at midnight
   */
  private async processQueueAtMidnight(): Promise<void> {
    try {
      // Reset daily quota
      socialMediaQueue.resetDailyQuota();

      // Process pending interactions (up to 3 replies)
      const pendingInteractions = socialMediaQueue.getPendingInteractions();
      logger.info({ count: pendingInteractions.length }, 'Processing pending interactions');

      for (const interaction of pendingInteractions.slice(0, 3)) {
        if (!socialMediaQueue.canReply()) {
          logger.info('Daily reply limit reached');
          break;
        }

        await this.respondToInteraction(interaction);
      }
    } catch (error) {
      logger.error({ error }, 'Error processing queue at midnight');
    }
  }

  /**
   * Create a scheduled post
   */
  private async createScheduledPost(timeOfDay: 'morning' | 'afternoon' | 'evening'): Promise<void> {
    try {
      if (!socialMediaQueue.canPost()) {
        logger.info('Daily post limit reached');
        return;
      }

      // Generate content using Gemini
      const content = await this.generatePostContent(timeOfDay);
      if (!content) {
        logger.warn('Failed to generate post content');
        return;
      }

      // Post to Bluesky first (for testing)
      if (config.blueskyIdentifier) {
        const post = await blueskyClient.createPost(content);
        if (post) {
          socialMediaQueue.incrementPostCount();
        }
      }

      // Post to X if enabled
      if (config.xApiKey && config.socialPostsEnabled) {
        const post = await xClient.createPost(content);
        if (post) {
          // Only increment if not already incremented by Bluesky
          if (!config.blueskyIdentifier) {
            socialMediaQueue.incrementPostCount();
          }
        }
      }

      logger.info({ timeOfDay, content }, 'Posted scheduled content');
    } catch (error) {
      logger.error({ error }, 'Error creating scheduled post');
    }
  }

  /**
   * Check for new interactions
   */
  private async checkInteractions(): Promise<void> {
    try {
      // Fetch from Bluesky
      if (config.blueskyIdentifier) {
        const bskyInteractions = await blueskyClient.fetchInteractions();
        for (const interaction of bskyInteractions) {
          socialMediaQueue.addPendingInteraction(interaction);
        }
      }

      // Fetch from X
      if (config.xApiKey) {
        const xInteractions = await xClient.fetchInteractions();
        for (const interaction of xInteractions) {
          socialMediaQueue.addPendingInteraction(interaction);
        }
      }

      // Process immediate replies if quota allows
      const pending = socialMediaQueue.getPendingInteractions().slice(0, 3);
      for (const interaction of pending) {
        if (!socialMediaQueue.canReply()) break;
        await this.respondToInteraction(interaction);
      }
    } catch (error) {
      logger.error({ error }, 'Error checking interactions');
    }
  }

  /**
   * Generate post content using Gemini
   */
  private async generatePostContent(timeOfDay: string): Promise<string | null> {
    try {
      const prompt = `Generate a short, engaging social media post for Charlie Bull token. 
Time of day: ${timeOfDay}. 
Keep it under 280 characters.
Be friendly, informative, and community-focused.
Don't use hashtags excessively.`;

      const response = await generateWithGemini([
        { role: 'user', content: prompt }
      ]);
      return response.text || null;
    } catch (error) {
      logger.error({ error }, 'Error generating post content');
      return null;
    }
  }

  /**
   * Respond to an interaction
   */
  private async respondToInteraction(interaction: any): Promise<void> {
    try {
      // Generate reply using Gemini
      const replyContent = await this.generateReplyContent(interaction.content);
      if (!replyContent) {
        logger.warn({ interactionId: interaction.id }, 'Failed to generate reply');
        return;
      }

      let success = false;

      // Send reply
      if (interaction.platform === 'bluesky') {
        const reply = await blueskyClient.replyToPost(
          interaction.postId,
          interaction.id, // CID
          replyContent
        );
        success = !!reply;
      } else if (interaction.platform === 'x') {
        const reply = await xClient.replyToPost(
          interaction.postId,
          replyContent
        );
        success = !!reply;
      }

      if (success) {
        socialMediaQueue.markInteractionProcessed(interaction.id);
        socialMediaQueue.incrementReplyCount();
        logger.info({ interactionId: interaction.id }, 'Replied to interaction');
      }
    } catch (error) {
      logger.error({ error, interactionId: interaction.id }, 'Error responding to interaction');
    }
  }

  /**
   * Generate reply content using Gemini
   */
  private async generateReplyContent(originalMessage: string): Promise<string | null> {
    try {
      const prompt = `You received this message on social media: "${originalMessage}"
Generate a friendly, helpful reply as Charlie Bull.
Keep it under 280 characters.
Be engaging and professional.`;

      const response = await generateWithGemini([
        { role: 'user', content: prompt }
      ]);
      return response.text || null;
    } catch (error) {
      logger.error({ error }, 'Error generating reply content');
      return null;
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    logger.info('Stopped all scheduled jobs');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      jobsRunning: this.jobs.length,
      currentAfternoonIndex: this.currentAfternoonIndex,
      nextAfternoonTime: this.currentAfternoonIndex === 0 ? '17:00' : '21:00',
      queueStats: socialMediaQueue.getStats()
    };
  }
}

// Singleton instance
export const socialMediaScheduler = new SocialMediaScheduler();
