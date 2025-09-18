import { ChatMessage } from '../types/chat.js';

export interface MemoryStore {
  append(sessionId: string, messages: ChatMessage[]): void;
  get(sessionId: string): ChatMessage[];
  prune(sessionId: string): { messages: ChatMessage[]; truncated: boolean };
  reset(sessionId: string): void;
}

interface SessionMemory {
  messages: ChatMessage[];
}

const MAX_TURNS = 10; // user+assistant pairs (approx)
const MAX_CHAR_BUDGET = 5000; // approx pre-send budget

export class InMemoryStore implements MemoryStore {
  private store = new Map<string, SessionMemory>();

  append(sessionId: string, messages: ChatMessage[]) {
    const session = this.store.get(sessionId) || { messages: [] };
    session.messages.push(...messages.map(m => ({ ...m, ts: Date.now() })));
    this.store.set(sessionId, session);
  }

  get(sessionId: string): ChatMessage[] {
    return this.store.get(sessionId)?.messages.slice() || [];
  }

  prune(sessionId: string) {
    const msgs = this.get(sessionId);
    let truncated = false;
    // Keep only last MAX_TURNS*2 messages (user+assistant) ignoring system
    const conversation = msgs.filter(m => m.role !== 'system');
    if (conversation.length > MAX_TURNS * 2) {
      truncated = true;
    }
    let kept = conversation.slice(-MAX_TURNS * 2);
    // Apply char budget from the end backwards
    let total = 0;
    const reverse: ChatMessage[] = [];
    for (let i = kept.length - 1; i >= 0; i--) {
      const msg = kept[i];
      total += msg.content.length;
      if (total > MAX_CHAR_BUDGET) {
        truncated = true;
        break;
      }
      reverse.push(msg);
    }
    kept = reverse.reverse();
    return { messages: kept, truncated };
  }

  reset(sessionId: string) {
    this.store.delete(sessionId);
  }
}

export const memoryStore = new InMemoryStore();
