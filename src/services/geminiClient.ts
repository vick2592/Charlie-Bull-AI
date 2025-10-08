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

let listedModels: string[] | null = null;
async function ensureModelList() {
  if (!genAI || listedModels) return;
  try {
    // @ts-ignore dynamic type
    const models = await genAI.listModels?.();
    if (Array.isArray(models)) {
      listedModels = models.map((m: any) => m.name?.replace(/^models\//, '')).filter(Boolean);
      logger.info({ listedModels }, 'gemini_models_listed');
    }
  } catch (err: any) {
    logger.warn({ err: err?.message || err }, 'gemini_list_models_failed');
  }
}

export async function generateWithGemini(messages: ChatMessage[]): Promise<{ text: string; modelUsed?: string }> {
  const userMessages = messages.filter(m => m.role === 'user');
  const lastUser = userMessages.slice(-1)[0];
  if (!config.geminiApiKey) {
    const mock = `Mock response about: ${lastUser?.content?.slice(0, 80) || '...'} — (demo)`;
    return { text: ensureDogEmoji(mock) };
  }

  const normalizeModel = (name: string) => {
    // Map legacy names (without -latest) to current GA suffix to reduce 404 risk
    if (/^gemini-1\.5-pro$/.test(name)) return 'gemini-1.5-pro-latest';
    if (/^gemini-1\.5-flash$/.test(name)) return 'gemini-1.5-flash-latest';
    if (/^gemini-1\.5-flash-8b$/.test(name)) return 'gemini-1.5-flash-8b-latest';
    if (/^gemini-pro$/.test(name)) return 'gemini-pro'; // keep for backward compat (may be deprecated)
    if (/^gemini-2\.0-flash$/.test(name)) return 'gemini-2.0-flash';
    return name;
  };
  const modelsToTry = (config.geminiModels?.length ? config.geminiModels : [config.geminiModel]).map(normalizeModel);
  await ensureModelList();
  if (listedModels) {
    const missing = modelsToTry.filter(m => !listedModels!.includes(m));
    if (missing.length) {
      logger.warn({ configured: modelsToTry, missing, available: listedModels }, 'gemini_configured_models_missing_from_list');
    }
  }
  const parts = messages.map(m => ({ role: m.role, content: m.content }));

  // Build REST formatted contents array (Gemini expects an array of {parts:[{text:...}]} with role semantics in content ordering).
  const content = parts.map(p => ({ parts: [{ text: `${p.role.toUpperCase()}: ${p.content}` }] }));

  let lastFailure: any = null;
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
        lastFailure = { source: 'sdk', modelName, message: err?.message || String(err) };
        logger.warn({ err: err?.message || err, modelName }, 'gemini_sdk_attempt_failed');
      }
    }

    // REST fallback
    try {
  const apiVersion = config.geminiApiVersion || 'v1';
  const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const body = { contents: content };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errTxt = await res.text();
        lastFailure = { source: 'rest', modelName, status: res.status, errTxt: errTxt.slice(0, 500) };
        logger.warn({ status: res.status, errTxt, modelName }, 'gemini_rest_attempt_failed');
        continue;
      }
      const json: any = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('\n');
      if (text) return { text: ensureDogEmoji(text), modelUsed: modelName };
      logger.warn({ modelName, json }, 'gemini_rest_empty_text');
      lastFailure = { source: 'rest_empty', modelName };
    } catch (err: any) {
      lastFailure = { source: 'rest_exception', modelName, message: err?.message || String(err) };
      logger.warn({ err: err?.message || err, modelName }, 'gemini_rest_exception');
    }
  }
  if (lastFailure) {
    logger.error({ lastFailure, tried: modelsToTry }, 'gemini_all_models_failed');
  } else {
    logger.error({ tried: modelsToTry }, 'gemini_all_models_failed_no_detail');
  }
  const reasonSnippet = lastFailure?.status ? ` (last HTTP ${lastFailure.status})` : '';
  return { text: ensureDogEmoji(`I hit a temporary snag fetching data${reasonSnippet}. Try again shortly.`) };
}
