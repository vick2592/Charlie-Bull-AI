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

// Topic categories for post variety — each maps to specific KB content
const POST_TOPICS = [
  'chain_spotlight',       // Feature one specific chain + DEX
  'tokenomics_fact',       // Specific $CHAR tokenomics detail
  'roadmap_tge',           // TGE on Base via Aerodrome, Q2 2026
  'roadmap_bull',          // $BULL educational token on Pump.fun + graduation
  'roadmap_nft',           // NFT collection on Solana for $BULL graduates
  'bridge_tech',           // Axelar Network, LayerZero, Squid Router
  'same_contract',         // Same contract address across all 9 chains
  'why_base_l2',           // Why Base L2, Aerodrome, Ethereum L2 benefits
  'community_airdrop',     // 35% community allocation, rewards, airdrops
  'defi_education',        // General DeFi/cross-chain education nugget
  'market_perspective',    // Opinion/take on cross-chain DeFi trends
  'fun_personality',       // Pure Charlie personality, lighthearted, minimal crypto
  'chain_comparison',      // Compare two chains Charlie lives on
  'bull_burn_event',       // $BULL graduation = 1B $CHAR permanently burned
] as const;

type PostTopic = (typeof POST_TOPICS)[number];

// Post structural types — forces variety in how each post is written
const POST_TYPES = [
  'educational_fact',   // Teach one specific thing
  'opinion',            // Charlie's take / hot take
  'story',              // Short narrative / analogy
  'announcement',       // Roadmap milestone framed as news
  'fun',                // Humor-first, personality-forward
  'question',           // Genuine engagement question (used sparingly)
  'comparison',         // Compare / contrast something
] as const;

type PostType = (typeof POST_TYPES)[number];

export class SocialMediaScheduler {
  private jobs: cron.ScheduledTask[] = [];
  private currentAfternoonIndex = 0; // For alternating 5pm/9pm

  // Recent post memory — tracks last 14 topic+type combos to prevent repetition
  private recentPostLog: Array<{ topic: PostTopic; type: PostType; date: string }> = [];

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
   * Schedule interaction checking
   * Bluesky: Every 15 minutes (11,666/day limit - very generous)
   * X: Disabled on free tier (can't read mentions without Basic $100/mo)
   */
  private scheduleInteractionCheck(): void {
    // Check Bluesky + process Bluesky interactions every 15 minutes
    const job = cron.schedule('*/15 * * * *', async () => {
      logger.info('Checking for new Bluesky interactions');
      await this.checkBlueskyInteractions();
      await this.processInteractions('bluesky');
    });

    // X interaction checking is disabled on free tier.
    // Free tier cannot read mentions (userMentionTimeline requires Basic $100/mo).
    // When upgraded to Basic tier, uncomment the block below:
    // const xJob = cron.schedule('0 12 * * *', async () => {
    //   logger.info('Checking for X interactions');
    //   await this.checkXInteractions();
    //   await this.processInteractions('x');
    // });
    // this.jobs.push(xJob);

    this.jobs.push(job);
    logger.info('Scheduled interaction checking (Bluesky: every 15min, X: disabled on free tier)');
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
   * X FREE tier: Posts 2x/day (morning + afternoon/evening) - no replies means more budget for posts
   * Both platforms post on the same schedule for consistency
   */
  private async createScheduledPost(timeOfDay: 'morning' | 'afternoon' | 'evening'): Promise<void> {
    try {
      // Determine which platforms should post using platform-specific quotas
      const shouldPostBluesky = config.blueskyIdentifier && socialMediaQueue.canPostOnPlatform('bluesky');
      const shouldPostX = config.xApiKey && config.socialPostsEnabled && 
                          socialMediaQueue.canPostOnPlatform('x');

      // Exit early only if NEITHER platform should post
      if (!shouldPostBluesky && !shouldPostX) {
        if (!socialMediaQueue.canPostOnPlatform('bluesky') && config.blueskyIdentifier) {
          logger.info('Daily post limit reached for Bluesky (2/day)');
        }
        if (!socialMediaQueue.canPostOnPlatform('x') && config.xApiKey) {
          logger.info('Daily post limit reached for X (2/day)');
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

      // Post to X (2/day, same schedule as Bluesky)
      if (shouldPostX) {
        const formattedContent = formatForX(content);
        const post = await xClient.createPost(formattedContent.text);
        if (post) {
          socialMediaQueue.incrementPostCount('x');
          logger.info({ timeOfDay, platform: 'x' }, 'Posted scheduled content to X');
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
   * Check for X interactions only
   * LEGACY: Disabled on free tier (userMentionTimeline requires Basic $100/mo).
   * Kept as template for when project upgrades. Currently not called by any scheduler.
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
   * Select a topic that hasn't been used in the last 5 posts
   */
  private selectTopic(): PostTopic {
    const recentTopics = this.recentPostLog.slice(-5).map(p => p.topic);
    const available = POST_TOPICS.filter(t => !recentTopics.includes(t));
    const pool = available.length > 0 ? available : [...POST_TOPICS];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Select a post type that wasn't used in the last 2 posts
   */
  private selectPostType(): PostType {
    const recentTypes = this.recentPostLog.slice(-2).map(p => p.type);
    const available = POST_TYPES.filter(t => !recentTypes.includes(t));
    const pool = available.length > 0 ? available : [...POST_TYPES];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Log a post to recent history (keeps last 14 entries)
   */
  private logPost(topic: PostTopic, type: PostType): void {
    this.recentPostLog.push({ topic, type, date: new Date().toISOString().split('T')[0] });
    if (this.recentPostLog.length > 14) {
      this.recentPostLog.shift();
    }
  }

  /**
   * Build a topic-specific prompt with real KB facts for Gemini
   */
  private buildTopicPrompt(topic: PostTopic, postType: PostType, timeOfDay: string, maxChars: number): string {
    const { tokenomics, technology, roadmap } = knowledgeBase;
    const chains = technology.chainDeployments;

    // Pick a random chain for chain-specific topics
    const randomChain = chains[Math.floor(Math.random() * chains.length)];

    // Pick two different chains for comparison topic
    const chainA = chains[Math.floor(Math.random() * chains.length)];
    const chainB = chains.filter(c => c.name !== chainA.name)[Math.floor(Math.random() * (chains.length - 1))];

    const topicContextMap: Record<PostTopic, string> = {
      chain_spotlight: `You're posting about ${randomChain.name} specifically. Charlie Bull ($CHAR) is live on ${randomChain.name} via ${randomChain.dex}${randomChain.isLaunchPool ? ' (this is the launch pool!)' : ''}. The contract address is the same across all 9 chains: ${tokenomics.contractAddress}. You can swap $CHAR on ${randomChain.dex} right now.`,

      tokenomics_fact: `Share a specific tokenomics fact. Total supply: ${tokenomics.totalSupply} $CHAR. Allocation: 50% (${tokenomics.allocation.liquidity.tokens}) goes to DEX liquidity across all chains, 35% (${tokenomics.allocation.community.tokens}) goes to community airdrops and rewards, 15% (${tokenomics.allocation.teamDev.tokens}) for IP and project expansion. Ticker is $CHAR. Same contract address on all 9 chains: ${tokenomics.contractAddress}.`,

      roadmap_tge: `The Token Generation Event (TGE) for $CHAR is coming Q2 2026 on Base network via Aerodrome DEX. After TGE, $CHAR will expand cross-chain to all 9 blockchains. This is the first official launch of $CHAR — before TGE it's in pre-launch phase. Aerodrome is Base's leading DEX by TVL.`,

      roadmap_bull: `$BULL is an educational token launching Q3 2026 on Pump.fun with 1 billion supply. Before $BULL graduates on Pump.fun, 1B $CHAR tokens are locked. After $BULL graduates, the LP is locked, 1B $CHAR is permanently burned (deflationary!), NFT access is unlocked, and a CHAR/BULL swap pair launches on Raydium.`,

      roadmap_nft: `When $BULL graduates on Pump.fun, holders get exclusive access to an NFT collection on Solana. This bridges Charlie Bull's presence from EVM chains all the way to Solana's NFT ecosystem. The NFT collection is tied to $BULL graduation — the more the community grows $BULL, the sooner this unlocks.`,

      bridge_tech: `Charlie Bull uses three cross-chain protocols: Axelar Network, LayerZero, and Squid Router. These power the ability for $CHAR to exist on 9 chains with the SAME contract address (${tokenomics.contractAddress}). Axelar is a proof-of-stake chain purpose-built for cross-chain communication. LayerZero is an omnichain interoperability protocol. Squid Router enables single-transaction cross-chain swaps.`,

      same_contract: `This is one of Charlie Bull's most unique features: the same contract address (${tokenomics.contractAddress}) works across all ${chains.length} chains — Ethereum, Avalanche, Arbitrum, Mantle, Base, Linea, Blast, Polygon, and BSC. You don't need a different address on each chain. This makes verification simple and scams harder.`,

      why_base_l2: `Charlie Bull launched on Base, Ethereum's L2 built by Coinbase. Base offers Ethereum security with much lower gas fees. The launch liquidity pool is on Aerodrome, Base's top DEX. Base is part of the Superchain — Coinbase's vision for a network of connected L2s. Being on Base means fast, cheap transactions while staying in the Ethereum ecosystem.`,

      community_airdrop: `35% of all $CHAR tokens — that's ${tokenomics.allocation.community.tokens} tokens — are set aside for community airdrops and engagement rewards. This is one of the largest community allocations in the project's tokenomics. The goal: reward early believers and active community members. Airdrop details will roll out closer to TGE Q2 2026.`,

      defi_education: `Share a genuine DeFi education nugget. Topics to pick from: what cross-chain bridges actually do, why gas fees differ between chains, what liquidity pools are and why they matter, why the same token on multiple chains is valuable, what an L2 is and why it exists, or what DEX vs CEX means for crypto users.`,

      market_perspective: `Share Charlie's take on something in the cross-chain or DeFi space — a trend, a challenge, or an observation. Could be about the fragmentation of liquidity across chains, why most people stick to just Ethereum or just BSC, the future of omnichain tokens, or why cross-chain UX is still too complicated for most users.`,

      fun_personality: `This post should be mostly personality, minimal project info. Charlie is a playful puppy mascot who loves crypto. Be funny, relatable, or wholesome. Could be about puppy energy vs crypto market volatility, how Charlie handles a red market day, something silly about being a crypto dog, or just a fun observation. Keep it light. Don't force in technical details.`,

      chain_comparison: `Compare ${chainA.name} (DEX: ${chainA.dex}) and ${chainB.name} (DEX: ${chainB.dex}) from Charlie Bull's perspective — both are chains where $CHAR is deployed. Compare gas fees, speed, ecosystem, or user experience. Stay factual and educational. Don't pick a favourite — Charlie is on both!`,

      bull_burn_event: `When $BULL graduates on Pump.fun, 1 billion $CHAR tokens get permanently burned. This is a deflationary event hardcoded into the roadmap — it reduces $CHAR supply forever. The burn is triggered by $BULL graduation, not by the team manually. This ties the two tokens together: as $BULL grows, it drives a deflationary event in $CHAR.`,
    };

    const typeInstructionMap: Record<PostType, string> = {
      educational_fact: 'Structure this as a clear, punchy educational fact. Teach one specific thing. No fluff. Be direct.',
      opinion: "Give Charlie's opinion or hot take on the topic. Be confident, conversational, not corporate. Like a knowledgeable friend talking, not a press release.",
      story: 'Tell a very short story or use an analogy to explain the topic. Make it relatable to someone who is new to crypto.',
      announcement: 'Frame this like exciting news — as if you\'re announcing something people should be pumped about. Enthusiastic but not spammy.',
      fun: 'Make this fun and personality-forward. Humor is welcome. The topic should be the vehicle, not the destination. Charlie is a playful puppy.',
      question: 'Pose a genuine, interesting question to the community. The topic should be the context for the question. Make it feel like you actually want their answer, not just engagement bait.',
      comparison: 'Compare or contrast two things related to the topic. Give both sides. Keep it balanced and interesting.',
    };

    const greetingOptions = {
      morning: ['Gm!', 'Morning!', 'Rise and grind —', 'New day, new block —', 'Early mover hours —', 'Gm fam,', 'Morning crypto crew —'],
      afternoon: ['Quick thought:', 'Midday update:', 'Afternoon take —', 'Real talk —', 'Hey —', 'Catching up?', ''],
      evening: ['Evening thought:', 'End of day check-in —', 'Night owls,', "Can't sleep? Neither can the blockchain —", 'Late night alpha:', 'Winding down but the chains never do —', ''],
    };

    const greetingPool = greetingOptions[timeOfDay as keyof typeof greetingOptions] || greetingOptions.morning;
    const greeting = greetingPool[Math.floor(Math.random() * greetingPool.length)];

    const recentTopics = this.recentPostLog.slice(-5).map(p => p.topic);
    const recentTypes = this.recentPostLog.slice(-3).map(p => p.type);

    return `You are Charlie Bull — a playful but knowledgeable puppy mascot for a cross-chain crypto project. You post on social media like a real person: casual, direct, and occasionally funny.

TODAY'S POST:
- Time of day: ${timeOfDay}
- Suggested opening (use or rephrase freely): "${greeting}"
- Topic to cover: ${topicContextMap[topic]}
- Post style: ${typeInstructionMap[postType]}

HARD RULES:
- MAXIMUM ${maxChars} characters. Count carefully. Do NOT exceed this.
- NO emojis (signature adds 🐾🐶 #CharlieBull automatically)
- NO hashtags (signature handles that)
- NO sign-off like "Charlie" or "- Charlie Bull" (signature is added automatically)
- NO phrase "AI brain" or "my AI brain" or "learning from your engagement/feedback/interactions"
- NO "pawsome", "woof!", "fetch!" or forced dog puns unless the post type is "fun" and it feels natural
- Do NOT always end with a question. This is a ${postType} post — follow that structure.
- Do NOT start with "Did you know" more than once per week (recently overused)
- Do NOT use "fam" more than once per week (recently overused)
- Write like a real person, not a marketing bot

RECENT TOPICS USED (do NOT repeat these angles): ${recentTopics.join(', ') || 'none yet'}
RECENT POST TYPES USED: ${recentTypes.join(', ') || 'none yet'}

Output ONLY the post text (${maxChars} chars max). No quotes. No labels. No preamble.`;
  }

  /**
   * Generate post content using Gemini with topic rotation and variety enforcement
   * Includes retry logic if response is too long
   */
  private async generatePostContent(timeOfDay: string, retryCount: number = 0): Promise<string | null> {
    try {
      const signature = '\n\n- Charlie AI 🐾🐶 #CharlieBull'; // 31 chars
      const maxContentChars = 300 - signature.length; // 269 chars for content

      // Select topic and post type (avoiding recent repeats)
      const topic = this.selectTopic();
      const postType = this.selectPostType();

      logger.info({ topic, postType, timeOfDay, retryCount }, 'Generating post with topic/type selection');

      const retryInstruction = retryCount > 0
        ? `\n\nCRITICAL: Your previous response was TOO LONG. This MUST be ${maxContentChars} characters or fewer. Cut ruthlessly.`
        : '';

      const prompt = this.buildTopicPrompt(topic, postType, timeOfDay, maxContentChars) + retryInstruction;

      const response = await generateWithGemini([
        { role: 'user', content: prompt }
      ]);

      const responseText = (response.text || '').trim();

      if (responseText.length > maxContentChars) {
        logger.warn({
          timeOfDay, topic, postType,
          responseLength: responseText.length,
          maxLength: maxContentChars,
          retryCount,
          preview: responseText.substring(0, 80) + '...'
        }, 'Generated post too long');

        if (retryCount < 2) {
          return this.generatePostContent(timeOfDay, retryCount + 1);
        }
        logger.warn({ timeOfDay }, 'Max retries reached, will truncate post');
      }

      // Only log topic/type to recent history on first attempt (not retries)
      if (retryCount === 0) {
        this.logPost(topic, postType);
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
        // LEGACY: X replies disabled on free tier. Kept for future Basic tier upgrade.
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
