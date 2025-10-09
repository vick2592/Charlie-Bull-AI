import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import fetch from 'node-fetch';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel'; title?: string };
    from?: { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
    text?: string;
    entities?: Array<{ offset: number; length: number; type: 'mention' | 'bot_command' | string }>;
    reply_to_message?: { from?: { id: number; is_bot?: boolean; username?: string } };
    new_chat_members?: Array<{ id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string }>;
  };
}

let polling = false;
let offset = 0;
let botUserId: number | null = null;
let botUsername: string | null = null; // without leading '@'

async function callChatAPI(sessionId: string, message: string) {
  try {
    const res = await fetch(`http://127.0.0.1:${config.port}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`chat_api_failed status=${res.status} body=${txt}`);
    }
    const json: any = await res.json();
    return json?.message || 'Temporary tail-chasing. Try again soon. 🐕';
  } catch (err: any) {
    logger.warn({ err: err?.message || err }, 'telegram_forward_failed');
    return 'Temporary tail-chasing. Try again soon. 🐕';
  }
}

async function sendTelegramMessage(chatId: number, text: string) {
  const endpoint = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  if (!res.ok) {
    const t = await res.text();
    logger.warn({ status: res.status, t }, 'telegram_send_failed');
  }
}

async function getBotIdentity() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/getMe`);
    if (!res.ok) {
      logger.warn({ status: res.status }, 'telegram_getMe_failed');
      return;
    }
    const data = (await res.json()) as any;
    if (data?.ok && data.result) {
      botUserId = data.result.id || null;
      botUsername = data.result.username || null;
      logger.info({ botUserId, botUsername }, 'telegram_bot_identity');
    } else {
      logger.warn({ data }, 'telegram_getMe_not_ok');
    }
  } catch (err: any) {
    logger.warn({ err: err?.message || err }, 'telegram_getMe_error');
  }
}

function isPrivateChat(msg: NonNullable<TelegramUpdate['message']>) {
  return msg.chat.type === 'private';
}

function isGroupChat(msg: NonNullable<TelegramUpdate['message']>) {
  return msg.chat.type === 'group' || msg.chat.type === 'supergroup';
}

function extractCommand(text: string): { command: string; args: string } | null {
  if (!text?.startsWith('/')) return null;
  const firstSpace = text.indexOf(' ');
  const token = (firstSpace === -1 ? text : text.slice(0, firstSpace)).trim();
  const args = firstSpace === -1 ? '' : text.slice(firstSpace + 1).trim();
  // Commands can be like /charlie@BotName
  const base = token.split('@')[0].slice(1).toLowerCase();
  return { command: base, args };
}

function mentionsBot(msg: NonNullable<TelegramUpdate['message']>): boolean {
  if (!botUsername || !msg.text) return false;
  // Prefer entities
  if (msg.entities) {
    for (const e of msg.entities) {
      if (e.type === 'mention') {
        const handle = msg.text.substr(e.offset, e.length);
        if (handle.toLowerCase() === ('@' + botUsername).toLowerCase()) return true;
      }
    }
  }
  // Fallback substring check
  return msg.text.toLowerCase().includes(('@' + botUsername).toLowerCase());
}

function isReplyToBot(msg: NonNullable<TelegramUpdate['message']>): boolean {
  if (!msg.reply_to_message?.from) return false;
  if (botUserId && msg.reply_to_message.from.id === botUserId) return true;
  if (botUsername && msg.reply_to_message.from.username && msg.reply_to_message.from.username.toLowerCase() === botUsername.toLowerCase()) return true;
  return false;
}

async function handleGreetingIfAny(msg: NonNullable<TelegramUpdate['message']>) {
  if (!msg.new_chat_members || msg.new_chat_members.length === 0) return false;
  try {
    const names = msg.new_chat_members
      .filter(m => !m.is_bot)
      .map(m => {
        const full = [m.first_name, m.last_name].filter(Boolean).join(' ');
        return full || (m.username ? '@' + m.username : 'friend');
      })
      .filter(Boolean);
    if (names.length === 0) return false;
    const chatName = msg.chat.title || 'the group';
    const content = `Please write a short, warm welcome message (1-2 sentences) for ${names.join(', ')} who just joined ${chatName}. Use Charlie's friendly DeFi-dog voice.`;
    const sessionId = `tg-${msg.chat.id}`;
    const reply = await callChatAPI(sessionId, content);
    await sendTelegramMessage(msg.chat.id, reply);
    return true;
  } catch (err: any) {
    logger.warn({ err: err?.message || err }, 'telegram_greeting_failed');
    return false;
  }
}

async function handleTextMessage(msg: NonNullable<TelegramUpdate['message']>) {
  const text = (msg.text || '').trim();
  if (!text) return;
  const sessionId = `tg-${msg.chat.id}`;

  const cmd = extractCommand(text);
  if (cmd) {
    switch (cmd.command) {
      case 'start':
      case 'help': {
        const help = 'Hi! I\'m Charlie. In groups, mention me or reply to me, or use /charlie <your question>. In DMs, just chat with me. 🐕';
        await sendTelegramMessage(msg.chat.id, help);
        return;
      }
      case 'charlie': {
        if (!cmd.args) {
          await sendTelegramMessage(msg.chat.id, 'Try: /charlie summarize the latest crypto news 🐕');
          return;
        }
        const reply = await callChatAPI(sessionId, cmd.args);
        await sendTelegramMessage(msg.chat.id, reply);
        return;
      }
      default: {
        await sendTelegramMessage(msg.chat.id, 'Unknown command. Try /charlie or /help 🐕');
        return;
      }
    }
  }

  // Non-command text
  let content = text;
  if (botUsername) {
    const mention = new RegExp('^@' + botUsername + '\\b', 'i');
    content = content.replace(mention, '').trim();
  }
  const reply = await callChatAPI(sessionId, content);
  await sendTelegramMessage(msg.chat.id, reply);
}

async function poll() {
  if (polling) return;
  polling = true;
  logger.info('telegram_polling_started');
  try {
    if (!botUserId || !botUsername) {
      await getBotIdentity();
    }
    while (config.telegramPolling) {
      const url = new URL(`https://api.telegram.org/bot${config.telegramBotToken}/getUpdates`);
      url.searchParams.set('timeout', '30');
      if (offset) url.searchParams.set('offset', String(offset));
      const res = await fetch(url.href);
      if (!res.ok) {
        logger.warn({ status: res.status }, 'telegram_poll_failed');
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
  const data = (await res.json()) as any as { ok: boolean; result: TelegramUpdate[] };
      if (!data.ok) {
        logger.warn({ data }, 'telegram_poll_not_ok');
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      for (const upd of data.result) {
        offset = upd.update_id + 1;
        const msg = upd.message;
        if (!msg) continue;

        // Chat allowlist: only process messages from specific chat IDs if configured
        const chatIdStr = String(msg.chat.id);
        if (config.telegramAllowedChatIds.length > 0 && !config.telegramAllowedChatIds.includes(chatIdStr)) {
          logger.info({ chatId: chatIdStr }, 'telegram_chat_ignored_not_in_allowlist');
          continue;
        }

        // Greetings for new members (even if no text)
        if (msg.new_chat_members && msg.new_chat_members.length > 0) {
          const greeted = await handleGreetingIfAny(msg);
          if (greeted) continue;
        }

        // If there's no text, nothing else to do
        if (!msg.text) continue;

        // User allowlist applies to text interactions
        const userId = msg.from?.id;
        if (userId && config.telegramAllowedUserIds.length > 0 && !config.telegramAllowedUserIds.includes(String(userId))) {
          logger.info({ userId }, 'telegram_message_ignored_not_allowed');
          continue;
        }

        // DM: always respond unless a chat allowlist is set (then restrict to specified chats only)
        if (isPrivateChat(msg)) {
          if (config.telegramAllowedChatIds.length > 0) {
            logger.info({ chatId: chatIdStr }, 'telegram_dm_ignored_due_to_chat_allowlist');
            continue;
          }
          await handleTextMessage(msg);
          continue;
        }
        // Group chats: respond only to commands, mentions, or replies to the bot
        if (isGroupChat(msg)) {
          const cmd = extractCommand(msg.text || '');
          if (cmd || mentionsBot(msg) || isReplyToBot(msg)) {
            await handleTextMessage(msg);
          } else {
            logger.debug?.({ chatType: msg.chat.type }, 'telegram_group_message_ignored');
          }
          continue;
        }
        // Ignore channels by default
        logger.debug?.({ chatType: msg.chat.type }, 'telegram_non_dm_non_group_ignored');
      }
    }
  } catch (err: any) {
    logger.error({ err: err?.message || err }, 'telegram_polling_crashed');
  } finally {
    polling = false;
    logger.info('telegram_polling_stopped');
  }
}

export function startTelegramIfConfigured() {
  if (!config.telegramBotToken) {
    logger.info('telegram_not_configured_no_token');
    return;
  }
  if (!config.telegramPolling) {
    logger.info('telegram_disabled_polling_flag_false');
    return;
  }
  poll();
}
