/**
 * X (Twitter) Client Service
 * Handles authentication and interactions with X/Twitter API v2
 */

import { TwitterApi } from 'twitter-api-v2';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type { SocialPost, SocialInteraction, SocialReply } from '../types/social.js';

export class XClient {
  private client: TwitterApi | null = null;
  private authenticated: boolean = false;

  constructor() {
    // Constructor will initialize when credentials are available
  }

  /**
   * Authenticate with X/Twitter
   */
  async authenticate(): Promise<boolean> {
    if (!config.xApiKey || !config.xApiSecret || !config.xAccessToken || !config.xAccessSecret) {
      logger.warn('X/Twitter credentials not configured');
      return false;
    }

    // Check for placeholder values
    if (config.xApiKey.includes('your-api-key') || 
        config.xAccessToken.includes('your-access-token')) {
      logger.warn('X/Twitter credentials still using placeholder values. Skipping X integration.');
      return false;
    }

    try {
      this.client = new TwitterApi({
        appKey: config.xApiKey,
        appSecret: config.xApiSecret,
        accessToken: config.xAccessToken,
        accessSecret: config.xAccessSecret,
      });

      // Verify credentials
      const user = await this.client.v2.me();
      this.authenticated = true;
      logger.info({ username: user.data.username }, 'Successfully authenticated with X/Twitter');
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to authenticate with X/Twitter');
      this.authenticated = false;
      return false;
    }
  }

  /**
   * Ensure client is authenticated before operations
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.authenticated || !this.client) {
      const success = await this.authenticate();
      if (!success) {
        throw new Error('X/Twitter authentication failed');
      }
    }
  }

  /**
   * Create a tweet on X/Twitter
   */
  async createPost(content: string): Promise<SocialPost | null> {
    await this.ensureAuthenticated();

    try {
      const tweet = await this.client!.v2.tweet(content);
      
      logger.info({ tweetId: tweet.data.id }, 'Posted to X/Twitter');

      return {
        id: tweet.data.id,
        platform: 'x',
        content,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error({ error }, 'Failed to post to X/Twitter');
      return null;
    }
  }

  /**
   * Reply to a tweet on X/Twitter
   */
  async replyToPost(
    tweetId: string,
    content: string
  ): Promise<SocialReply | null> {
    await this.ensureAuthenticated();

    try {
      const reply = await this.client!.v2.reply(content, tweetId);

      logger.info({ tweetId: reply.data.id, replyTo: tweetId }, 'Replied on X/Twitter');

      return {
        id: reply.data.id,
        platform: 'x',
        replyToId: tweetId,
        replyToHandle: '', // Would need to fetch from original tweet
        content,
        timestamp: new Date(),
        sent: true
      };
    } catch (error) {
      logger.error({ error }, 'Failed to reply on X/Twitter');
      return null;
    }
  }

  /**
   * Fetch mentions and interactions
   * Note: X FREE tier has 100 posts/month retrieval cap!
   * Fetching only 2 most recent = 2 posts/day × 31 = 62 posts/month (under 100 limit)
   */
  async fetchInteractions(): Promise<SocialInteraction[]> {
    await this.ensureAuthenticated();

    try {
      const me = await this.client!.v2.me();
      const mentions = await this.client!.v2.userMentionTimeline(me.data.id, {
        max_results: 2,  // FREE tier: 100 posts/month cap! Limit to 2 most recent mentions
        expansions: ['author_id', 'referenced_tweets.id'],
        'tweet.fields': ['created_at', 'conversation_id']
      });

      const interactions: SocialInteraction[] = [];

      for (const tweet of mentions.data.data || []) {
        interactions.push({
          id: tweet.id,
          platform: 'x',
          type: 'mention',
          authorHandle: tweet.author_id || '',
          authorId: tweet.author_id || '',
          content: tweet.text,
          postId: tweet.id,
          timestamp: new Date(tweet.created_at || Date.now()),
          processed: false
        });
      }

      logger.info(`Fetched ${interactions.length} interactions from X/Twitter`);
      return interactions;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch X/Twitter interactions');
      return [];
    }
  }

  /**
   * Get account information
   */
  async getProfile() {
    await this.ensureAuthenticated();

    try {
      const user = await this.client!.v2.me();
      return user.data;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch X/Twitter profile');
      return null;
    }
  }
}

// Singleton instance
export const xClient = new XClient();
