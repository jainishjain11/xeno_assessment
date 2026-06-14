import { useNavigate } from 'react-router-dom';
import { Layers, Megaphone, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { IntentResult } from '@/store/ai';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  total_spent: 'Total Spent',
  order_count: 'Order Count',
  last_order_at: 'Last Order Date',
  city: 'City',
  tags: 'Tags',
};

const OP_LABELS: Record<string, string> = {
  eq: 'equals',
  neq: 'does not equal',
  gt: 'greater than',
  gte: 'at least',
  lt: 'less than',
  lte: 'at most',
  contains: 'contains',
  not_contains: 'does not contain',
  is_null: 'has no value',
};

const DATE_LABELS: Record<string, string> = {
  "NOW() - INTERVAL '7 days'": '7 days ago',
  "NOW() - INTERVAL '14 days'": '14 days ago',
  "NOW() - INTERVAL '30 days'": '30 days ago',
  "NOW() - INTERVAL '60 days'": '60 days ago',
  "NOW() - INTERVAL '90 days'": '90 days ago',
  "NOW() - INTERVAL '180 days'": '180 days ago',
  "NOW() - INTERVAL '1 year'": '1 year ago',
};

function humanizeValue(field: string, value: string | number): string {
  const str = value?.toString() ?? '';
  if (DATE_LABELS[str]) return DATE_LABELS[str];
  if (field === 'total_spent' && !Number.isNaN(Number(value)))
    return `₹${Number(value).toLocaleString('en-IN')}`;
  return str;
}

function humanizeRule(rule: { field: string; op: string; value: string | number }): string {
  const fieldLabel = FIELD_LABELS[rule.field] ?? rule.field;
  const opLabel = OP_LABELS[rule.op] ?? rule.op;
  if (rule.op === 'is_null') return `${fieldLabel} has no value`;
  return `${fieldLabel} ${opLabel} ${humanizeValue(rule.field, rule.value)}`;
}

const CHANNEL_CONFIG: Record<string, { label: string; cls: string; emoji: string }> = {
  whatsapp: { label: 'WhatsApp', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', emoji: '💬' },
  sms: { label: 'SMS', cls: 'bg-sky-100 text-sky-700 border-sky-200', emoji: '📱' },
  email: { label: 'Email', cls: 'bg-purple-100 text-purple-700 border-purple-200', emoji: '✉️' },
  rcs: { label: 'RCS', cls: 'bg-orange-100 text-orange-700 border-orange-200', emoji: '🌐' },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface IntentResultCardProps {
  result: IntentResult;
}

export function IntentResultCard({ result }: IntentResultCardProps) {
  const navigate = useNavigate();

  const channelCfg = CHANNEL_CONFIG[result.recommended_channel?.toLowerCase()] ?? {
    label: result.recommended_channel ?? 'WhatsApp',
    cls: 'bg-gray-100 text-gray-700 border-gray-200',
    emoji: '📣',
  };

  const rules = Array.isArray(result.segment_rules?.rules)
    ? result.segment_rules.rules
    : [];

  const operator = result.segment_rules?.operator ?? 'AND';

  // Build the state objects passed to the destination pages via React Router state
  const segmentState = {
    prefill: {
      name: result.segment_name,
      filter_rules: result.segment_rules,
    },
  };

  const campaignState = {
    prefill: {
      segment_name: result.segment_name,
      filter_rules: result.segment_rules,
      message_template: result.message_draft,
      channel: result.recommended_channel,
    },
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-blue-500/20 bg-white dark:bg-[#131720] shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 bg-blue-50 dark:bg-crm-blue-dim px-4 py-3">
        <Sparkles className="h-4 w-4 text-blue-500 dark:text-blue-400" />
        <span className="text-sm font-semibold text-blue-500 dark:text-blue-400">AI Recommendation</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Segment name */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Suggested Segment
          </p>
          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{result.segment_name}</p>
        </div>

        {/* Rules summary */}
        {rules.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Rules ({operator})
            </p>
            <ul className="space-y-1.5">
              {rules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-900 dark:text-slate-100">
                  <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-crm-blue-dim dark:text-blue-500 text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <span>{humanizeRule(rule as { field: string; op: string; value: string | number })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended channel */}
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Channel:
          </p>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${channelCfg.cls}`}
          >
            {channelCfg.emoji} {channelCfg.label}
          </span>
        </div>

        {/* Message draft */}
        {result.message_draft && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
              Message Draft
            </p>
            <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1f2e] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
              {result.message_draft}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            id="intent-create-segment"
            variant="outline"
            size="sm"
            className="gap-2 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:bg-[#131720] dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
            onClick={() =>
              navigate('/segments/new', { state: segmentState })
            }
          >
            <Layers className="h-3.5 w-3.5" />
            Create Segment
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </Button>
          <Button
            id="intent-create-campaign"
            size="sm"
            className="gap-2 bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
            onClick={() =>
              navigate('/campaigns/new', { state: campaignState })
            }
          >
            <Megaphone className="h-3.5 w-3.5" />
            Create Campaign
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </div>
      </div>
    </div>
  );
}
