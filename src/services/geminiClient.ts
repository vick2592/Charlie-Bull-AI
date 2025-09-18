import { config } from '../lib/config.js';
import { ChatMessage } from '../types/chat.js';
import { ensureDogEmoji } from './persona.js';

// Lazy import to avoid crash if dependency missing in initial scaffold
let genAI: any;
try {
  // @ts-ignore dynamic
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  if (config.geminiApiKey) {
    genAI = new GoogleGenerativeAI(config.geminiApiKey);
  }
} catch {
  // ignore
}

export async function generateWithGemini(messages: ChatMessage[]): Promise<{ text: string; tokensIn?: number; tokensOut?: number }> {
  if (!genAI) {
    // Mocked fallback
    const lastUser = messages.filter(m => m.role === 'user').slice(-1)[0];
    const mock = `Mock response about: ${lastUser?.content?.slice(0, 60) || '...'} — (demo) 🐕`;
    return { text: ensureDogEmoji(mock) };
  }

  // Simple mapping to model input (Gemini expects combined context differently; placeholder implementation)
  const userContent = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(userContent);
    const response = result.response;
    const text = response.text();
    return { text: ensureDogEmoji(text) };
  } catch (err) {
    return { text: ensureDogEmoji('I hit a temporary snag fetching data. Try again shortly.') };
  }
}
