/**
 * Bluesky Client Service
 * Handles authentication and interactions with Bluesky (AT Protocol)
 */

import { AtpAgent, RichText } from '@atproto/api';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type { SocialPost, SocialInteraction, SocialReply } from '../types/social.js';

export class BlueskyClient {
  private agent: AtpAgent;
  private authenticated: boolean = false;

  constructor() {
    this.agent = new AtpAgent({
      service: config.blueskyService
    });
  }

  /**
   * Authenticate with Bluesky
   */
  async authenticate(): Promise<boolean> {
    if (!config.blueskyIdentifier || !config.blueskyPassword) {
      logger.warn('Bluesky credentials not configured');
      return false;
    }

    // Check for placeholder values
    if (config.blueskyIdentifier.includes('your-handle') || 
        config.blueskyPassword.includes('your-app-password')) {
      logger.warn({ 
        identifier: config.blueskyIdentifier 
      }, 'Bluesky credentials still using placeholder values. Please update deploy.env with real credentials.');
      return false;
    }

    try {
      logger.info({ identifier: config.blueskyIdentifier }, 'Attempting Bluesky authentication');
      await this.agent.login({
        identifier: config.blueskyIdentifier,
        password: config.blueskyPassword
      });
      this.authenticated = true;
      logger.info('Successfully authenticated with Bluesky');
      return true;
    } catch (error: any) {
      logger.error({ 
        error,
        identifier: config.blueskyIdentifier,
        errorMessage: error?.message,
        errorStatus: error?.status
      }, 'Failed to authenticate with Bluesky');
      this.authenticated = false;
      return false;
    }
  }

  /**
   * Ensure client is authenticated before operations
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.authenticated) {
      const success = await this.authenticate();
      if (!success) {
        throw new Error('Bluesky authentication failed');
      }
    }
  }

  /**
   * Create a post on Bluesky
   */
  async createPost(content: string): Promise<SocialPost | null> {
    await this.ensureAuthenticated();

    try {
      const rt = new RichText({ text: content });
      await rt.detectFacets(this.agent);

      const response = await this.agent.post({
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString()
      });

      logger.info({ uri: response.uri }, 'Posted to Bluesky');

      return {
        id: response.uri,
        platform: 'bluesky',
        content,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error({ error }, 'Failed to post to Bluesky');
      return null;
    }
  }

  /**
   * Reply to a post on Bluesky
   */
  async replyToPost(
    postUri: string,
    postCid: string,
    content: string
  ): Promise<SocialReply | null> {
    await this.ensureAuthenticated();

    try {
      const rt = new RichText({ text: content });
      await rt.detectFacets(this.agent);

      // Extract repo (DID) and rkey from URI
      const uriParts = postUri.split('/');
      const repo = uriParts[2];
      const rkey = uriParts[4];

      const response = await this.agent.post({
        text: rt.text,
        facets: rt.facets,
        reply: {
          root: { uri: postUri, cid: postCid },
          parent: { uri: postUri, cid: postCid }
        },
        createdAt: new Date().toISOString()
      });

      logger.info({ uri: response.uri, replyTo: postUri }, 'Replied on Bluesky');

      return {
        id: response.uri,
        platform: 'bluesky',
        replyToId: postUri,
        replyToHandle: repo,
        content,
        timestamp: new Date(),
        sent: true
      };
    } catch (error) {
      logger.error({ error }, 'Failed to reply on Bluesky');
      return null;
    }
  }

  /**
   * Fetch mentions and interactions
   */
  async fetchInteractions(): Promise<SocialInteraction[]> {
    await this.ensureAuthenticated();

    try {
      const notifications = await this.agent.listNotifications({ limit: 50 });
      const interactions: SocialInteraction[] = [];

      for (const notif of notifications.data.notifications) {
        // Only process mentions and replies
        if (notif.reason === 'mention' || notif.reason === 'reply') {
          const record = notif.record as any;
          
          interactions.push({
            id: notif.uri,
            platform: 'bluesky',
            type: notif.reason === 'mention' ? 'mention' : 'reply',
            authorHandle: notif.author.handle,
            authorId: notif.author.did,
            content: record.text || '',
            postId: notif.uri,
            timestamp: new Date(notif.indexedAt),
            processed: notif.isRead
          });
        }
      }

      logger.info(`Fetched ${interactions.length} interactions from Bluesky`);
      return interactions;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch Bluesky interactions');
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(timestamp: string): Promise<void> {
    await this.ensureAuthenticated();

    try {
      await this.agent.updateSeenNotifications(timestamp as `${string}-${string}-${string}T${string}:${string}:${string}Z`);
    } catch (error) {
      logger.error({ error }, 'Failed to mark notification as read');
    }
  }

  /**
   * Get account information
   */
  async getProfile() {
    await this.ensureAuthenticated();

    try {
      const profile = await this.agent.getProfile({
        actor: this.agent.session?.did || ''
      });
      return profile.data;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch Bluesky profile');
      return null;
    }
  }
}

// Singleton instance
export const blueskyClient = new BlueskyClient();
