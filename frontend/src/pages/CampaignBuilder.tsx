import { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Loader2,
  Sparkles,
  Users,
  MessageSquare,
  CheckCircle2,
  Rocket,
  Save,
  AlertCircle,
} from 'lucide-react';
import { useCreateCampaign, useLaunchCampaign } from '@/hooks/useCampaigns';
import { useSegments } from '@/hooks/useSegments';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/axios';

// ── Constants ─────────────────────────────────────────────────────────────────

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp', emoji: '💬', color: 'text-emerald-600' },
  { value: 'sms', label: 'SMS', emoji: '📱', color: 'text-sky-600' },
  { value: 'email', label: 'Email', emoji: '✉️', color: 'text-purple-600' },
  { value: 'rcs', label: 'RCS', emoji: '🌐', color: 'text-orange-600' },
] as const;

const TEMPLATE_VARS = [
  { label: '{{name}}', desc: 'Full name' },
  { label: '{{first_name}}', desc: 'First name' },
  { label: '{{total_spent}}', desc: 'Total spent' },
  { label: '{{city}}', desc: 'City' },
  { label: '{{last_order_date}}', desc: 'Last order' },
] as const;

// Steps
type Step = 1 | 2 | 3;

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1 as Step, label: 'Audience' },
    { n: 2 as Step, label: 'Message' },
    { n: 3 as Step, label: 'Review' },
  ];

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              current === s.n
                ? 'bg-blue-500 text-white'
                : current > s.n
                  ? 'bg-blue-100 dark:bg-crm-blue-dim text-blue-500 dark:text-blue-400'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500'
            }`}
          >
            {current > s.n ? <CheckCircle2 className="h-4 w-4" /> : s.n}
          </div>
          <span
            className={`ml-2 text-sm font-medium ${
              current >= s.n ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`mx-4 h-0.5 w-12 transition-colors ${
                current > s.n ? 'bg-blue-200 dark:bg-blue-500/40' : 'bg-slate-200 dark:bg-white/10'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Audience ─────────────────────────────────────────────────────────

interface Step1Props {
  name: string;
  setName: (v: string) => void;
  channel: string;
  setChannel: (v: string) => void;
  segmentId: string;
  setSegmentId: (v: string) => void;
}

function Step1Audience({ name, setName, channel, setChannel, segmentId, setSegmentId }: Step1Props) {
  const { data: segments, isLoading: segmentsLoading } = useSegments();
  const selectedSegment = (segments ?? []).find((s) => s.id === segmentId);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Define your audience</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Name your campaign, pick a channel, and select your target segment.
        </p>
      </div>

      {/* Campaign name */}
      <div className="space-y-1.5">
        <label htmlFor="campaign-name" className="text-sm font-medium text-foreground">
          Campaign Name <span className="text-destructive">*</span>
        </label>
        <Input
          id="campaign-name"
          placeholder="e.g. Win-back VIP Customers — June"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Channel */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Channel <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CHANNELS.map((ch) => (
            <button
              key={ch.value}
              id={`channel-${ch.value}`}
              type="button"
              onClick={() => setChannel(ch.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                channel === ch.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-crm-blue-dim shadow-sm'
                  : 'border-slate-200 dark:border-white/10 bg-card hover:border-blue-500/40 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              <span className="text-2xl">{ch.emoji}</span>
              <span className={`text-sm font-medium ${channel === ch.value ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}`}>
                {ch.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Segment */}
      <div className="space-y-1.5">
        <label htmlFor="segment-select" className="text-sm font-medium text-foreground">
          Audience Segment <span className="text-destructive">*</span>
        </label>
        {segmentsLoading ? (
          <div className="flex h-10 items-center text-sm text-muted-foreground">
            Loading segments…
          </div>
        ) : (
          <Select value={segmentId} onValueChange={setSegmentId}>
            <SelectTrigger id="segment-select" className="w-full">
              <SelectValue placeholder="Select a segment…" />
            </SelectTrigger>
            <SelectContent>
              {(segments ?? []).map((seg) => (
                <SelectItem key={seg.id} value={seg.id}>
                  <div className="flex items-center justify-between gap-4 w-full">
                    <span>{seg.name}</span>
                    {seg.audience_size != null && (
                      <span className="text-xs text-muted-foreground">
                        {seg.audience_size.toLocaleString()} customers
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Audience size preview */}
        {selectedSegment && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-crm-blue-dim px-3 py-2.5 text-sm">
            <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="text-slate-800 dark:text-slate-200">
              This segment has{' '}
              <strong>
                {selectedSegment.audience_size?.toLocaleString() ?? '?'}
              </strong>{' '}
              matching customers
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 2: Message ──────────────────────────────────────────────────────────

interface Step2Props {
  message: string;
  setMessage: (v: string) => void;
  channel: string;
  segmentName?: string;
}

function Step2Message({ message, setMessage, channel, segmentName }: Step2Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // Insert template variable at current cursor position
  const insertVar = (varLabel: string) => {
    const el = textareaRef.current;
    if (!el) {
      setMessage(message + varLabel);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = message.slice(0, start) + varLabel + message.slice(end);
    setMessage(newVal);
    // Restore cursor position after the inserted text
    setTimeout(() => {
      el.selectionStart = start + varLabel.length;
      el.selectionEnd = start + varLabel.length;
      el.focus();
    }, 0);
  };

  const handleAIDraft = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const channelLabel = CHANNELS.find((c) => c.value === channel)?.label ?? channel;
      const { data } = await api.post<{ message: string }>('/ai/draft-message', {
        channel,
        audience_description:
          segmentName
            ? `Customers in the "${segmentName}" segment`
            : 'High-value customers',
        brand_context: 'Aura Beauty — premium Indian beauty and skincare brand',
      });
      if (data?.message) {
        setMessage(data.message);
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'AI draft failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // Resolve template vars for preview
  const preview = message
    .replace(/\{\{name\}\}/g, 'Priya Sharma')
    .replace(/\{\{first_name\}\}/g, 'Priya')
    .replace(/\{\{total_spent\}\}/g, '₹12,500')
    .replace(/\{\{city\}\}/g, 'Mumbai')
    .replace(/\{\{last_order_date\}\}/g, '15 May 2025');

  const charCount = message.length;
  const channelLimit =
    channel === 'sms' ? 160 : channel === 'whatsapp' ? 1024 : channel === 'email' ? 5000 : 1024;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left: composer */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Compose your message</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Write your message. Use template variables to personalize it for each customer.
          </p>
        </div>

        {/* AI draft button */}
        <div className="flex items-center gap-2">
          <Button
            id="ai-draft-btn"
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAIDraft}
            disabled={aiLoading}
            className="gap-2 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-crm-blue-dim"
          >
            {aiLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Drafting…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                ✨ Draft with AI
              </>
            )}
          </Button>
          {aiError && (
            <span className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {aiError}
            </span>
          )}
        </div>

        {/* Textarea */}
        <div className="space-y-1.5">
          <Textarea
            ref={textareaRef}
            id="campaign-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hey {{name}}! 👋 We have an exclusive offer just for you at Aura Beauty…"
            rows={7}
            className="resize-none font-mono text-sm"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Click a variable below to insert at cursor</span>
            <span className={charCount > channelLimit ? 'text-destructive font-medium' : ''}>
              {charCount} / {channelLimit} chars
            </span>
          </div>
        </div>

        {/* Template variable chips */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Template Variables
          </p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_VARS.map((v) => (
              <button
                key={v.label}
                type="button"
                id={`var-chip-${v.label.replace(/[{}]/g, '')}`}
                onClick={() => insertVar(v.label)}
                title={v.desc}
                className="rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-2.5 py-1 text-xs font-mono text-foreground hover:border-blue-500/40 hover:bg-blue-50 dark:hover:bg-crm-blue-dim hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: preview */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Message Preview</p>
        <div className="rounded-xl border border-border bg-muted/30 p-4 min-h-[160px]">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
            As Priya Sharma would see it:
          </p>
          {preview ? (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {preview}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Start writing your message to see a preview…
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground text-sm">Sending via: {
            CHANNELS.find(c => c.value === channel)?.emoji
          } {CHANNELS.find(c => c.value === channel)?.label ?? channel}</p>
          <p>Variables like <code className="rounded bg-muted px-1">{'{{name}}'}</code> are replaced with real customer data at send time.</p>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Review ────────────────────────────────────────────────────────────

interface Step3Props {
  name: string;
  channel: string;
  segmentId: string;
  segmentName?: string;
  audienceSize?: number;
  message: string;
}

function Step3Review({ name, channel, segmentName, audienceSize, message }: Step3Props) {
  const channelCfg = CHANNELS.find((c) => c.value === channel);
  const preview = message
    .replace(/\{\{name\}\}/g, 'Priya Sharma')
    .replace(/\{\{first_name\}\}/g, 'Priya')
    .replace(/\{\{total_spent\}\}/g, '₹12,500')
    .replace(/\{\{city\}\}/g, 'Mumbai')
    .replace(/\{\{last_order_date\}\}/g, '15 May 2025');

  const rows = [
    { label: 'Campaign Name', value: name },
    { label: 'Channel', value: `${channelCfg?.emoji ?? ''} ${channelCfg?.label ?? channel}` },
    { label: 'Segment', value: segmentName ?? '—' },
    {
      label: 'Estimated Audience',
      value: audienceSize != null ? `${audienceSize.toLocaleString()} customers` : '—',
    },
    {
      label: 'Est. Send Time',
      value: audienceSize != null ? `~${Math.ceil(audienceSize / 50)} minutes` : '—',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Review your campaign</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Double-check the details before saving or launching.
        </p>
      </div>

      {/* Summary table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between px-5 py-3 text-sm ${
              i < rows.length - 1 ? 'border-b border-border' : ''
            }`}
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium text-foreground">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Message preview */}
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Message Preview</p>
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {preview || <span className="italic text-muted-foreground">No message set</span>}
          </p>
        </div>
      </div>

      {audienceSize != null && audienceSize > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-crm-blue-dim px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Ready to send to <strong>{audienceSize.toLocaleString()}</strong> customers via{' '}
            <strong>{channelCfg?.label ?? channel}</strong>. Click "Launch Now" to dispatch.
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// Shape of the state passed from IntentResultCard via navigate()
interface CampaignPrefillState {
  prefill?: {
    segment_name?: string;
    filter_rules?: object;
    message_template?: string;
    channel?: string;
  };
}

export function CampaignBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const locationState = (location.state ?? {}) as CampaignPrefillState;
  const prefill = locationState.prefill;

  const prefilledSegmentId = searchParams.get('segment_id') ?? '';

  const [step, setStep] = useState<Step>(1);

  // Form state — use prefill values when coming from AI assistant
  const [name, setName] = useState(prefill?.segment_name ? `Campaign — ${prefill.segment_name}` : '');
  const [channel, setChannel] = useState(prefill?.channel ?? 'whatsapp');
  const [segmentId, setSegmentId] = useState(prefilledSegmentId);
  const [message, setMessage] = useState(prefill?.message_template ?? '');
  const [error, setError] = useState('');

  const createMutation = useCreateCampaign();
  const launchMutation = useLaunchCampaign();

  const { data: segments } = useSegments();
  const selectedSegment = (segments ?? []).find((s) => s.id === segmentId);

  // ── Step validation ─────────────────────────────────────────────────────────
  const step1Valid = name.trim().length > 0 && channel.length > 0 && segmentId.length > 0;
  const step2Valid = message.trim().length > 0;
  const step3Valid = step1Valid && step2Valid;

  const canGoNext =
    (step === 1 && step1Valid) ||
    (step === 2 && step2Valid) ||
    step === 3;

  // ── Save as draft ───────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!step3Valid) return;
    setError('');
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        segment_id: segmentId,
        channel,
        message_template: message.trim(),
      });
      toast.success('Campaign saved as draft');
      navigate('/campaigns');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save campaign');
    }
  };

  // ── Launch ──────────────────────────────────────────────────────────────────
  const handleLaunch = async () => {
    if (!step3Valid) return;
    setError('');
    try {
      const campaign = await createMutation.mutateAsync({
        name: name.trim(),
        segment_id: segmentId,
        channel,
        message_template: message.trim(),
      });
      await launchMutation.mutateAsync(campaign.id);
      toast.success('Campaign launched successfully');
      navigate(`/campaigns/${campaign.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to launch campaign');
    }
  };

  const isBusy = createMutation.isPending || launchMutation.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">New Campaign</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and launch a targeted messaging campaign in 3 steps.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Step content */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {step === 1 && (
          <Step1Audience
            name={name}
            setName={setName}
            channel={channel}
            setChannel={setChannel}
            segmentId={segmentId}
            setSegmentId={setSegmentId}
          />
        )}
        {step === 2 && (
          <Step2Message
            message={message}
            setMessage={setMessage}
            channel={channel}
            segmentName={selectedSegment?.name}
          />
        )}
        {step === 3 && (
          <Step3Review
            name={name}
            channel={channel}
            segmentId={segmentId}
            segmentName={selectedSegment?.name}
            audienceSize={selectedSegment?.audience_size ?? undefined}
            message={message}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <ErrorMessage message={error} />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          id="step-back-btn"
          variant="outline"
          onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
          disabled={step === 1 || isBusy}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          {step < 3 ? (
            <Button
              id="step-next-btn"
              onClick={() => setStep((s) => Math.min(3, s + 1) as Step)}
              disabled={!canGoNext}
              className="gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button
                id="save-draft-btn"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isBusy || !step3Valid}
                className="gap-2"
              >
                {createMutation.isPending && !launchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save as Draft
              </Button>
              <Button
                id="launch-campaign-btn"
                onClick={handleLaunch}
                disabled={isBusy || !step3Valid}
                className="gap-2 bg-blue-500 hover:bg-blue-600 text-white border-none"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Launch Now
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
