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

/**
 * Build Gemini-compatible contents array from chat messages.
 * - Extracts system message (passed separately via systemInstruction)
 * - Converts assistant → model role
 * - Merges consecutive same-role messages (Gemini requires strict user/model alternation)
 * - Ensures the last message is from the user
 */
function buildGeminiContents(messages: ChatMessage[]): {
  systemContent: string | undefined;
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
} {
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs = messages.filter(m => m.role !== 'system');

  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const msg of chatMsgs) {
    const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      // Merge consecutive same-role messages
      last.parts[0].text += '\n\n' + msg.content;
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  // Gemini requires the last content to be from the user
  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: '...' }] });
  } else if (contents[contents.length - 1].role !== 'user') {
    logger.warn('buildGeminiContents: last message is not user role — appending placeholder');
    contents.push({ role: 'user', parts: [{ text: '...' }] });
  }

  return { systemContent: systemMsg?.content, contents };
}

export async function generateWithGemini(messages: ChatMessage[]): Promise<{ text: string; modelUsed?: string; isError?: boolean }> {
  const userMessages = messages.filter(m => m.role === 'user');
  const lastUser = userMessages.slice(-1)[0];
  if (!config.geminiApiKey) {
    const mock = `Mock response about: ${lastUser?.content?.slice(0, 80) || '...'} — (demo)`;
    return { text: ensureDogEmoji(mock) };
  }

  const normalizeModel = (name: string) => {
    // Pro models → flash-lite: gemini-3.1-pro-preview has 0 RPM on free tier.
    // If you upgrade to paid, set GEMINI_MODELS explicitly in your env instead of relying on the normalizer.
    if (/^gemini-2\.5-pro(-latest)?$/.test(name)) return 'gemini-3.1-flash-lite-preview';
    if (/^gemini-1\.5-pro(-latest)?$/.test(name)) return 'gemini-3.1-flash-lite-preview';
    if (/^gemini-3\.1-pro(-preview)?$/.test(name)) return 'gemini-3.1-flash-lite-preview';
    // Flash → keep as flash-lite for free tier headroom
    if (/^gemini-2\.5-flash(-latest)?$/.test(name)) return 'gemini-3.1-flash-lite-preview';
    if (/^gemini-2\.5-flash-lite(-latest)?$/.test(name)) return 'gemini-2.5-flash-lite';
    if (/^gemini-1\.5-flash(-latest)?$/.test(name)) return 'gemini-3.1-flash-lite-preview';
    if (/^gemini-1\.5-flash-8b(-latest)?$/.test(name)) return 'gemini-3.1-flash-lite-preview';
    // 2.0 deprecated June 1, 2026
    if (/^gemini-2\.0-flash(-lite)?$/.test(name)) return 'gemini-2.5-flash-lite';
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

  const { systemContent, contents } = buildGeminiContents(messages);

  let lastFailure: any = null;
  for (const modelName of modelsToTry) {
    // Preview and experimental models must use v1beta endpoint
    const apiVersion = (modelName.includes('-preview') || modelName.includes('-exp'))
      ? 'v1beta'
      : (config.geminiApiVersion || 'v1beta');

    // Try SDK first if available
    if (genAI) {
      try {
        const modelConfig: any = { model: modelName };
        if (systemContent) {
          modelConfig.systemInstruction = { parts: [{ text: systemContent }] };
        }
        const model = genAI.getGenerativeModel(modelConfig);
        const result = await model.generateContent({ contents });
        const text = result.response.text();
        if (text) return { text: ensureDogEmoji(text), modelUsed: modelName };
        throw new Error('Empty response text');
      } catch (err: any) {
        lastFailure = { source: 'sdk', modelName, message: err?.message || String(err) };
        logger.warn({ err: err?.message || err, modelName }, 'gemini_sdk_attempt_failed');
      }
    }

    // REST fallback
    try {
      const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
      const body: any = { contents };
      if (systemContent) {
        body.systemInstruction = { parts: [{ text: systemContent }] };
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errTxt = await res.text();
        lastFailure = { source: 'rest', modelName, status: res.status, apiVersion, errTxt: errTxt.slice(0, 500) };
        logger.warn({ status: res.status, errTxt, modelName, apiVersion }, 'gemini_rest_attempt_failed');
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
  // isError=true tells callers (e.g. the social media scheduler) that this is a failure
  // message, NOT real generated content. The scheduler will skip posting when isError is true.
  // Chat and Telegram callers ignore isError and show the message to the user, which is fine.
  return {
    text: ensureDogEmoji(`I hit a temporary snag fetching data${reasonSnippet}. Try again shortly.`),
    isError: true
  };
}

