import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IntentResult {
  segment_rules: {
    operator: 'AND' | 'OR';
    rules: Array<{ field: string; op: string; value: string | number }>;
  };
  segment_name: string;
  message_draft: string;
  recommended_channel: string;
  reasoning: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Populated when AI returns structured IntentParseResult */
  result?: IntentResult;
}

interface AIState {
  messages: ChatMessage[];
  isStreaming: boolean;

  // Actions
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateLastMessage: (content: string, result?: IntentResult) => void;
  clearHistory: () => void;
  setStreaming: (streaming: boolean) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

/**
 * AI chat store — session-only (no persistence).
 * Chat history is cleared on page refresh, matching the user expectation for
 * a conversational, stateless AI assistant.
 */
export const useAIStore = create<AIState>()((set) => ({
  messages: [],
  isStreaming: false,

  addMessage: (msg) => {
    const id = crypto.randomUUID();
    const message: ChatMessage = {
      ...msg,
      id,
      timestamp: new Date(),
    };
    set((state) => ({ messages: [...state.messages, message] }));
    return id;
  },

  updateLastMessage: (content, result) => {
    set((state) => {
      const messages = [...state.messages];
      const lastIdx = messages.length - 1;
      if (lastIdx < 0) return state;
      messages[lastIdx] = { ...messages[lastIdx], content, result };
      return { messages };
    });
  },

  clearHistory: () => set({ messages: [], isStreaming: false }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),
}));
