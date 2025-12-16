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
      'Cross-chain deployment on 9 major blockchain networks',
      'Same contract address (0x7F9532940e98eB7c2da6ba23c3f3D06315BfaAF1) across all chains',
      'Launch liquidity pool on Base via Aerodrome',
      'Multi-DEX support: Uniswap, PancakeSwap, QuickSwap, LFGJ, Fusion X, and more',
      'AI-powered educational assistant (Charlie) on Telegram, Bluesky, and X',
      'Community-first tokenomics: 35% for airdrops and rewards',
      'Seamless bridging via Axelar Network and LayerZero',
      'Educational $BULL token (1B supply) on Pump.fun',
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
      'After launch, 1B tokens from liquidity will be purchased and locked for Pump.fun',
      '$BULL educational token (1B) on Pump.fun for educational streams',
      'Upon $BULL graduation, holders get exclusive access to NFT collection and early opportunities',
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
        'Launch interactive Charlie AI character on Telegram, Bluesky, and X - operational before token generation event',
      completed: true,
    },
    {
      quarter: 'Q1 2026',
      title: 'AI Growth & Analysis',
      description:
        'Focus on Charlie AI growth, post analysis, and system upgrades based on community engagement',
      completed: false,
    },
    {
      quarter: 'Q2 2026',
      title: 'Token Generation Event',
      description:
        'Launch $CHAR token with initial liquidity on Base L2 (pending Base-Solana bridge finalization)',
      completed: false,
    },
    {
      quarter: 'Q2-Q3 2026',
      title: 'Cross-Chain Expansion',
      description:
        'Bridge and provide liquidity on Arbitrum, Ethereum, Avalanche, and other Axelar-supported networks',
      completed: false,
    },
    {
      quarter: 'Q3 2026',
      title: '$BULL Educational Token',
      description:
        'Launch 1B $BULL tokens on Pump.fun for educational streams. Upon graduation, grants holders exclusive access to NFT minting and early opportunities',
      completed: false,
    },
    {
      quarter: 'Q4 2026',
      title: 'NFT Launch & IP Development',
      description: "Launch Charlie's Angels NFT collection on Solana and develop Charlie Bull IP",
      completed: false,
    },
  ],

  team: {
    founder: 'Viktor Khachatryan',
    role: 'Full Stack Developer & Founder',
  },

  technology: {
    primaryChain: 'Base (Ethereum L2)',
    crossChainProtocols: ['Axelar Network', 'Squid Router', 'LayerZero'],
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
    // Add blog posts here as they're published
    // Example format:
    // {
    //   title: "Introducing Charlie Bull: The Future of Cross-Chain",
    //   url: "https://medium.com/@charliebullart/...",
    //   date: "2025-12-01",
    //   summary: "Our vision for accessible cross-chain cryptocurrency"
    // }
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
