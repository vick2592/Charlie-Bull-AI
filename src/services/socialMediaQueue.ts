/**
 * Social Media Queue Manager
 * Manages pending interactions, posts, and daily quotas
 */

import { logger } from '../lib/logger.js';
import type {
  SocialInteraction,
  SocialPost,
  SocialReply,
  DailyQuota,
  Platform,
  RATE_LIMITS
} from '../types/social.js';

export class SocialMediaQueue {
  private pendingInteractions: SocialInteraction[] = [];
  private pendingPosts: SocialPost[] = [];
  private sentReplies: SocialReply[] = [];
  private dailyQuotas: Map<string, DailyQuota> = new Map();

  // Platform-specific limits
  private readonly PLATFORM_LIMITS = {
    bluesky: {
      posts: 4,    // Bluesky is more permissive
      replies: 5
    },
    x: {
      posts: 2,    // X has stricter limits (especially with basic tier)
      replies: 3
    },
    global: {      // Global combined limit for scheduled posts
      posts: 2,
      replies: 3
    }
  };

  constructor() {
    this.initializeDailyQuota();
  }

  /**
   * Initialize daily quota for today
   */
  private initializeDailyQuota(): void {
    const today = this.getTodayString();
    if (!this.dailyQuotas.has(today)) {
      this.dailyQuotas.set(today, {
        date: today,
        postsCount: 0,
        repliesCount: 0,
        postsLimit: this.PLATFORM_LIMITS.global.posts,
        repliesLimit: this.PLATFORM_LIMITS.global.replies
      });
      logger.info({ date: today }, 'Initialized daily quota');
    }
  }

  /**
   * Get today's date string (YYYY-MM-DD)
   */
  private getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get current daily quota
   */
  getDailyQuota(): DailyQuota {
    const today = this.getTodayString();
    this.initializeDailyQuota();
    return this.dailyQuotas.get(today)!;
  }

  /**
   * Check if we can post today
   */
  canPost(): boolean {
    const quota = this.getDailyQuota();
    return quota.postsCount < quota.postsLimit;
  }

  /**
   * Check if we can reply today
   */
  canReply(): boolean {
    const quota = this.getDailyQuota();
    return quota.repliesCount < quota.repliesLimit;
  }

  /**
   * Increment post count
   */
  incrementPostCount(): void {
    const quota = this.getDailyQuota();
    quota.postsCount++;
    logger.info({ count: quota.postsCount, limit: quota.postsLimit }, 'Incremented post count');
  }

  /**
   * Increment reply count
   */
  incrementReplyCount(): void {
    const quota = this.getDailyQuota();
    quota.repliesCount++;
    logger.info({ count: quota.repliesCount, limit: quota.repliesLimit }, 'Incremented reply count');
  }

  /**
   * Reset daily quota (called at midnight)
   */
  resetDailyQuota(): void {
    const today = this.getTodayString();
    this.dailyQuotas.set(today, {
      date: today,
      postsCount: 0,
      repliesCount: 0,
      postsLimit: this.PLATFORM_LIMITS.global.posts,
      repliesLimit: this.PLATFORM_LIMITS.global.replies
    });
    logger.info('Daily quota reset');
  }

  /**
   * Add interaction to pending queue
   */
  addPendingInteraction(interaction: SocialInteraction): void {
    // Check if already exists
    const exists = this.pendingInteractions.some(i => i.id === interaction.id);
    if (!exists) {
      this.pendingInteractions.push(interaction);
      logger.info({ 
        id: interaction.id, 
        platform: interaction.platform,
        type: interaction.type 
      }, 'Added pending interaction');
    }
  }

  /**
   * Get pending interactions
   */
  getPendingInteractions(platform?: Platform): SocialInteraction[] {
    if (platform) {
      return this.pendingInteractions.filter(i => i.platform === platform && !i.processed);
    }
    return this.pendingInteractions.filter(i => !i.processed);
  }

  /**
   * Mark interaction as processed
   */
  markInteractionProcessed(interactionId: string): void {
    const interaction = this.pendingInteractions.find(i => i.id === interactionId);
    if (interaction) {
      interaction.processed = true;
      logger.info({ id: interactionId }, 'Marked interaction as processed');
    }
  }

  /**
   * Add scheduled post
   */
  addScheduledPost(post: SocialPost): void {
    this.pendingPosts.push(post);
    logger.info({ 
      id: post.id, 
      platform: post.platform,
      scheduledFor: post.scheduledFor 
    }, 'Added scheduled post');
  }

  /**
   * Get posts ready to be sent
   */
  getReadyPosts(): SocialPost[] {
    const now = new Date();
    return this.pendingPosts.filter(post => {
      return post.scheduledFor && post.scheduledFor <= now;
    });
  }

  /**
   * Remove post from queue
   */
  removePost(postId: string): void {
    const index = this.pendingPosts.findIndex(p => p.id === postId);
    if (index > -1) {
      this.pendingPosts.splice(index, 1);
      logger.info({ id: postId }, 'Removed post from queue');
    }
  }

  /**
   * Add sent reply
   */
  addSentReply(reply: SocialReply): void {
    this.sentReplies.push(reply);
    logger.info({ id: reply.id, platform: reply.platform }, 'Added sent reply');
  }

  /**
   * Get stats for monitoring
   */
  getStats() {
    const quota = this.getDailyQuota();
    return {
      quota,
      pendingInteractions: this.pendingInteractions.filter(i => !i.processed).length,
      scheduledPosts: this.pendingPosts.length,
      sentRepliesToday: this.sentReplies.filter(r => {
        const today = this.getTodayString();
        const replyDate = r.timestamp.toISOString().split('T')[0];
        return replyDate === today;
      }).length
    };
  }

  /**
   * Clean up old data (keep last 7 days)
   */
  cleanup(): void {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];

    // Clean old quotas
    for (const [date] of this.dailyQuotas) {
      if (date < cutoffDate) {
        this.dailyQuotas.delete(date);
      }
    }

    // Clean old processed interactions
    this.pendingInteractions = this.pendingInteractions.filter(i => {
      return !i.processed || i.timestamp > sevenDaysAgo;
    });

    // Clean old replies
    this.sentReplies = this.sentReplies.filter(r => r.timestamp > sevenDaysAgo);

    logger.info('Cleaned up old queue data');
  }
}

// Singleton instance
export const socialMediaQueue = new SocialMediaQueue();
