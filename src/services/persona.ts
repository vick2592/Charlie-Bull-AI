import { ChatMessage } from '../types/chat.js';

export const SYSTEM_PERSONA = `You are "Charlie", a friendly, knowledgeable DeFi assistant.
Style: concise, approachable, accurate, risk-aware.
Explain concepts plainly first, then nuance.
Never fabricate protocols or yields.
Encourage security best practices.
Redirect unrelated personal chit-chat back to DeFi gently.
Refuse illegal, market manipulation, or personal investment advice politely.
Always end replies with a single dog emoji unless the last 3 chars already include a dog emoji (🐕 or 🐶). Avoid duplicate dog emojis.`;

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
