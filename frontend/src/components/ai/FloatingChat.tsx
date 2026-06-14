import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { MessageCircle, X, Sparkles, Send, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FloatingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  result?: {
    segment_name?: string;
    segment_rules?: any;
    reasoning?: string;
  };
}

interface BackendChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tryParseIntentResult(text: string): FloatingMessage['result'] | undefined {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/i) ??
                    text.match(/(\{[\s\S]*"segment_rules"[\s\S]*\})/);
  if (!jsonMatch) return undefined;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.segment_rules && parsed.segment_name) {
      return parsed;
    }
  } catch {
    // Not valid JSON
  }
  return undefined;
}

const SUGGESTIONS = [
  "Who are my top customers?",
  "Find lapsed VIP customers",
  "Draft a win-back message"
];

// ── Component ─────────────────────────────────────────────────────────────────

export function FloatingChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<FloatingMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Hide on /ai page
  if (location.pathname === '/ai') {
    return null;
  }

  // Reset history when toggled
  const handleToggle = () => {
    if (isOpen) {
      setMessages([]); // Reset on close
    }
    setIsOpen(!isOpen);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: FloatingMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };

    const assistantMsgId = crypto.randomUUID();
    const assistantMessage: FloatingMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsStreaming(true);

    const token = useAuthStore.getState().token;
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';
    const apiRoot = baseUrl.replace(/\/v1\/?$/, '');
    const chatUrl = `${apiRoot}/ai/chat`;

    // Snapshotted messages for backend
    const historyForBackend: BackendChatMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    let accumulatedContent = '';

    const updateMsg = (content: string, result?: FloatingMessage['result']) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content, result }
            : m
        )
      );
    };

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
            accumulatedContent += event.data;
            updateMsg(accumulatedContent);
          } else if (event.event === 'done') {
            const result = tryParseIntentResult(accumulatedContent);
            updateMsg(accumulatedContent, result);
            setIsStreaming(false);
          } else if (event.event === 'error') {
            let errDetail = 'AI error occurred.';
            try {
              const parsed = JSON.parse(event.data);
              if (parsed.detail) errDetail = parsed.detail;
            } catch {}
            updateMsg(
              accumulatedContent
                ? accumulatedContent + '\n\n⚠️ ' + errDetail
                : '⚠️ ' + errDetail
            );
            setIsStreaming(false);
          }
        },
        onerror: (err) => {
          if (err instanceof DOMException && err.name === 'AbortError') throw err;
          updateMsg(accumulatedContent || '⚠️ Connection error. Please try again.');
          setIsStreaming(false);
          throw err;
        },
        onclose: () => {
          if (accumulatedContent && isStreaming) {
            const result = tryParseIntentResult(accumulatedContent);
            updateMsg(accumulatedContent, result);
          }
          setIsStreaming(false);
        },
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.name === 'AbortError') return;
      updateMsg(accumulatedContent || '⚠️ Failed to connect to AI. Please try again.');
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Panel */}
      {isOpen && (
        <div
          className="mb-4 flex flex-col overflow-hidden origin-bottom-right transition-all duration-200 glass-card shadow-lg"
          style={{
            width: '380px',
            height: '520px',
            animation: 'scaleIn 200ms ease-out',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white/50 dark:bg-[#131720]/50 backdrop-blur-md px-5 py-4">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-blue-500 dark:text-blue-400">
                <Sparkles className="h-4 w-4" />
                Aura AI
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ask me anything about your customers</p>
            </div>
            <button
              onClick={handleToggle}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 ? (
              <div className="mt-auto space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">Suggested questions:</p>
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="block w-full text-left rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:border-blue-500/40 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/10 shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content || (msg.role === 'assistant' && ' ')}</p>
                    
                    {/* Streaming Indicator */}
                    {msg.role === 'assistant' && isStreaming && !msg.content && (
                      <div className="flex gap-1 py-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}

                    {/* Actionable Result */}
                    {msg.result && (
                      <div className="mt-3">
                        <button
                          onClick={() => {
                            setIsOpen(false);
                            navigate('/ai', { state: { prefill: msg.result } });
                          }}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 dark:hover:bg-blue-500/30 px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          Open in AI Studio
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-slate-50/50 dark:bg-[#1a1f2e]/50 border-t border-slate-200 dark:border-white/10">
            <div className="relative flex items-end overflow-hidden rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/15 focus-within:border-blue-500 focus-within:ring-[3px] focus-within:ring-blue-500/20 dark:focus-within:border-blue-400/50 dark:focus-within:ring-blue-400/10 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your customers..."
                className="max-h-[120px] min-h-[44px] w-full resize-none bg-transparent py-3 pl-3 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                rows={1}
              />
              <button
                onClick={() => handleSend(input)}
                disabled={!input.trim() || isStreaming}
                className="absolute bottom-1 right-1 rounded-lg p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={handleToggle}
        className="relative flex h-14 w-14 items-center justify-center rounded-full text-white bg-blue-500 shadow-lg hover:-translate-y-1 transition-transform"
      >
        {!isOpen && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-blue-400/40" />
        )}
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      <style>{`
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
