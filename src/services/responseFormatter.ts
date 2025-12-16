/**
 * Platform-Specific Response Formatter
 * Handles different formatting rules for each platform
 */

import { knowledgeBase, getSocialLink, getAllSocialHandles } from './knowledgeBase.js';

export type Platform = 'x' | 'bluesky' | 'telegram' | 'website';

export interface FormattedResponse {
  text: string;
  includesLinks: boolean;
  characterCount: number;
}

/**
 * Format response for X/Twitter (minimal links, conversational)
 */
export function formatForX(content: string, includeLinks: boolean = false): FormattedResponse {
  let text = content;

  // Replace full URLs with handle mentions or conversational references
  text = text.replace(/https?:\/\/[^\s]+/g, (url) => {
    if (url.includes('charliebull.art/docs')) return 'our docs';
    if (url.includes('charliebull.art')) return 'charliebull.art';
    if (url.includes('linktr.ee')) return 'LinkTree (in bio)';
    if (url.includes('medium.com')) return 'our Medium blog';
    if (url.includes('x.com') || url.includes('twitter.com')) return '@CharlieBullArt';
    if (url.includes('bsky.app')) return 'Bluesky';
    if (url.includes('t.me')) return 'our Telegram';
    return 'our website'; // Generic fallback
  });

  // Ensure under 280 characters
  if (text.length > 280) {
    text = text.substring(0, 277) + '...';
  }

  return {
    text,
    includesLinks: false, // X posts shouldn't have clickable links
    characterCount: text.length,
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

  // Bluesky has a 300 character limit
  if (text.length > 300) {
    text = text.substring(0, 297) + '...';
  }

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
        "We're in the AI growth phase (Q1 2026)! Token launch planned for Q2 2026 pending Base-Solana bridge. NFT collection coming Q4 2026. Full roadmap on our docs! 🐂"
      );
    }
    if (platform === 'bluesky') {
      return formatForBluesky(`Charlie Bull Roadmap:

✅ Q4 2025: AI Integration (Live now!)
🔄 Q1 2026: AI Growth & Analysis
🚀 Q2 2026: Token Launch ($CHAR on Base L2)
🌉 Q2-Q3 2026: Cross-Chain Expansion
🎓 Q3 2026: $BULL Educational Token
🖼️ Q4 2026: NFT Collection & IP Development

Details: ${getSocialLink('docs')} 🐂`);
    }
    return formatForWebsite(`Charlie Bull Roadmap:

✅ Q4 2025 - AI Integration: Interactive Charlie AI on Telegram, Bluesky, and X (COMPLETED)

🔄 Q1 2026 - AI Growth & Analysis: Focus on community engagement and system upgrades

🚀 Q2 2026 - Token Generation Event: Launch $CHAR on Base L2 (pending Base-Solana bridge)

🌉 Q2-Q3 2026 - Cross-Chain Expansion: Bridge to Arbitrum, Ethereum, Avalanche, and more

🎓 Q3 2026 - $BULL Educational Token: 1B tokens on Pump.fun with exclusive holder benefits

🖼️ Q4 2026 - NFT Launch & IP Development: Charlie's Angels NFT collection on Solana

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
