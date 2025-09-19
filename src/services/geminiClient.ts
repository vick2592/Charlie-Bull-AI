import { config } from '../lib/config.js';
import { ChatMessage } from '../types/chat.js';
import { ensureDogEmoji } from './persona.js';
import { logger } from '../lib/logger.js';
import fetch from 'node-fetch';

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

export async function generateWithGemini(messages: ChatMessage[]): Promise<{ text: string; modelUsed?: string }> {
  const userMessages = messages.filter(m => m.role === 'user');
  const lastUser = userMessages.slice(-1)[0];
  if (!config.geminiApiKey) {
    const mock = `Mock response about: ${lastUser?.content?.slice(0, 80) || '...'} — (demo)`;
    return { text: ensureDogEmoji(mock) };
  }

  const modelsToTry = config.geminiModels?.length ? config.geminiModels : [config.geminiModel];
  const parts = messages.map(m => ({ role: m.role, content: m.content }));

  // Build REST formatted contents array (Gemini expects an array of {parts:[{text:...}]} with role semantics in content ordering).
  const content = parts.map(p => ({ parts: [{ text: `${p.role.toUpperCase()}: ${p.content}` }] }));

  for (const modelName of modelsToTry) {
    // Try SDK first if available
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(content.map(c => c.parts[0].text).join('\n'));
        const response = result.response;
        const text = response.text();
        if (text) return { text: ensureDogEmoji(text), modelUsed: modelName };
        throw new Error('Empty response text');
      } catch (err: any) {
        logger.warn({ err: err?.message || err, modelName }, 'gemini_sdk_attempt_failed');
      }
    }

    // REST fallback
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const body = { contents: content };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errTxt = await res.text();
        logger.warn({ status: res.status, errTxt, modelName }, 'gemini_rest_attempt_failed');
        continue;
      }
      const json: any = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('\n');
      if (text) return { text: ensureDogEmoji(text), modelUsed: modelName };
      logger.warn({ modelName, json }, 'gemini_rest_empty_text');
    } catch (err: any) {
      logger.warn({ err: err?.message || err, modelName }, 'gemini_rest_exception');
    }
  }

  return { text: ensureDogEmoji('I hit a temporary snag fetching data. Try again shortly.') };
}
