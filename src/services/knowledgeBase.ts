/**
 * Charlie Bull Knowledge Base
 * Centralized source of truth for project information
 */

export interface TokenomicsData {
  totalSupply: string;
  ticker: string;
  contractAddress: string;
  allocation: {
    liquidity: { percentage: number; tokens: string; description: string };
    community: { percentage: number; tokens: string; description: string };
    teamDev: { percentage: number; tokens: string; description: string };
  };
  notes: string[];
}

export interface SocialLinks {
  website: string;
  docs: string;
  linktree: string;
  x: string;
  bluesky: string;
  telegram: string;
  tiktok: string;
  linkedin: string;
  github: string;
  medium: string;
  email: string;
}

export interface RoadmapPhase {
  quarter: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface BlogPost {
  title: string;
  url: string;
  date: string;
  summary?: string;
}

export interface ChainDeployment {
  name: string;
  dex: string;
  isLaunchPool?: boolean;
}

export interface KnowledgeBase {
  project: {
    name: string;
    description: string;
    mission: string;
    keyFeatures: string[];
  };
  tokenomics: TokenomicsData;
  socialLinks: SocialLinks;
  roadmap: RoadmapPhase[];
  team: {
    founder: string;
    role: string;
  };
  technology: {
    primaryChain: string;
    crossChainProtocols: string[];
    chainDeployments: ChainDeployment[];
  };
  blogPosts: BlogPost[];
}

export const knowledgeBase: KnowledgeBase = {
  project: {
    name: 'Charlie Bull',
    description:
      'A paradigm shift in cross-chain cryptocurrency, combining advanced blockchain interoperability with character-driven community engagement powered by AI.',
    mission:
      'Making cryptocurrency accessible to everyone through educational resources, AI-powered assistance, and seamless cross-chain functionality.',
    keyFeatures: [
      'Contract address registered on 9 major blockchain networks — PRE-TGE: no active DEX liquidity pools yet',
      'Same contract address (0x7F9532940e98eB7c2da6ba23c3f3D06315BfaAF1) across all 9 chains — simplifies bridging and verification post-TGE',
      'Planned TGE launch pool on Base via Aerodrome (Q3 2026) — token NOT yet available for purchase',
      'Multi-DEX roadmap post-TGE: Uniswap, PancakeSwap, QuickSwap, LFGJ, Fusion X — liquidity added chain by chain after TGE',
      'AI-powered educational assistant (Charlie) on Telegram, Bluesky, X, and website',
      'Community-first tokenomics: 35% for airdrops and rewards',
      'Cross-chain bridging planned via Axelar Network and Squid Router — active post-TGE',
      'Base ↔ Solana bridge unlocks CHAR/BULL swap pair on Raydium (Q1 2027)',
      'Educational $BULL token (1B supply) on Pump.fun — graduation burns 1B $CHAR permanently',
    ],
  },

  tokenomics: {
    totalSupply: '420,690,000,000',
    ticker: '$CHAR',
    contractAddress: '0x7F9532940e98eB7c2da6ba23c3f3D06315BfaAF1',
    allocation: {
      liquidity: {
        percentage: 50,
        tokens: '210,345,000,000',
        description: 'DEX Liquidity Pools across multiple chains',
      },
      community: {
        percentage: 35,
        tokens: '147,241,500,000',
        description: 'Community Airdrop and engagement rewards',
      },
      teamDev: {
        percentage: 15,
        tokens: '63,103,500,000',
        description: 'IP and Project Expansion',
      },
    },
    notes: [
      'PRE-TGE: $CHAR is NOT yet available for purchase or trading. The contract address exists on all 9 chains but there are ZERO active DEX liquidity pools. TGE launches Q3 2026 on Base via Aerodrome. After TGE, liquidity is bridged to other chains by the community.',
      '$BULL educational token (1B supply) launching Q4 2026 on Pump.fun (Solana)',
      'Pre-graduation: $BULL powers educational streams + weekly podcasts on Pump.fun. 1B $CHAR tokens are locked.',
      'Post-graduation: 1B $CHAR permanently burned from Ethereum locked liquidity (deflationary, hardcoded — not a manual team action)',
      'Post-graduation: LP locked, CHAR/BULL swap pair launches on Raydium, $BULL holders get exclusive early access to Charlie\u2019s Angels NFT collection',
      'CHAR/BULL swap pair requires Base ↔ Solana bridge to be live first',
    ],
  },

  socialLinks: {
    website: 'https://charliebull.art',
    docs: 'https://charliebull.art/docs',
    linktree: 'https://linktr.ee/charliebullart',
    x: 'https://x.com/charliebullart',
    bluesky: 'https://bsky.app/profile/charliebull.art',
    telegram: 'https://t.me/+VUOILe0sPis3MmYx',
    tiktok: 'https://tiktok.com/@charliebullart',
    linkedin: 'https://www.linkedin.com/company/charlie-bull-inc/',
    github: 'https://github.com/vick2592/Official-Charlie-Bull',
    medium: 'https://medium.com/@charliebullart',
    email: 'info@charliebull.art',
  },

  roadmap: [
    {
      quarter: 'Q4 2025',
      title: 'AI Integration',
      description:
        'Charlie AI launched across Telegram, Bluesky, and X/Twitter. Website chat live. Automated social posting with real-time Bluesky reply support.',
      completed: true,
    },
    {
      quarter: 'Q1 2026',
      title: 'AI Growth & Analysis',
      description:
        'Server infrastructure upgrades, 14-topic rotation system, 7 post-structure types, AWS EC2 production deployment. X/Twitter free tier stabilization. Social growth analysis.',
      completed: true,
    },
    {
      quarter: 'Q2 2026',
      title: 'CoinGecko & Etherscan Approval',
      description:
        'Submit token update forms on CoinGecko and Etherscan prior to $CHAR TGE. TGE proceeds once both approvals are confirmed.',
      completed: false,
    },
    {
      quarter: 'Q3 2026',
      title: '$CHAR Token Generation Event (TGE)',
      description:
        'Official $CHAR TGE on Base network via Aerodrome DEX — launch pool goes live. Cross-chain expansion begins via Axelar Network and Squid Router, starting with Ethereum and Arbitrum.',
      completed: false,
    },
    {
      quarter: 'Q3–Q4 2026',
      title: 'Cross-Chain Expansion',
      description:
        'Bridge and provide liquidity on remaining 7 chains: Polygon (QuickSwap), BNB Chain (PancakeSwap), Mantle (Fusion X), Linea, Blast. Full 9-chain $CHAR deployment complete.',
      completed: false,
    },
    {
      quarter: 'Q4 2026',
      title: '$BULL Launch & 1B $CHAR Burn',
      description:
        'Launch 1B $BULL tokens on Pump.fun (Solana). Weekly podcasts from the Charlie Bull team. Upon graduation: 1B $CHAR permanently burned from Ethereum locked liquidity. $BULL holders get exclusive early access to Charlie\u2019s Angels NFT collection.',
      completed: false,
    },
    {
      quarter: 'Q1 2027',
      title: 'Base ↔ Solana Bridge & Raydium Pair',
      description:
        'Bridge $CHAR to Solana. CHAR/BULL swap pair launches on Raydium. $CHAR and $BULL become interoperable across EVM + Solana.',
      completed: false,
    },
    {
      quarter: 'Q2 2027',
      title: "Charlie's Angels NFT Launch & IP Development",
      description:
        "Charlie's Angels NFT collection launches on Solana with exclusive benefits for $BULL graduates. Expand Charlie Bull IP through partnerships, merchandise, and multimedia content.",
      completed: false,
    },
    {
      quarter: 'Q3 2027 & Beyond',
      title: 'Ecosystem Expansion',
      description:
        'Continuous development of DeFi utilities, governance implementation, strategic partnerships, and expansion of the Charlie Bull universe across Web3 platforms.',
      completed: false,
    },
  ],

  team: {
    founder: 'Viktor Khachatryan',
    role: 'Full Stack Developer & Founder',
  },

  technology: {
    primaryChain: 'Base (Ethereum L2)',
    crossChainProtocols: ['Axelar Network', 'Squid Router', 'Base ↔ Solana Bridge'],
    chainDeployments: [
      { name: 'Ethereum', dex: 'Uniswap' },
      { name: 'Avalanche', dex: 'LFGJ' },
      { name: 'Arbitrum', dex: 'Uniswap' },
      { name: 'Mantle', dex: 'Fusion X' },
      { name: 'Base', dex: 'Aerodrome', isLaunchPool: true },
      { name: 'Linea', dex: 'Linea DEX' },
      { name: 'Blast', dex: 'Blast DEX' },
      { name: 'Polygon', dex: 'QuickSwap' },
      { name: 'Binance Smart Chain', dex: 'PancakeSwap' },
    ],
  },

  blogPosts: [
    {
      title: 'Charlie Bull: Q1 2026 Build Update — What We Shipped and What\'s Coming at TGE',
      url: 'https://medium.com/@charliebullart/charlie-bull-q1-2026-build-update-what-we-shipped-and-whats-coming-at-tge-aeee0d93a19d',
      date: '2026-04-19',
      summary:
        'Full transparency update: 14-topic AI posting system, AWS infrastructure, Gemini model upgrades, roadmap status, and TGE timeline. Q2 2026 = CoinGecko/Etherscan approvals. Q3 2026 = TGE on Base via Aerodrome.',
    },
    {
      title: 'Charlie Bull ($CHAR) Tokenomics: The Blueprint for a DeFi Revolution',
      url: 'https://medium.com/@charliebullart/charlie-bull-char-tokenomics-the-blueprint-for-a-defi-revolution',
      date: '2025-12-15',
      summary:
        'Comprehensive breakdown of $CHAR tokenomics: 420.69B supply across 9 chains, 50% liquidity, 35% community rewards, $BULL educational token integration, and cross-chain architecture.',
    },
  ],
};

/**
 * Helper functions to query knowledge base
 */

export function getTokenomicsInfo(): string {
  const { tokenomics } = knowledgeBase;
  return `Total Supply: ${tokenomics.totalSupply} ${tokenomics.ticker}

Allocation:
• ${tokenomics.allocation.liquidity.percentage}% (${tokenomics.allocation.liquidity.tokens}) - ${tokenomics.allocation.liquidity.description}
• ${tokenomics.allocation.community.percentage}% (${tokenomics.allocation.community.tokens}) - ${tokenomics.allocation.community.description}
• ${tokenomics.allocation.teamDev.percentage}% (${tokenomics.allocation.teamDev.tokens}) - ${tokenomics.allocation.teamDev.description}`;
}

export function getSocialLink(platform: keyof SocialLinks): string {
  return knowledgeBase.socialLinks[platform];
}

export function getAllSocialHandles(): string {
  return `X: @CharlieBullArt
Bluesky: @charliebull.art
Telegram: Charlie Bull Community
TikTok: @charliebullart`;
}

export function getCurrentRoadmapPhase(): RoadmapPhase {
  return knowledgeBase.roadmap.find((phase) => !phase.completed) || knowledgeBase.roadmap[0];
}

export function getProjectDescription(detailed: boolean = false): string {
  if (detailed) {
    return `${knowledgeBase.project.description}

Key Features:
${knowledgeBase.project.keyFeatures.map((f) => `• ${f}`).join('\n')}`;
  }
  return knowledgeBase.project.description;
}

export function getTechnologyStack(): string {
  const { technology } = knowledgeBase;
  const chains = technology.chainDeployments.map((c) => c.name).join(', ');
  return `Built on ${technology.primaryChain}
Cross-chain via: ${technology.crossChainProtocols.join(', ')}
Deployed on 9 chains: ${chains}
Contract Address (all chains): ${knowledgeBase.tokenomics.contractAddress}`;
}

export function getChainDeployments(): string {
  const { chainDeployments } = knowledgeBase.technology;
  return chainDeployments
    .map((chain) => {
      const launchNote = chain.isLaunchPool ? ' 🚀 (Launch Pool)' : '';
      return `• ${chain.name} - ${chain.dex}${launchNote}`;
    })
    .join('\n');
}

export function getLatestBlogPosts(limit: number = 3): BlogPost[] {
  return knowledgeBase.blogPosts.slice(0, limit);
}

export function addBlogPost(post: BlogPost): void {
  knowledgeBase.blogPosts.unshift(post);
}
