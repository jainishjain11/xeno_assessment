import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { Sparkles, Send, Trash2, User, Bot, Paperclip } from 'lucide-react';
import { useAIStore } from '@/store/ai';
import { useAIChat } from '@/hooks/useAIChat';
import { IntentResultCard } from '@/components/ai/IntentResultCard';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  {
    icon: '🔍',
    text: 'Find high-value customers who haven\'t ordered in 30 days',
  },
  {
    icon: '✍️',
    text: 'Draft a WhatsApp message for customers in Mumbai',
  },
  {
    icon: '📊',
    text: 'Who are my top 100 spenders this quarter?',
  },
  {
    icon: '🔄',
    text: 'Create a re-engagement campaign for churned VIP customers',
  },
] as const;

// ── Markdown-lite renderer ────────────────────────────────────────────────────
// Simple inline rendering: **bold**, *italic*, `code`, and newlines.
// No external markdown library needed.

function renderMarkdown(text: string): React.ReactNode[] {
  // Split by lines first to handle paragraphs/lists
  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    const parts: React.ReactNode[] = [];
    // Match bold (**text**), italic (*text*), and inline code (`text`)
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(<strong key={match.index}>{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(<em key={match.index}>{match[3]}</em>);
      } else if (match[4]) {
        parts.push(
          <code
            key={match.index}
            className="rounded bg-muted px-1 py-0.5 text-xs font-mono"
          >
            {match[4]}
          </code>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return (
      <span key={lineIdx}>
        {parts.length ? parts : '\u00A0'}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-crm-blue-dim dark:text-blue-500">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-slate-50 dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/[0.07] px-4 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  result?: import('@/store/ai').IntentResult;
  isStreaming?: boolean;
}

function MessageBubble({ role, content, result, isStreaming }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex items-end justify-end gap-2.5">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-blue-500 px-4 py-3 text-sm text-white shadow-sm">
          {content}
        </div>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300">
          <User className="h-4 w-4" />
        </div>
      </div>
    );
  }

  // Assistant bubble
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-crm-blue-dim dark:text-blue-500">
        <Bot className="h-4 w-4" />
      </div>
      <div className="max-w-[80%]">
        {/* Text bubble */}
        {(content || isStreaming) && (
          <div className="rounded-2xl rounded-tl-sm bg-white dark:bg-[#131720] border border-slate-200 dark:border-white/10 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 shadow-sm leading-relaxed">
            {content ? renderMarkdown(content) : null}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-blue-500 align-text-bottom" />
            )}
          </div>
        )}
        {/* Structured result card */}
        {result && !isStreaming && <IntentResultCard result={result} />}
      </div>
    </div>
  );
}

// ── Empty state (suggested prompts) ──────────────────────────────────────────

interface EmptyStateProps {
  onSelectPrompt: (text: string) => void;
}

function EmptyState({ onSelectPrompt }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 dark:bg-crm-blue-dim dark:text-blue-500">
        <Sparkles className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Aura AI Assistant</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        Your AI-powered marketing co-pilot. Describe your audience, draft messages,
        or ask for campaign recommendations — all in plain language.
      </p>

      <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt.text}
            id={`suggested-prompt-${SUGGESTED_PROMPTS.indexOf(prompt)}`}
            onClick={() => onSelectPrompt(prompt.text)}
            className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131720] p-3 text-left transition-all hover:border-blue-500/40 hover:bg-slate-50 dark:hover:bg-crm-blue-dim hover:shadow-sm"
          >
            <span className="text-xl leading-none">{prompt.icon}</span>
            <span className="text-sm text-slate-900 dark:text-slate-100">{prompt.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AIAssistant() {
  const [input, setInput] = useState('');
  const { messages, isStreaming, clearHistory } = useAIStore();
  const { sendMessage } = useAIChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    await sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const handleSelectPrompt = useCallback(
    async (text: string) => {
      setInput('');
      await sendMessage(text);
    },
    [sendMessage]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col rounded-xl border border-slate-200 dark:border-white/10 bg-background shadow-sm overflow-hidden glass-card">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white/50 dark:bg-[#131720]/50 backdrop-blur-md px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-crm-blue-dim dark:text-blue-500">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Aura AI</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Marketing Intelligence</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            id="clear-chat-btn"
            onClick={clearHistory}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            title="Clear chat history"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col px-4 py-5">
          {messages.length === 0 ? (
            <EmptyState onSelectPrompt={handleSelectPrompt} />
          ) : (
            <div className="space-y-5">
              {messages.map((msg, i) => {
                // Show typing indicator on the last message if it's an
                // in-progress (empty content) assistant message
                const isLastAssistant =
                  i === messages.length - 1 &&
                  msg.role === 'assistant' &&
                  isStreaming &&
                  msg.content === '';

                if (isLastAssistant) {
                  return <TypingIndicator key={msg.id} />;
                }

                const isStreamingThisMsg =
                  i === messages.length - 1 &&
                  msg.role === 'assistant' &&
                  isStreaming &&
                  msg.content !== '';

                return (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    result={msg.result}
                    isStreaming={isStreamingThisMsg}
                  />
                );
              })}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1f2e] p-4">
        <div className="flex items-end gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131720] px-4 py-2.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 dark:focus-within:border-blue-400/50 dark:focus-within:ring-blue-400/10 transition-all">
          {/* Attach placeholder */}
          <button
            id="attach-btn"
            className="mb-1 flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Attach file (coming soon)"
            disabled
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            id="ai-chat-input"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your customers, campaigns, or audience…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 min-h-[24px] max-h-[180px] py-1 leading-6"
          />

          {/* Send button */}
          <Button
            id="send-message-btn"
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="mb-0.5 flex-shrink-0 h-8 w-8 p-0 rounded-lg"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
          Press <kbd className="rounded border border-slate-200 dark:border-white/10 px-1 py-0.5 text-[10px]">Enter</kbd> to send ·{' '}
          <kbd className="rounded border border-slate-200 dark:border-white/10 px-1 py-0.5 text-[10px]">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}
