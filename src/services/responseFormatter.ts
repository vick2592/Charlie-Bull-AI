/**
 * Platform-Specific Response Formatter
 * Handles different formatting rules for each platform
 */

import { knowledgeBase, getSocialLink, getAllSocialHandles } from './knowledgeBase.js';
import { logger } from '../lib/logger.js';

export type Platform = 'x' | 'bluesky' | 'telegram' | 'website';

export interface FormattedResponse {
  text: string;
  includesLinks: boolean;
  characterCount: number;
}

/**
 * Smart truncation at word or sentence boundaries
 * NEVER adds "..." - always provides clean cuts
 */
function smartTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // Try to cut at last sentence within limit
  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  
  const lastSentence = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  // If we have a sentence boundary in a reasonable position, use it
  if (lastSentence > maxLength * 0.7) {
    return truncated.substring(0, lastSentence + 1);
  }
  
  // Otherwise cut at last word boundary (no ellipsis)
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.5) {
    return truncated.substring(0, lastSpace);
  }
  
  // Fallback: hard cut at maxLength (no ellipsis)
  return truncated;
}

/**
 * Calculate Twitter weighted character length.
 * Twitter counts most characters as 1, but emoji (code points > U+FFFF) count as 2.
 * URLs always count as 23 (but we replace them before this point).
 * JS String.length already equals the Twitter weighted length for emoji because
 * both use UTF-16 surrogate pairs — so we can use .length directly.
 */
function twitterWeightedLength(text: string): number {
  return text.length; // JS .length === Twitter weighted length for our use-case (no raw URLs)
}

/**
 * Ensures at most one cashtag ($SYMBOL) exists in the post.
 * If multiple exist, keeps the first (or prioritizes $CHAR) and strips $ from the rest.
 */
function limitCashtagsForX(text: string): string {
  let cashtagCount = 0;
  
  // If $CHAR is present, prioritize keeping $CHAR and strip $ from others
  const hasChar = /\$CHAR\b/i.test(text);

  return text.replace(/\$([a-zA-Z0-9_]+)/g, (match, symbol) => {
    if (hasChar) {
      if (symbol.toUpperCase() === 'CHAR') return match;
      return symbol; // Strip $ from secondary tickers like $BULL -> BULL
    }

    cashtagCount++;
    return cashtagCount === 1 ? match : symbol; // Keep only first cashtag
  });
}

/**
 * Neutralizes URL patterns that trigger X's automated spam filter and link penalties.
 * Removes all TLDs (.fun, .art, .io) so X parses them strictly as plain text.
 */
function neutralizeLinksForX(text: string): string {
  // 1. Extract visible text from any markdown links first: [My Text](https://...) -> My Text
  let sanitized = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // 2. Target specific project and crypto domains (with or without https:// or www.)
  //    and convert them to safe, conversational plain English.
  sanitized = sanitized
    .replace(/(?:https?:\/\/)?(?:www\.)?charliebull\.art\/docs(?:\/[^\s.,;:!?]+)?/gi, 'our docs')
    .replace(/(?:https?:\/\/)?(?:www\.)?charliebull\.art(?:\/[^\s.,;:!?]+)?/gi, 'our website')
    .replace(/(?:https?:\/\/)?(?:www\.)?linktr\.ee(?:\/[^\s.,;:!?]+)?/gi, 'LinkTree (in bio)')
    .replace(/(?:https?:\/\/)?(?:www\.)?medium\.com(?:\/[^\s.,;:!?]+)?/gi, 'our Medium blog')
    .replace(/(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com(?:\/[^\s.,;:!?]+)?/gi, '@CharlieBullArt')
    .replace(/(?:https?:\/\/)?(?:www\.)?bsky\.app(?:\/[^\s.,;:!?]+)?/gi, 'Bluesky')
    .replace(/(?:https?:\/\/)?(?:www\.)?t\.me(?:\/[^\s.,;:!?]+)?/gi, 'our Telegram')
    .replace(/(?:https?:\/\/)?(?:www\.)?pump\.fun(?:\/[^\s.,;:!?]+)?/gi, 'Pump fun')
    .replace(/(?:https?:\/\/)?(?:www\.)?raydium\.io(?:\/[^\s.,;:!?]+)?/gi, 'Raydium')
    .replace(/(?:https?:\/\/)?(?:www\.)?aerodrome\.finance(?:\/[^\s.,;:!?]+)?/gi, 'Aerodrome')
    .replace(/(?:https?:\/\/)?(?:www\.)?github\.com(?:\/[^\s.,;:!?]+)?/gi, 'our GitHub')
    .replace(/(?:https?:\/\/)?(?:www\.)?tiktok\.com(?:\/[^\s.,;:!?]+)?/gi, 'our TikTok')
    .replace(/(?:https?:\/\/)?(?:www\.)?linkedin\.com(?:\/[^\s.,;:!?]+)?/gi, 'our LinkedIn');

  // 3. Destroy any remaining generic http/https links completely and Limit Cashtags
  //    Stop before sentence punctuation to avoid eating trailing periods/commas
  sanitized = sanitized.replace(/https?:\/\/[^\s.,;:!?]+/gi, '');
  sanitized = limitCashtagsForX(sanitized);

  // 4. Clean up any accidental double spaces left behind by deleted URLs
  return sanitized.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Format response for X/Twitter (minimal links, conversational)
 * X hard limit: 280 weighted characters (emoji count as 2 via surrogate pairs).
 */
export function formatForX(content: string, _includeLinks: boolean = false): FormattedResponse {
  // 1. Log the raw AI input
  logger.info({ original: content }, 'Raw AI content before X formatting');

  let text = neutralizeLinksForX(content);
  
  // 2. Log the output of link neutralization
  logger.info({ neutralized: text }, 'Content after X link/regex neutralization');

  const signature = '\n\n- Charlie AI 🐾🐶 #CharlieBull';
  const maxContentLength = 280 - twitterWeightedLength(signature);

  text = smartTruncate(text, maxContentLength) + signature;
  
  // 3. Log the final payload
  logger.info({ finalPayload: text }, 'Final payload ready for X API');

  return {
    text,
    includesLinks: false,
    characterCount: twitterWeightedLength(text),
  };
}

/**
 * Format response for Bluesky (links OK, more flexible)
 */
export function formatForBluesky(content: string, includeLinks: boolean = true): FormattedResponse {
  let text = content;

  // Bluesky allows links, keep them if requested
  if (!includeLinks) {
    text = text.replace(/https?:\/\/[^\s]+/g, (url) => {
      if (url.includes('charliebull.art')) return 'charliebull.art';
      if (url.includes('medium.com')) return 'Medium';
      return 'our website';
    });
  }

  // Add AI signature with paw and dog emojis (Charlie is a puppy, not a cow!)
  const signature = '\n\n- Charlie AI 🐾🐶 #CharlieBull';
  const maxContentLength = 300 - signature.length;
  
  // Smart truncation to fit within 300 chars with signature
  text = smartTruncate(text, maxContentLength) + signature;

  return {
    text,
    includesLinks: includeLinks,
    characterCount: text.length,
  };
}

/**
 * Format response for Telegram (rich, can include buttons/commands)
 */
export function formatForTelegram(content: string): FormattedResponse {
  // Telegram supports Markdown and has no strict character limit
  let text = content;

  // Format links as markdown
  text = text.replace(
    /https?:\/\/([^\s]+)/g,
    (url, domain) => `[${domain.split('/')[0]}](${url})`
  );

  return {
    text,
    includesLinks: true,
    characterCount: text.length,
  };
}

/**
 * Format response for Website (full details, no limits)
 */
export function formatForWebsite(content: string): FormattedResponse {
  // Website chat can have full, detailed responses
  return {
    text: content,
    includesLinks: true,
    characterCount: content.length,
  };
}

/**
 * Generate context-aware response based on query type and platform
 */
export function generateContextualResponse(
  query: string,
  platform: Platform
): FormattedResponse {
  const queryLower = query.toLowerCase();

  // Tokenomics queries
  if (
    queryLower.includes('tokenomics') ||
    queryLower.includes('supply') ||
    queryLower.includes('allocation')
  ) {
    if (platform === 'x') {
      return formatForX(
        "Our tokenomics are detailed on our website docs! 420.69B total supply with strategic allocation for liquidity, community, and development. Check charliebull.art/docs 🐂"
      );
    }
    if (platform === 'bluesky') {
      return formatForBluesky(
        `Total Supply: 420.69B $CHAR

50% Liquidity | 35% Community | 15% Team & Dev

Full details: ${getSocialLink('docs')} 🐂`
      );
    }
    if (platform === 'telegram') {
      return formatForTelegram(`**Tokenomics Breakdown:**

Total Supply: 420,690,000,000 $CHAR

• 50% (210.3B) - DEX Liquidity Pools
• 35% (147.2B) - Community Airdrop
• 15% (63.1B) - Team & Development

🔗 Full details: ${getSocialLink('docs')}`);
    }
    return formatForWebsite(
      `Charlie Bull Tokenomics:

Total Supply: 420,690,000,000 $CHAR

Allocation:
• 50% (210,345,000,000) - DEX Liquidity Pools across multiple chains
• 35% (147,241,500,000) - Community Airdrop and engagement rewards
• 15% (63,103,500,000) - IP and Project Expansion

Note: After launch, 1B tokens from liquidity will be purchased and locked for Pump.fun educational initiatives.

$BULL Educational Token: 1B tokens on Pump.fun for educational streams. Upon graduation, holders receive exclusive access to Charlie's Angels NFT collection and early opportunities.

View full whitepaper: ${getSocialLink('docs')}`
    );
  }

  // Social links queries
  if (
    queryLower.includes('link') ||
    queryLower.includes('social') ||
    queryLower.includes('where') ||
    queryLower.includes('find')
  ) {
    if (platform === 'x') {
      return formatForX(
        'Find all our links in bio! We\'re on X, Bluesky, Telegram, TikTok, and more. Check out LinkTree for everything 🐂'
      );
    }
    if (platform === 'bluesky') {
      return formatForBluesky(`All our socials:
${getAllSocialHandles()}

Website: ${getSocialLink('website')}
LinkTree: ${getSocialLink('linktree')} 🐂`);
    }
    if (platform === 'telegram') {
      return formatForTelegram(`**Find Charlie Bull everywhere:**

🌐 Website: ${getSocialLink('website')}
🔗 LinkTree: ${getSocialLink('linktree')}
🐦 X/Twitter: ${getSocialLink('x')}
☁️ Bluesky: ${getSocialLink('bluesky')}
💬 Telegram: ${getSocialLink('telegram')}
📱 TikTok: ${getSocialLink('tiktok')}
📝 Medium: ${getSocialLink('medium')}
💼 LinkedIn: ${getSocialLink('linkedin')}
💻 GitHub: ${getSocialLink('github')}`);
    }
    return formatForWebsite(`Charlie Bull Social Links:

• Website: ${getSocialLink('website')}
• Documentation: ${getSocialLink('docs')}
• LinkTree: ${getSocialLink('linktree')}
• X/Twitter: ${getSocialLink('x')}
• Bluesky: ${getSocialLink('bluesky')}
• Telegram: ${getSocialLink('telegram')}
• TikTok: ${getSocialLink('tiktok')}
• LinkedIn: ${getSocialLink('linkedin')}
• Medium Blog: ${getSocialLink('medium')}
• GitHub: ${getSocialLink('github')}
• Email: ${knowledgeBase.socialLinks.email}`);
  }

  // Roadmap queries
  if (
    queryLower.includes('roadmap') ||
    queryLower.includes('launch') ||
    queryLower.includes('when')
  ) {
    if (platform === 'x') {
      return formatForX(
        "We're in Q3 2026 — AI + social growth complete! TGE hits Q4 2026 on Base via Aerodrome. $BULL launches Q1 2027. Full roadmap on our docs! 🐂"
      );
    }
    if (platform === 'bluesky') {
      return formatForBluesky(`Charlie Bull Roadmap:

✅ Q4 2025: AI Integration (Completed)
✅ Q1 2026: AI Growth & Analysis (Completed)
✅ Q2 2026: AI Growth Stage 2 (Completed)
✅ Q3 2026: VPS + Social Growth (Completed)
🚀 Q4 2026: TGE — $CHAR on Base via Aerodrome
🌉 Q4 2026–Q1 2027: Cross-Chain Expansion
🎓 Q1 2027: $BULL Launch & 1B $CHAR Burn
🖼️ Q3 2027: Charlie's Angels NFT Launch

Details: ${getSocialLink('docs')} 🐂`);
    }
    return formatForWebsite(`Charlie Bull Roadmap:

✅ Q4 2025 - AI Integration: Interactive Charlie AI on Telegram, Bluesky, and X (COMPLETED)

✅ Q1 2026 - AI Growth & Analysis: Community engagement and system upgrades (COMPLETED)

✅ Q2 2026 - AI Growth & Analysis Stage 2: Advanced analytics and growth systems (COMPLETED)

✅ Q3 2026 - Charlie VPS Integration & Social Growth Analysis (COMPLETED)

🚀 Q4 2026 - Token Generation Event: $CHAR launches on Base via Aerodrome

🌉 Q4 2026–Q1 2027 - Cross-Chain Expansion: Bridge to Arbitrum, Ethereum, Avalanche, and more

🎓 Q1 2027 - $BULL Launch & 1B $CHAR Burn: 1B tokens on Pump.fun, 1B $CHAR burned

🖼️ Q3 2027 - Charlie's Angels NFT Launch & IP Development: NFT collection on Solana

Full whitepaper: ${getSocialLink('docs')}`);
  }

  // Technology/cross-chain queries
  if (
    queryLower.includes('chain') ||
    queryLower.includes('bridge') ||
    queryLower.includes('technology') ||
    queryLower.includes('tech')
  ) {
    if (platform === 'x') {
      return formatForX(
        'Built on Base L2 with cross-chain magic! ✨ Using Axelar Network & Squid Router to connect 9+ blockchains. Base ↔ Solana bridge coming soon. Details on our docs! 🐂'
      );
    }
    return formatForWebsite(`Charlie Bull Technology Stack:

Primary Chain: Ethereum (Base L2)

Cross-Chain Protocols:
• Axelar Network - Secure cross-chain communication
• Squid Router - Optimized token swapping and bridging
• Base ↔ Solana Bridge - Deep Solana DEX liquidity access

Supported Blockchains:
Ethereum, Base, Arbitrum, Avalanche, Solana, Polygon, Optimism, BSC, Fantom

This infrastructure enables seamless $CHAR transfers across ecosystems while maintaining security and optimal user experience.

Learn more: ${getSocialLink('docs')}`);
  }

  // Default: no specific match, return general info based on platform
  if (platform === 'x') {
    return formatForX(
      "I'm Charlie Bull! 🐂 Your cross-chain crypto companion. Built on Base, bridging 9+ chains. Making DeFi accessible and fun! Check out our docs for more info."
    );
  }

  return formatForWebsite(
    `I'm Charlie Bull! 🐂

${knowledgeBase.project.description}

${knowledgeBase.project.mission}

Learn more:
• Website: ${getSocialLink('website')}
• Documentation: ${getSocialLink('docs')}
• All Links: ${getSocialLink('linktree')}`
  );
}
