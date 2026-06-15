import { useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useAIStore, type IntentResult } from '@/store/ai';
import { useAuthStore } from '@/store/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BackendChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Try to parse a structured IntentParseResult JSON block from the final
 * assistant message. The backend sometimes appends a JSON block like:
 * ```json
 * { "segment_rules": {...}, "segment_name": "...", ... }
 * ```
 * or embeds it in the reasoning text.
 */
function tryParseIntentResult(text: string): IntentResult | undefined {
  // Try to find a JSON block in the response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/i) ??
                    text.match(/(\{[\s\S]*"segment_rules"[\s\S]*\})/);
  if (!jsonMatch) return undefined;

  try {
    const parsed = JSON.parse(jsonMatch[1]) as Partial<IntentResult>;
    if (parsed.segment_rules && parsed.segment_name) {
      return parsed as IntentResult;
    }
  } catch {
    // Not valid JSON — ignore
  }
  return undefined;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useAIChat
 *
 * Manages the streaming AI chat session.
 * - Sends full conversation history on every turn (backend is stateless)
 * - Streams `token` events → appends to the assistant's in-progress message
 * - On `done` event → marks streaming complete, tries to parse IntentResult
 * - On `error` event → sets error text in assistant bubble
 */
export function useAIChat() {
  const { messages, addMessage, updateLastMessage, setStreaming } = useAIStore();

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;

      const token = useAuthStore.getState().token;
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';
      const chatUrl = `${baseUrl}/ai/chat`;

      // 1. Add the user message to the store
      addMessage({ role: 'user', content: prompt });

      // 2. Add an empty assistant message that will be filled with streamed tokens
      addMessage({ role: 'assistant', content: '' });

      setStreaming(true);

      // Build message history for the backend (stateless — send full history)
      // Use the messages snapshot at this point (before the empty assistant msg)
      const historyForBackend: BackendChatMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: prompt },
      ];

      let accumulatedContent = '';

      try {
        await fetchEventSource(chatUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token ?? ''}`,
          },
          body: JSON.stringify({ messages: historyForBackend }),

          onmessage: (event) => {
            if (event.event === 'token') {
              // Each token event has a raw text chunk as data
              accumulatedContent += event.data;
              updateLastMessage(accumulatedContent);
            } else if (event.event === 'done') {
              // Stream finished — try to extract structured result
              const result = tryParseIntentResult(accumulatedContent);
              updateLastMessage(accumulatedContent, result);
              setStreaming(false);
            } else if (event.event === 'error') {
              let errDetail = 'AI error occurred.';
              try {
                const parsed = JSON.parse(event.data) as { detail?: string };
                if (parsed.detail) errDetail = parsed.detail;
              } catch {
                // use default
              }
              updateLastMessage(
                accumulatedContent
                  ? accumulatedContent + '\n\n⚠️ ' + errDetail
                  : '⚠️ ' + errDetail
              );
              setStreaming(false);
            }
          },

          onerror: (err) => {
            if (err instanceof DOMException && err.name === 'AbortError') throw err;
            updateLastMessage(
              accumulatedContent || '⚠️ Connection error. Please try again.'
            );
            setStreaming(false);
            throw err; // stop retrying
          },

          onclose: () => {
            // Connection closed cleanly before a 'done' event (e.g. network drop)
            if (accumulatedContent) {
              const result = tryParseIntentResult(accumulatedContent);
              updateLastMessage(accumulatedContent, result);
            }
            setStreaming(false);
          },
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof Error && err.name === 'AbortError') return;
        // Network-level failure
        updateLastMessage(
          accumulatedContent || '⚠️ Failed to connect to AI. Please try again.'
        );
        setStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages]
  );

  return { sendMessage };
}
