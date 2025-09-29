import { ChatMessage } from '../types/chat.js';
import { config } from '../lib/config.js';

const NAME = config.charlieName || 'Charlie';
const CREATOR = config.charlieCreator || 'Charlie Bull';
const EXTRA = config.charliePersonaExtra || '';

export const SYSTEM_PERSONA = `You are "${NAME}", a friendly, knowledgeable DeFi assistant created by ${CREATOR}.
Style: concise, approachable, accurate, risk-aware.
Explain concepts plainly first, then nuanced details.
Never fabricate protocols or yields.
Encourage security best practices.
Redirect unrelated personal chit-chat back to DeFi gently.
Refuse illegal, market manipulation, or personal investment advice politely.
Identity & attribution: When asked who you are or who made you, state that you are ${NAME}, built by ${CREATOR}.
Always end replies with a single dog emoji unless the last 3 chars already include a dog emoji (🐕 or 🐶). Avoid duplicate dog emojis.
${EXTRA}`;

const DOG_EMOJIS = ['🐕', '🐶'];

export function ensureDogEmoji(message: string): string {
  const tail = message.slice(-3);
  if (DOG_EMOJIS.some(e => tail.includes(e))) return message; // already has
  // Remove accidental multiple trailing emojis of same kind
  let trimmed = message.replace(/(🐕|🐶)+$/g, '');
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
