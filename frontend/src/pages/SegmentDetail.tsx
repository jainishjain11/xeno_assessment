import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Users,
  Megaphone,
  Loader2,
  Layers,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { useSegment, usePreviewSegment, type FilterRule, type FilterGroup } from '@/hooks/useSegments';
import { useCustomers } from '@/hooks/useCustomers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/axios';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

// ── Human-readable rule display ───────────────────────────────────────────────

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
  in: 'in',
  not_in: 'not in',
  is_null: 'has no value',
  is_not_null: 'has a value',
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

function humanizeValue(field: string, value: string | number | undefined): string {
  if (value === undefined || value === '') return '';
  const strVal = value.toString();
  if (DATE_LABELS[strVal]) return DATE_LABELS[strVal];
  if (field === 'total_spent' && typeof value === 'number') return formatCurrency(value);
  return strVal;
}

function RuleReadOnly({ rule }: { rule: FilterRule | FilterGroup }) {
  if ('operator' in rule) {
    return (
      <div className="ml-4 space-y-1.5 border-l-2 border-primary/30 pl-3">
        <p className="text-xs font-medium text-primary">{rule.operator} group:</p>
        {rule.rules.map((r, i) => (
          <RuleReadOnly key={i} rule={r} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
      <span className="font-medium text-foreground">
        {FIELD_LABELS[rule.field] ?? rule.field}
      </span>
      <span className="text-muted-foreground">{OP_LABELS[rule.op] ?? rule.op}</span>
      {rule.op !== 'is_null' && rule.op !== 'is_not_null' && (
        <span className="font-semibold text-foreground">
          {humanizeValue(rule.field, rule.value)}
        </span>
      )}
    </div>
  );
}

// ── Tag badge ─────────────────────────────────────────────────────────────────
const TAG_COLORS: Record<string, string> = {
  vip: 'bg-amber-100 text-amber-800',
  churned: 'bg-red-100 text-red-800',
  loyal: 'bg-green-100 text-green-800',
  new: 'bg-blue-100 text-blue-800',
};

function TagBadge({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag.toLowerCase()] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{tag}</span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function SegmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: segment, isLoading, isError } = useSegment(id!);
  const previewMutation = usePreviewSegment();
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch sample customers for this segment
  const { data: customersData } = useCustomers(1, 50);
  const sampleCustomers = (customersData?.items ?? []).slice(0, 20);

  const handleRefresh = async () => {
    if (!segment) return;
    setRefreshing(true);
    try {
      const result = await previewMutation.mutateAsync(segment.filter_rules);
      setPreviewCount(result.estimated_count);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  // Also refresh the backend audience_size
  const handleRefreshAudienceSize = async () => {
    if (!segment) return;
    setRefreshing(true);
    try {
      await api.post(`/segments/${id}/preview`, segment.filter_rules);
      // Also run our preview
      const result = await previewMutation.mutateAsync(segment.filter_rules);
      setPreviewCount(result.estimated_count);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (isError || !segment) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Layers className="mb-3 h-12 w-12 text-muted-foreground/40" />
        <p className="text-lg font-medium text-foreground">Segment not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/segments')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Segments
        </Button>
      </div>
    );
  }

  const displayCount = previewCount ?? segment.audience_size;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => navigate('/segments')}
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Segments
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{segment.name}</h1>
              {segment.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{segment.description}</p>
              )}
            </div>
          </div>
          <Button
            id="create-campaign-btn"
            onClick={() => navigate(`/campaigns/new?segment_id=${id}`)}
            className="gap-2 flex-shrink-0"
          >
            <Megaphone className="h-4 w-4" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Audience size */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Audience Size
            </p>
            <button
              id="refresh-audience-btn"
              onClick={handleRefreshAudienceSize}
              disabled={refreshing}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-end gap-2">
            {refreshing ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-4xl font-bold text-foreground">
                {displayCount != null ? displayCount.toLocaleString() : '—'}
              </p>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            matching customers
          </p>
        </div>

        {/* Created date */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Created
          </p>
          <p className="text-xl font-semibold text-foreground">
            {formatDate(segment.created_at)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(segment.created_at).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Rules count */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Rules
          </p>
          <p className="text-4xl font-bold text-foreground">
            {Array.isArray(segment.filter_rules?.rules)
              ? segment.filter_rules.rules.length
              : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {segment.filter_rules?.operator} condition
          </p>
        </div>
      </div>

      {/* Rules display */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Segment Rules</h2>
        <div className="mb-2 text-xs text-muted-foreground">
          Match customers where{' '}
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
            {segment.filter_rules?.operator === 'AND' ? 'ALL' : 'ANY'}
          </span>{' '}
          of the following rules apply:
        </div>
        <div className="space-y-2">
          {Array.isArray(segment.filter_rules?.rules) &&
            segment.filter_rules.rules.map((rule, i) => (
              <RuleReadOnly key={i} rule={rule as FilterRule | FilterGroup} />
            ))}
        </div>
      </div>

      {/* Sample customers table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Sample Customers
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              first 20
            </span>
          </h2>
          <button
            onClick={() => navigate('/customers')}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Total Spent</TableHead>
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No sample customers available.
                </TableCell>
              </TableRow>
            ) : (
              sampleCustomers.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => navigate(`/customers/${c.id}`)}
                >
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {c.name[0]?.toUpperCase()}
                      </div>
                      {c.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.email}</TableCell>
                  <TableCell className="text-muted-foreground">{c.city ?? '—'}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(c.total_spent)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.tags.slice(0, 2).map((t) => (
                        <TagBadge key={t} tag={t} />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
