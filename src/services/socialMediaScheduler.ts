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
import { generateContextualResponse, formatForX, formatForBluesky } from './responseFormatter.js';
import { knowledgeBase } from './knowledgeBase.js';
import { DEFAULT_SCHEDULE } from '../types/social.js';
import type { Platform } from '../types/social.js';

export class SocialMediaScheduler {
  private jobs: cron.ScheduledTask[] = [];
  private currentAfternoonIndex = 0; // For alternating 5pm/9pm
  private dailyXPostTime: 'morning' | 'afternoon' | 'evening' | null = null; // Random daily X post time

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

    // Pick random X post time for today
    this.pickDailyXPostTime();

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
   * Pick a random time slot for X's daily post (morning, afternoon, or evening)
   * X FREE tier limits: 17/day + 100/month cap
   * Strategy: 1 post + 2 replies/day = 3/day = 90/month (under 100 cap!)
   */
  private pickDailyXPostTime(): void {
    const times: ('morning' | 'afternoon' | 'evening')[] = ['morning', 'afternoon', 'evening'];
    this.dailyXPostTime = times[Math.floor(Math.random() * times.length)];
    logger.info({ xPostTime: this.dailyXPostTime }, 'Selected random X post time for today');
  }

  /**
   * Schedule queue processing at midnight
   */
  private scheduleQueueProcessing(): void {
    const job = cron.schedule('0 0 * * *', async () => {
      logger.info('Running midnight queue processing');
      await this.processQueueAtMidnight();
      
      // Pick new random time for X posts
      this.pickDailyXPostTime();
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
   * Schedule interaction checking
   * Bluesky: Every 15 minutes (11,666/day limit - very generous)
   * X FREE tier: Once per day at noon (100 calls/month total limit!)
   */
  private scheduleInteractionCheck(): void {
    // Check Bluesky + process Bluesky interactions every 15 minutes
    const job = cron.schedule('*/15 * * * *', async () => {
      logger.info('Checking for new Bluesky interactions');
      await this.checkBlueskyInteractions();
      await this.processInteractions('bluesky');
    });

    // Check X once per day at noon EST (12:00 PM) - FREE tier has 100 calls/month!
    // 1 check/day × 1 API call (cached userId) + 1 post/day = 2 calls/day = 62 calls/month
    const xJob = cron.schedule('0 12 * * *', async () => {
      logger.info('Checking for X interactions (once daily at noon to stay under 100/month quota)');
      await this.checkXInteractions();
      await this.processInteractions('x');
    });

    this.jobs.push(job, xJob);
    logger.info('Scheduled interaction checking (Bluesky: every 15min, X: daily at noon)');
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

      // Process pending interactions (check platform-specific limits)
      const pendingInteractions = socialMediaQueue.getPendingInteractions();
      logger.info({ count: pendingInteractions.length }, 'Processing pending interactions');

      for (const interaction of pendingInteractions) {
        // Check platform-specific quota instead of global
        if (!socialMediaQueue.canReplyOnPlatform(interaction.platform)) {
          logger.info({ platform: interaction.platform }, 'Platform reply quota reached, skipping');
          continue;
        }

        await this.respondToInteraction(interaction);
      }
    } catch (error) {
      logger.error({ error }, 'Error processing queue at midnight');
    }
  }

  /**
   * Create a scheduled post
   * Bluesky: Posts 2x/day (morning + afternoon/evening) - 11,666/day limit
   * X FREE tier: Posts 1x/day at random time - 3/day total (100/month cap!)
   */
  private async createScheduledPost(timeOfDay: 'morning' | 'afternoon' | 'evening'): Promise<void> {
    try {
      // Determine which platforms should post using platform-specific quotas
      const shouldPostBluesky = config.blueskyIdentifier && socialMediaQueue.canPostOnPlatform('bluesky');
      const shouldPostX = config.xApiKey && config.socialPostsEnabled && 
                          this.dailyXPostTime === timeOfDay && 
                          socialMediaQueue.canPostOnPlatform('x');

      // Exit early only if NEITHER platform should post
      if (!shouldPostBluesky && !shouldPostX) {
        if (!socialMediaQueue.canPostOnPlatform('bluesky') && config.blueskyIdentifier) {
          logger.info('Daily post limit reached for Bluesky (2/day)');
        }
        if (!shouldPostX && config.xApiKey && this.dailyXPostTime === timeOfDay) {
          logger.info('Daily post limit reached for X (1/day)');
        }
        if (config.xApiKey && this.dailyXPostTime !== timeOfDay) {
          logger.info({ 
            timeOfDay, 
            selectedTime: this.dailyXPostTime 
          }, 'Skipping X post - not the selected time for today');
        }
        return;
      }

      // Generate content using Gemini (only if at least one platform will post)
      const content = await this.generatePostContent(timeOfDay);
      if (!content) {
        logger.warn('Failed to generate post content');
        return;
      }

      // Post to Bluesky (if within daily limit: 2/day)
      if (shouldPostBluesky) {
        const formattedContent = formatForBluesky(content);
        const post = await blueskyClient.createPost(formattedContent.text);
        if (post) {
          socialMediaQueue.incrementPostCount('bluesky');
          logger.info({ timeOfDay, platform: 'bluesky' }, 'Posted scheduled content to Bluesky');
        }
      }

      // Post to X (if this is the randomly selected time for today, 1/day)
      if (shouldPostX) {
        const formattedContent = formatForX(content);
        const post = await xClient.createPost(formattedContent.text);
        if (post) {
          socialMediaQueue.incrementPostCount('x');
          logger.info({ timeOfDay, platform: 'x' }, 'Posted scheduled content to X (daily post)');
        }
      }

      logger.info({ timeOfDay, content }, 'Completed scheduled post');
    } catch (error) {
      logger.error({ error }, 'Error creating scheduled post');
    }
  }

  /**
   * Check for Bluesky interactions only
   */
  private async checkBlueskyInteractions(): Promise<void> {
    try {
      if (config.blueskyIdentifier) {
        const bskyInteractions = await blueskyClient.fetchInteractions();
        logger.info(`Fetched ${bskyInteractions.length} interactions from Bluesky`);
        for (const interaction of bskyInteractions) {
          socialMediaQueue.addPendingInteraction(interaction);
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error checking Bluesky interactions');
    }
  }

  /**
   * Check for X interactions only (called less frequently to conserve quota)
   */
  private async checkXInteractions(): Promise<void> {
    try {
      if (config.xApiKey) {
        const xInteractions = await xClient.fetchInteractions();
        logger.info(`Fetched ${xInteractions.length} interactions from X/Twitter`);
        for (const interaction of xInteractions) {
          socialMediaQueue.addPendingInteraction(interaction);
        }
      }
    } catch (error: any) {
      if (error?.code === 429 || error?.status === 429) {
        logger.warn('X/Twitter rate limit hit, will retry in 2 hours');
      } else {
        logger.error({ error }, 'Error fetching X/Twitter interactions');
      }
    }
  }

  /**
   * Process pending interactions from queue
   * @param platform - If provided, only process interactions for this platform
   */
  private async processInteractions(platform?: Platform): Promise<void> {
    try {
      const pending = socialMediaQueue.getPendingInteractions(platform);
      for (const interaction of pending) {
        if (!socialMediaQueue.canReplyOnPlatform(interaction.platform)) {
          logger.info({ platform: interaction.platform }, 'Platform reply quota reached, skipping');
          continue;
        }
        await this.respondToInteraction(interaction);
      }
    } catch (error) {
      logger.error({ error }, 'Error processing interactions');
    }
  }

  /**
   * Check for new interactions (LEGACY - now split into platform-specific methods)
   * @deprecated Use checkBlueskyInteractions and checkXInteractions instead
   */
  private async checkInteractions(): Promise<void> {
    try {
      // Fetch from Bluesky
      if (config.blueskyIdentifier) {
        const bskyInteractions = await blueskyClient.fetchInteractions();
        logger.info(`Fetched ${bskyInteractions.length} interactions from Bluesky`);
        for (const interaction of bskyInteractions) {
          socialMediaQueue.addPendingInteraction(interaction);
        }
      }

      // Fetch from X (with rate limit protection)
      if (config.xApiKey) {
        try {
          const xInteractions = await xClient.fetchInteractions();
          logger.info(`Fetched ${xInteractions.length} interactions from X/Twitter`);
          for (const interaction of xInteractions) {
            socialMediaQueue.addPendingInteraction(interaction);
          }
        } catch (error: any) {
          // Don't let X rate limits break the entire flow
          if (error?.code === 429 || error?.status === 429) {
            logger.warn('X/Twitter rate limit hit, skipping X checks this cycle');
          } else {
            logger.error({ error }, 'Error fetching X/Twitter interactions');
          }
        }
      }

      // Process immediate replies if platform quota allows
      const pending = socialMediaQueue.getPendingInteractions();
      for (const interaction of pending) {
        // Check platform-specific quota
        if (!socialMediaQueue.canReplyOnPlatform(interaction.platform)) {
          logger.info({ platform: interaction.platform }, 'Platform reply quota reached, skipping');
          continue;
        }
        await this.respondToInteraction(interaction);
      }
    } catch (error) {
      logger.error({ error }, 'Error checking interactions');
    }
  }

  /**
   * Generate post content using Gemini with knowledge base
   * Includes retry logic if response is too long
   */
  private async generatePostContent(timeOfDay: string, retryCount: number = 0): Promise<string | null> {
    try {
      const { project, roadmap } = knowledgeBase;
      const currentPhase = roadmap.find(p => !p.completed);
      
      // Both platforms now use 300 char limit total
      const signature = '\n\n- Charlie AI 🐾🐶 #CharlieBull'; // 31 chars
      const maxContentChars = 300 - signature.length; // 269 chars for content
      
      // Varied greetings for different times
      const greetings = {
        morning: ['Morning fam', 'Rise and shine', 'Good morning', 'This morning', 'Hey everyone'],
        afternoon: ['Afternoon fam', 'Hey crypto community', 'Good afternoon', 'This afternoon', 'Yo builders', 'What\'s up fam'],
        evening: ['Evening everyone', 'Good evening', 'Night owls', 'This evening', 'Hey fam', 'Crypto never sleeps']
      };
      
      const retryNote = retryCount > 0 ? `\n\nIMPORTANT: Previous response was TOO LONG. Make this response SHORTER and more concise!` : '';
      
      const prompt = `You are Charlie Bull, a playful puppy mascot for a cross-chain cryptocurrency project. You're energetic, friendly, and love to educate! Generate a short, engaging social media post for ${timeOfDay}.

Context about Charlie Bull:
- ${project.description}
- Current phase: ${currentPhase?.title} - ${currentPhase?.description}
- Cross-chain token across 9+ blockchains
- Educational focus, community-driven
- Built on Base L2

Your Personality:
- Enthusiastic like a playful puppy
- Educational but fun
- Community-first mindset
- Loves crypto, DeFi, and cross-chain tech
- Never boring or corporate

CRITICAL REQUIREMENTS:
- MAXIMUM ${maxContentChars} characters (signature will be added automatically)
- DO NOT use any emojis (signature adds 🐾🐶 #CharlieBull automatically)
- DO NOT add hashtags (signature adds #CharlieBull)
- DO NOT add your own sign-off (signature is automatic)
- Start with varied greetings like: ${greetings[timeOfDay as keyof typeof greetings].join(', ')}
- DON'T always use "Good morning/afternoon/evening" - mix it up!
- Be engaging and conversational, not formal
- Educational nuggets about cross-chain DeFi or current roadmap
- Can tell a quick story or ask engaging questions
- Make it feel like a real person posting, not a bot
- NEVER let your post get cut off mid-sentence${retryNote}

Post Style Ideas:
- Quick educational facts about cross-chain tech
- Behind-the-scenes updates on development
- Community shoutouts or questions
- Fun observations about crypto/DeFi
- Roadmap updates in an exciting way
- "Did you know?" style facts

Examples (WITHOUT emojis or signatures - those are added automatically):
- "Morning fam! Working on something cool today - making cross-chain swaps even smoother. DeFi shouldn't be complicated, right?"
- "Afternoon builders! Quick question - what's your biggest challenge with cross-chain transfers? I'm here to help break it down!"
- "This evening's thought: Why should you need 5 different wallets for 5 different chains? That's exactly what we're solving!"

Generate ONE post for ${timeOfDay} (${maxContentChars} chars max, no emojis, no hashtags):`;

      const response = await generateWithGemini([
        { role: 'user', content: prompt }
      ]);
      
      const responseText = (response.text || '').trim();
      
      // Log if response is too long
      if (responseText.length > maxContentChars) {
        logger.warn({ 
          timeOfDay,
          responseLength: responseText.length, 
          maxLength: maxContentChars,
          retryCount,
          content: responseText.substring(0, 100) + '...'
        }, 'Gemini post too long');
        
        // Retry up to 2 times
        if (retryCount < 2) {
          logger.info({ timeOfDay, retryCount: retryCount + 1 }, 'Retrying with shorter prompt');
          return this.generatePostContent(timeOfDay, retryCount + 1);
        }
        
        // If still too long after retries, we'll truncate (logged as warning)
        logger.warn({ timeOfDay }, 'Max retries reached, will truncate post');
      }
      
      return responseText;
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
      // Generate reply using Gemini with platform awareness
      const replyContent = await this.generateReplyContent(interaction.content, interaction.platform);
      if (!replyContent) {
        logger.warn({ interactionId: interaction.id }, 'Failed to generate reply');
        return;
      }

      let success = false;

      // Send reply
      if (interaction.platform === 'bluesky') {
        if (!interaction.cid) {
          logger.error({ interactionId: interaction.id }, 'Missing CID for Bluesky reply');
          return;
        }
        const reply = await blueskyClient.replyToPost(
          interaction.postId,
          interaction.cid, // Parent post CID
          replyContent,
          interaction.rootUri, // Root post URI for threading
          interaction.rootCid  // Root post CID for threading
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
        socialMediaQueue.incrementReplyCount(interaction.platform);
        logger.info({ interactionId: interaction.id, platform: interaction.platform }, 'Replied to interaction');
      }
    } catch (error) {
      logger.error({ error, interactionId: interaction.id }, 'Error responding to interaction');
    }
  }

  /**
   * Generate reply content using Gemini with knowledge base and platform awareness
   * Includes retry logic if response is too long
   */
  private async generateReplyContent(originalMessage: string, platform: Platform = 'x', retryCount: number = 0): Promise<string | null> {
    try {
      // First, check if it's a knowledge-based query
      const contextResponse = generateContextualResponse(originalMessage, platform);
      
      // If it's a specific query we have context for, use that (already formatted)
      const queryLower = originalMessage.toLowerCase();
      if (queryLower.includes('tokenomics') || 
          queryLower.includes('link') || 
          queryLower.includes('roadmap') || 
          queryLower.includes('chain')) {
        // Format the contextual response for the platform
        const formatted = platform === 'x' 
          ? formatForX(contextResponse.text)
          : formatForBluesky(contextResponse.text);
        return formatted.text;
      }
      
      // Otherwise, generate a personalized response with Gemini
      const { project } = knowledgeBase;
      
      // BOTH platforms now use 300 char limit total
      const signature = '\n\n- Charlie AI 🐾🐶 #CharlieBull'; // 31 chars
      const maxContentChars = 300 - signature.length; // 269 chars for content
      
      const platformGuidelines = platform === 'x' 
        ? `X/Twitter Guidelines:
- MAXIMUM ${maxContentChars} characters (signature will be added automatically)
- NO URLs or links - X doesn't allow them from us
- If they ask for links, say "check our LinkTree in bio" or "visit charliebull.art"
- Be concise and conversational`
        : `Bluesky Guidelines:
- MAXIMUM ${maxContentChars} characters (signature will be added automatically)
- Links are OK if helpful
- Keep it friendly and informative`;
      
      const retryNote = retryCount > 0 ? `\n\nIMPORTANT: Previous response was ${retryCount > 0 ? 'TOO LONG' : ''}. Make this response SHORTER and more concise!` : '';
      
      const prompt = `You received this message on ${platform}: "${originalMessage}"

You are Charlie Bull, a playful puppy mascot for a cross-chain cryptocurrency project.

About Charlie Bull:
- ${project.description}
- Cross-chain token across 9+ blockchains
- Educational and community-focused
- Built on Base L2

${platformGuidelines}

CRITICAL REQUIREMENTS:
- Your reply must be EXACTLY ${maxContentChars} characters or LESS
- DO NOT use any emojis (signature handles that)
- DO NOT add your own sign-off (signature is added automatically)
- Be helpful, friendly, and conversational
- If the response is too long, prioritize the most important information
- NEVER let your response get cut off mid-sentence${retryNote}

Generate ONLY the reply text (no signatures, no emojis):`;

      const response = await generateWithGemini([
        { role: 'user', content: prompt }
      ]);
      
      const responseText = (response.text || '').trim();
      
      // Check if response is too long BEFORE formatting
      if (responseText.length > maxContentChars) {
        logger.warn({ 
          platform, 
          responseLength: responseText.length, 
          maxLength: maxContentChars,
          retryCount,
          content: responseText.substring(0, 100) + '...'
        }, 'Gemini response too long');
        
        // Retry up to 2 times
        if (retryCount < 2) {
          logger.info({ platform, retryCount: retryCount + 1 }, 'Retrying with shorter prompt');
          return this.generateReplyContent(originalMessage, platform, retryCount + 1);
        }
        
        // If still too long after retries, we'll truncate (logged as warning)
        logger.warn({ platform }, 'Max retries reached, will truncate response');
      }
      
      // Format the response for the specific platform
      const formatted = platform === 'x' 
        ? formatForX(responseText)
        : formatForBluesky(responseText);
      
      // Final validation
      if (formatted.characterCount > 300) {
        logger.error({ 
          platform, 
          finalLength: formatted.characterCount,
          content: formatted.text
        }, 'ERROR: Formatted response exceeds 300 chars!');
      }
      
      return formatted.text;
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
