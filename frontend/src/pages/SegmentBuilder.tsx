import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Sparkles,
  Users,
  Loader2,
  X,
  ChevronDown,
  Save,
} from 'lucide-react';
import { useCreateSegment, usePreviewSegment } from '@/hooks/useSegments';
import type { FilterRule, FilterGroup } from '@/hooks/useSegments';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import api from '@/lib/axios';

// ── Field definitions ─────────────────────────────────────────────────────────

const FIELDS = [
  { value: 'total_spent', label: 'Total Spent (₹)', type: 'number' },
  { value: 'order_count', label: 'Order Count', type: 'number' },
  { value: 'last_order_at', label: 'Last Order Date', type: 'date' },
  { value: 'city', label: 'City', type: 'text' },
  { value: 'tags', label: 'Tags', type: 'text' },
] as const;

type FieldType = 'number' | 'text' | 'date';

const OPERATORS_BY_TYPE: Record<FieldType, { value: string; label: string }[]> = {
  number: [
    { value: 'eq', label: '= equals' },
    { value: 'neq', label: '≠ not equals' },
    { value: 'gt', label: '> greater than' },
    { value: 'gte', label: '≥ at least' },
    { value: 'lt', label: '< less than' },
    { value: 'lte', label: '≤ at most' },
  ],
  text: [
    { value: 'eq', label: '= equals' },
    { value: 'neq', label: '≠ not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
  ],
  date: [
    { value: 'lt', label: 'before' },
    { value: 'lte', label: 'before or on' },
    { value: 'gt', label: 'after' },
    { value: 'gte', label: 'on or after' },
    { value: 'is_null', label: 'has no value' },
  ],
};

// Preset date values for date fields
const DATE_PRESETS = [
  { label: '7 days ago', value: "NOW() - INTERVAL '7 days'" },
  { label: '14 days ago', value: "NOW() - INTERVAL '14 days'" },
  { label: '30 days ago', value: "NOW() - INTERVAL '30 days'" },
  { label: '60 days ago', value: "NOW() - INTERVAL '60 days'" },
  { label: '90 days ago', value: "NOW() - INTERVAL '90 days'" },
  { label: '180 days ago', value: "NOW() - INTERVAL '180 days'" },
  { label: '1 year ago', value: "NOW() - INTERVAL '1 year'" },
];

// ── Rule row ──────────────────────────────────────────────────────────────────

interface RuleRowProps {
  rule: FilterRule;
  index: number;
  onUpdate: (rule: FilterRule) => void;
  onRemove: () => void;
  showRemove: boolean;
}

function RuleRow({ rule, index, onUpdate, onRemove, showRemove }: RuleRowProps) {
  const fieldDef = FIELDS.find((f) => f.value === rule.field);
  const fieldType: FieldType = (fieldDef?.type as FieldType) ?? 'text';
  const operators = OPERATORS_BY_TYPE[fieldType];

  const handleFieldChange = (newField: string) => {
    const newFieldDef = FIELDS.find((f) => f.value === newField);
    const newType: FieldType = (newFieldDef?.type as FieldType) ?? 'text';
    const defaultOp = OPERATORS_BY_TYPE[newType][0]?.value ?? 'eq';
    onUpdate({ field: newField, op: defaultOp, value: '' });
  };

  const handleOpChange = (newOp: string) => {
    onUpdate({ ...rule, op: newOp, value: newOp === 'is_null' ? '' : rule.value });
  };

  const handleValueChange = (val: string) => {
    const coerced =
      fieldType === 'number' && val !== '' ? (parseFloat(val) || val) : val;
    onUpdate({ ...rule, value: coerced });
  };

  const inputClass = "bg-white/5 border-white/15 text-slate-100 placeholder-slate-500 focus:border-violet-400/50 focus:ring-[3px] focus:ring-violet-400/10";

  return (
    <div className="flex items-center gap-2 glass-card p-3">
      {/* Index pill */}
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[11px] font-semibold text-violet-400">
        {index + 1}
      </div>

      {/* Field select */}
      <Select value={rule.field} onValueChange={handleFieldChange}>
        <SelectTrigger
          id={`rule-field-${index}`}
          className={`h-9 w-[160px] flex-shrink-0 text-sm ${inputClass}`}
        >
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent>
          {FIELDS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator select */}
      <Select value={rule.op} onValueChange={handleOpChange}>
        <SelectTrigger
          id={`rule-op-${index}`}
          className={`h-9 w-[160px] flex-shrink-0 text-sm ${inputClass}`}
        >
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      {rule.op !== 'is_null' && rule.op !== 'is_not_null' && (
        <>
          {fieldType === 'date' ? (
            <Select
              value={
                DATE_PRESETS.find((p) => p.value === rule.value)?.value ?? ''
              }
              onValueChange={handleValueChange}
            >
              <SelectTrigger
                id={`rule-value-${index}`}
                className={`h-9 min-w-[160px] flex-1 text-sm ${inputClass}`}
              >
                <SelectValue placeholder="Select date range…" />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={`rule-value-${index}`}
              type={fieldType === 'number' ? 'number' : 'text'}
              placeholder={
                fieldType === 'number'
                  ? 'e.g. 5000'
                  : rule.field === 'tags'
                    ? 'e.g. vip'
                    : 'e.g. Mumbai'
              }
              value={rule.value?.toString() ?? ''}
              onChange={(e) => handleValueChange(e.target.value)}
              className={`h-9 min-w-[120px] flex-1 text-sm ${inputClass}`}
            />
          )}
        </>
      )}

      {/* Remove */}
      {showRemove && (
        <button
          id={`remove-rule-${index}`}
          onClick={onRemove}
          className="ml-auto flex-shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── AI Intent Modal ───────────────────────────────────────────────────────────

interface AIIntentModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (rules: FilterGroup, name?: string, description?: string) => void;
}

function AIIntentModal({ open, onClose, onApply }: AIIntentModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.post('/ai/parse-intent', {
        prompt,
        context: {
          available_channels: ['whatsapp', 'email', 'sms'],
          brand_name: 'Aura Beauty',
        },
      });
      if (data?.segment_rules) {
        onApply(
          data.segment_rules as FilterGroup,
          data.segment_name as string | undefined,
          data.reasoning as string | undefined
        );
        setPrompt('');
        onClose();
      } else {
        setError('AI did not return valid segment rules. Please try again.');
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to parse intent. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg glass-card border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            Describe your audience
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Describe who you want to target in plain language. The AI will convert
            it into segment rules automatically.
          </p>
          <Textarea
            id="ai-intent-input"
            placeholder="e.g. High-spending customers who haven't ordered in 30 days and are from Mumbai or Delhi"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="resize-none bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/20 dark:bg-white/5 dark:border-white/10 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-400/50 dark:focus:ring-blue-400/10"
          />
          <div className="flex flex-wrap gap-2">
            {[
              'VIP customers inactive for 60 days',
              'New customers from Bangalore with < 2 orders',
              'Customers spent over ₹10,000 in last 90 days',
            ].map((example) => (
              <button
                key={example}
                onClick={() => setPrompt(example)}
                className="rounded-full border border-slate-200 dark:border-white/20 px-3 py-1 text-xs text-slate-500 dark:text-slate-400 hover:border-blue-500/40 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="bg-transparent border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100">
            Cancel
          </Button>
          <Button
            id="ai-intent-submit"
            onClick={handleSubmit}
            disabled={!prompt.trim() || isLoading}
            className="gap-2 bg-blue-500 text-white hover:bg-blue-600 border-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Rules
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const DEFAULT_RULE: FilterRule = { field: 'total_spent', op: 'gte', value: 0 };

// Shape of state passed from IntentResultCard via navigate()
interface SegmentPrefillState {
  prefill?: {
    name?: string;
    filter_rules?: FilterGroup;
  };
}

export function SegmentBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? {}) as SegmentPrefillState;
  const prefill = locationState.prefill;

  const [name, setName] = useState(prefill?.name ?? '');
  const [description, setDescription] = useState('');
  const [groupOp, setGroupOp] = useState<'AND' | 'OR'>(
    prefill?.filter_rules?.operator ?? 'AND'
  );
  const [rules, setRules] = useState<FilterRule[]>(() => {
    const prefillRules = prefill?.filter_rules?.rules?.filter(
      (r): r is FilterRule => 'field' in r && 'op' in r
    );
    return prefillRules && prefillRules.length > 0
      ? prefillRules
      : [{ ...DEFAULT_RULE }];
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const createMutation = useCreateSegment();
  const previewMutation = usePreviewSegment();

  // ── Debounced preview ─────────────────────────────────────────────────────
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runPreview = useCallback(
    async (currentRules: FilterRule[], op: 'AND' | 'OR') => {
      // Only preview if all rules have a non-empty field + op + value
      const valid = currentRules.every(
        (r) => r.field && r.op && (r.op === 'is_null' || r.value !== '')
      );
      if (!valid || currentRules.length === 0) return;

      const filter_rules: FilterGroup = {
        operator: op,
        rules: currentRules,
      };

      setPreviewLoading(true);
      try {
        const result = await previewMutation.mutateAsync(filter_rules);
        setPreviewCount(result.estimated_count);
      } catch {
        setPreviewCount(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Trigger debounced preview whenever rules or groupOp change
  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      runPreview(rules, groupOp);
    }, 500);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [rules, groupOp, runPreview]);

  // ── Rule management ───────────────────────────────────────────────────────
  const addRule = () => {
    setRules((prev) => [...prev, { ...DEFAULT_RULE }]);
  };

  const updateRule = (index: number, rule: FilterRule) => {
    setRules((prev) => prev.map((r, i) => (i === index ? rule : r)));
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  // ── AI populate ───────────────────────────────────────────────────────────
  const handleAIApply = (
    aiRules: FilterGroup,
    aiName?: string,
    aiDescription?: string
  ) => {
    // Flatten top-level rules (only simple FilterRule, not nested groups for now)
    const flatRules = aiRules.rules.filter(
      (r): r is FilterRule => 'field' in r && 'op' in r
    );
    if (flatRules.length > 0) setRules(flatRules);
    if (aiRules.operator) setGroupOp(aiRules.operator);
    if (aiName && !name) setName(aiName);
    if (aiDescription && !description) setDescription(aiDescription);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim() || rules.length === 0) return;

    const filter_rules: FilterGroup = {
      operator: groupOp,
      rules,
    };

    try {
      const segment = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        filter_rules,
      });
      toast.success('Segment created successfully');
      navigate(`/segments/${segment.id}`);
    } catch {
      // Error surfaced via createMutation.error
    }
  };

  const canSave = name.trim().length > 0 && rules.length > 0;

  const inputClass = "bg-white/5 border-white/15 text-slate-100 placeholder-slate-500 focus:border-violet-400/50 focus:ring-[3px] focus:ring-violet-400/10";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            New Segment
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Define rules to match your target audience.
          </p>
        </div>
        <Button
          id="ai-assist-btn"
          onClick={() => setAiOpen(true)}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          ✨ Describe your audience
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: builder */}
        <div className="space-y-5 lg:col-span-2">
          {/* Segment name + description */}
          <div className="glass-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Segment Details</h2>
            <div className="space-y-1.5">
              <label htmlFor="segment-name" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Name <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <Input
                id="segment-name"
                placeholder="e.g. High-Value Lapsed (30d)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="segment-description" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Description
              </label>
              <Input
                id="segment-description"
                placeholder="Optional description…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Rule builder */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Rules</h2>
              {/* AND / OR toggle */}
              <div className="flex rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden text-sm">
                {(['AND', 'OR'] as const).map((op) => (
                  <button
                    key={op}
                    id={`group-op-${op.toLowerCase()}`}
                    onClick={() => setGroupOp(op)}
                    className={`px-3 py-1 font-medium transition-colors ${
                      groupOp === op
                        ? 'bg-blue-500 text-white'
                        : 'bg-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
              Match customers where{' '}
              <strong>{groupOp === 'AND' ? 'all' : 'any'}</strong> of the following rules apply:
            </p>

            {/* Rule rows */}
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <RuleRow
                  key={i}
                  rule={rule}
                  index={i}
                  onUpdate={(r) => updateRule(i, r)}
                  onRemove={() => removeRule(i)}
                  showRemove={rules.length > 1}
                />
              ))}
            </div>

            <Button
              id="add-rule-btn"
              variant="outline"
              size="sm"
              onClick={addRule}
              className="gap-2 bg-transparent border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Rule
            </Button>
          </div>

          {/* Error */}
          {createMutation.error && (
            <ErrorMessage message={createMutation.error.message} />
          )}

          {/* Save */}
          <Button
            id="save-segment-btn"
            onClick={handleSave}
            disabled={!canSave || createMutation.isPending}
            className="w-full gap-2"
            size="lg"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Segment
              </>
            )}
          </Button>
        </div>

        {/* Right: live preview panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 glass-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Live Preview</h2>

            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 dark:border-white/20 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-crm-blue-dim dark:text-blue-500 mb-3">
                <Users className="h-6 w-6" />
              </div>
              {previewLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400 mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Counting…</p>
                </>
              ) : previewCount !== null ? (
                <>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {previewCount.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    customer{previewCount !== 1 ? 's' : ''} match
                  </p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-slate-300 dark:text-slate-500/40">—</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Add a complete rule to see preview
                  </p>
                </>
              )}
            </div>

            {/* Rule summary */}
            {rules.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Current rules
                </p>
                {rules.map((rule, i) => {
                  const fieldLabel = FIELDS.find((f) => f.value === rule.field)?.label ?? rule.field;
                  const opLabel =
                    OPERATORS_BY_TYPE[
                      (FIELDS.find((f) => f.value === rule.field)?.type as FieldType) ?? 'text'
                    ]?.find((o) => o.value === rule.op)?.label ?? rule.op;
                  const datePreset = DATE_PRESETS.find((p) => p.value === rule.value)?.label;
                  const valueDisplay = datePreset ?? rule.value?.toString() ?? '';

                  return (
                    <div
                      key={i}
                      className="rounded-md bg-slate-50 dark:bg-white/5 px-3 py-2 text-xs text-slate-600 dark:text-slate-400"
                    >
                      <span className="font-medium text-slate-900 dark:text-slate-100">{fieldLabel}</span>{' '}
                      {opLabel}{' '}
                      {valueDisplay && (
                        <span className="font-medium text-slate-900 dark:text-slate-100">{valueDisplay}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Modal */}
      <AIIntentModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onApply={handleAIApply}
      />
    </div>
  );
}
