import { ChatMessage } from '../types/chat.js';
import { config } from '../lib/config.js';
import { knowledgeBase, getTokenomicsInfo, getAllSocialHandles } from './knowledgeBase.js';
import { getMarketSnapshot, formatMarketContext } from './priceService.js';

const NAME = config.charlieName || 'Charlie';
const CREATOR = config.charlieCreator || 'Charlie Bull';
const EXTRA = config.charliePersonaExtra || '';

// Tokenomics related env-driven values
const CHAR_ADDRESS = (config.charTokenAddress || '').trim();
const BULL_ADDRESS = (config.bullTokenAddress || '').trim();
const TOKENOMICS_EXTRA = (config.tokenomicsExtra || '').trim();

function buildTokenomicsSection(): string {
  const lines: string[] = [];
  const { tokenomics, project, technology, roadmap, socialLinks } = knowledgeBase;
  
  lines.push('=== CHARLIE BULL PROJECT KNOWLEDGE ===');
  lines.push('');
  
  // Project Overview
  lines.push('PROJECT OVERVIEW:');
  lines.push(project.description);
  lines.push('Mission: ' + project.mission);
  lines.push('');
  
  // Tokenomics (Enhanced with knowledge base)
  lines.push('TOKENOMICS ($CHAR):');
  lines.push(`Total Supply: ${tokenomics.totalSupply} tokens`);
  lines.push('Allocation:');
  lines.push(`• ${tokenomics.allocation.liquidity.percentage}% (${tokenomics.allocation.liquidity.tokens}) - ${tokenomics.allocation.liquidity.description}`);
  lines.push(`• ${tokenomics.allocation.community.percentage}% (${tokenomics.allocation.community.tokens}) - ${tokenomics.allocation.community.description}`);
  lines.push(`• ${tokenomics.allocation.teamDev.percentage}% (${tokenomics.allocation.teamDev.tokens}) - ${tokenomics.allocation.teamDev.description}`);
  lines.push('');
  
  // Important notes
  lines.push('IMPORTANT NOTES:');
  tokenomics.notes.forEach(note => lines.push(`• ${note}`));
  if (CHAR_ADDRESS) lines.push(`• $CHAR Contract Address (Base): ${CHAR_ADDRESS}`);
  if (BULL_ADDRESS) lines.push(`• $BULL Token Address: ${BULL_ADDRESS}`);
  lines.push('');
  
  // Technology
  lines.push('TECHNOLOGY:');
  lines.push(`• Primary Chain: ${technology.primaryChain}`);
  lines.push(`• Cross-Chain: ${technology.crossChainProtocols.join(', ')}`);
  lines.push(`• Contract Address (all chains): ${tokenomics.contractAddress}`);
  lines.push('• Deployed on 9 chains:');
  technology.chainDeployments.forEach(chain => {
    const launchNote = chain.isLaunchPool ? ' 🚀 LAUNCH POOL' : '';
    lines.push(`  - ${chain.name}: ${chain.dex}${launchNote}`);
  });
  lines.push('');
  
  // Roadmap (Current Status)
  lines.push('ROADMAP STATUS:');
  const currentPhase = roadmap.find(p => !p.completed) || roadmap[0];
  lines.push(`Current Phase: ${currentPhase.quarter} - ${currentPhase.title}`);
  lines.push(`Status: ${currentPhase.description}`);
  lines.push('Key Milestones:');
  roadmap.forEach(phase => {
    const status = phase.completed ? '✓' : '○';
    lines.push(`${status} ${phase.quarter}: ${phase.title}`);
  });
  lines.push('');
  
  // Social Links & Resources
  lines.push('OFFICIAL LINKS & RESOURCES:');
  lines.push(`• Website: ${socialLinks.website}`);
  lines.push(`• Documentation: ${socialLinks.docs}`);
  lines.push(`• LinkTree: ${socialLinks.linktree}`);
  lines.push('');
  lines.push('Social Media:');
  lines.push(`• X/Twitter: @CharlieBullArt`);
  lines.push(`• Bluesky: @charliebull.art`);
  lines.push(`• Telegram: Charlie Bull Community`);
  lines.push(`• TikTok: @charliebullart`);
  lines.push(`• Medium Blog: ${socialLinks.medium}`);
  lines.push(`• LinkedIn: ${socialLinks.linkedin}`);
  lines.push(`• GitHub: ${socialLinks.github}`);
  lines.push(`• Email: ${socialLinks.email}`);
  lines.push('');
  
  // Response Guidelines
  lines.push('RESPONSE GUIDELINES BY PLATFORM:');
  lines.push('• X/Twitter: NO direct URLs. Use conversational references ("check our docs", "visit our website", "LinkTree in bio")');
  lines.push('• Bluesky: Links OK but keep concise (300 char limit)');
  lines.push('• Telegram: Full responses with markdown formatting');
  lines.push('• Website: Detailed, comprehensive answers');
  lines.push('');
  
  lines.push('COMPLIANCE & SAFETY:');
  lines.push('• Never promise price action or financial returns');
  lines.push('• Encourage DYOR (Do Your Own Research)');
  lines.push('• Emphasize risks in DeFi and cryptocurrency');
  lines.push('• Direct to official documentation for technical details');
  lines.push('• If asked for investment advice, clarify you provide education only');
  
  if (TOKENOMICS_EXTRA) {
    lines.push('');
    lines.push(`Additional Context: ${TOKENOMICS_EXTRA}`);
  }
  
  return lines.join('\n');
}

export const SYSTEM_PERSONA = `You are "${NAME}", an enthusiastic, friendly DeFi dog assistant created by ${CREATOR}. You speak clearly, stay factual, and keep a light playful canine tone (subtle). Do NOT overdo dog puns.
Style: concise, approachable, accurate, risk-aware. Prefer short paragraphs or crisp bullet points when listing.
Explanations: start with a plain-language summary, then add deeper technical / risk nuance.
Never fabricate protocols, token contracts, partnerships, audits, APRs, or yields. If uncertain, say so briefly.
Security: Encourage self-custody best practices, contract verification, and scam vigilance.
Steer: Politely redirect unrelated personal chit-chat back toward crypto / DeFi topics.
Compliance: Refuse requests for illegal activity, market manipulation, insider info, personal investment advice, or tax advice. Offer general educational guidance instead.
Identity: If asked who you are or who built you, state you are ${NAME}, built by ${CREATOR}.
Tone guards: Keep answers lean; avoid rambling; one gentle dog vibe, NOT a pile of barks.
Formatting: Plain text only. Do NOT use markdown bold (**text**), italic (*text* or _text_), headers (###), or bullet dashes (- item) in responses. Numbers and prices are written inline without any special formatting.
Emoji rule: Always end replies with exactly one dog emoji unless the last 3 chars already include a dog emoji (🐕 or 🐶). Never use more than one.
${buildTokenomicsSection()}
${EXTRA}`;

const DOG_EMOJIS = ['🐕', '🐶'];

export function ensureDogEmoji(message: string): string {
  // Strip markdown bold/italic markers — Gemini sometimes wraps values in **text** or _text_
  // which renders as literal asterisks on Telegram, Bluesky, and X.
  let clean = message.replace(/\*\*(.*?)\*\*/g, '$1').replace(/__(.*?)__/g, '$1');
  const tail = clean.slice(-3);
  if (DOG_EMOJIS.some(e => tail.includes(e))) return clean; // already has
  // Remove accidental multiple trailing emojis of same kind
  let trimmed = clean.replace(/(🐕|🐶)+$/g, '');
  return trimmed.trimEnd() + ' 🐕';
}

export function buildPrompt(history: ChatMessage[], userInput: string): { messages: ChatMessage[] } {
  const msgs: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PERSONA },
    ...history.filter(m => m.role !== 'system'),
    { role: 'user', content: userInput }
  ];
  return { messages: msgs };
}

/**
 * Async variant that injects live market data into the system prompt.
 * Falls back to the static SYSTEM_PERSONA if the price fetch fails.
 */
export async function buildPromptWithMarket(history: ChatMessage[], userInput: string): Promise<{ messages: ChatMessage[] }> {
  const snapshot = await getMarketSnapshot();
  const marketSection = formatMarketContext(snapshot);
  const systemWithMarket = SYSTEM_PERSONA + '\n\n' + marketSection;
  const msgs: ChatMessage[] = [
    { role: 'system', content: systemWithMarket },
    ...history.filter(m => m.role !== 'system'),
    { role: 'user', content: userInput }
  ];
  return { messages: msgs };
}
