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
  
  // Track platform-specific reply counts
  private platformReplyCounts: Map<string, { bluesky: number; x: number }> = new Map();

  // Platform-specific limits
  // Bluesky allows 11,666 creates/day (3 points each), we use conservative limits
  // X FREE tier: 17/day + 100/month cap = must stay at ~3 posts/day!
  private readonly PLATFORM_LIMITS = {
    bluesky: {
      posts: 10,   // Conservative limit (max 11,666/day on Bluesky)
      replies: 20  // Well under Bluesky's 11,666/day limit
    },
    x: {
      posts: 1,    // X FREE tier: 1 scheduled post/day (random time)
      replies: 2   // X FREE tier: 2 replies/day (1 post + 2 replies = 3/day = 90/month)
    },
    global: {      // Global combined limit for scheduled posts only
      posts: 2,    // Bluesky gets 2/day (morning + afternoon/evening)
      replies: 2   // Match X's stricter monthly limit (100/month cap!)
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
    
    // Initialize platform-specific reply counts
    if (!this.platformReplyCounts.has(today)) {
      this.platformReplyCounts.set(today, { bluesky: 0, x: 0 });
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
   * Check if we can reply today (global quota)
   */
  canReply(): boolean {
    const quota = this.getDailyQuota();
    return quota.repliesCount < quota.repliesLimit;
  }
  
  /**
   * Check if we can reply on specific platform today
   */
  canReplyOnPlatform(platform: Platform): boolean {
    const today = this.getTodayString();
    this.initializeDailyQuota();
    const counts = this.platformReplyCounts.get(today)!;
    const limit = this.PLATFORM_LIMITS[platform].replies;
    return counts[platform] < limit;
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
   * Increment reply count (both global and platform-specific)
   */
  incrementReplyCount(platform?: Platform): void {
    const quota = this.getDailyQuota();
    quota.repliesCount++;
    
    // Also track platform-specific
    if (platform) {
      const today = this.getTodayString();
      const counts = this.platformReplyCounts.get(today)!;
      counts[platform]++;
      logger.info({ 
        platform,
        count: counts[platform], 
        limit: this.PLATFORM_LIMITS[platform].replies,
        globalCount: quota.repliesCount,
        globalLimit: quota.repliesLimit
      }, 'Incremented reply count');
    } else {
      logger.info({ count: quota.repliesCount, limit: quota.repliesLimit }, 'Incremented reply count');
    }
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
    
    // Reset platform-specific counts
    this.platformReplyCounts.set(today, { bluesky: 0, x: 0 });
    
    logger.info('Daily quota reset (global and platform-specific)');
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
