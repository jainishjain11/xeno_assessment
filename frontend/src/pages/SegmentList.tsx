import { useNavigate } from 'react-router-dom';
import { Plus, Layers, Users, Calendar, Edit2 } from 'lucide-react';
import { useSegments } from '@/hooks/useSegments';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

// ── Audience badge ────────────────────────────────────────────────────────────
function AudienceBadge({ size }: { size?: number | null }) {
  if (size == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        <Users className="h-3 w-3" />
        Unknown
      </span>
    );
  }

  const color =
    size > 200
      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      : size > 50
        ? 'bg-blue-100 text-blue-800 border border-blue-200'
        : 'bg-gray-100 text-gray-700 border border-gray-200';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      <Users className="h-3 w-3" />
      {size.toLocaleString()} customers
    </span>
  );
}

// ── Segment card ──────────────────────────────────────────────────────────────
function SegmentCard({
  segment,
  onClick,
  onEdit,
}: {
  segment: {
    id: string;
    name: string;
    description?: string;
    audience_size?: number | null;
    created_at: string;
    filter_rules: object;
  };
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
}) {
  // Count number of rules
  const ruleCount = Array.isArray((segment.filter_rules as { rules?: unknown[] }).rules)
    ? ((segment.filter_rules as { rules?: unknown[] }).rules?.length ?? 0)
    : 0;

  return (
    <div
      id={`segment-card-${segment.id}`}
      className="group relative flex cursor-pointer flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md"
      onClick={onClick}
    >
      {/* Icon + name */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground leading-tight">{segment.name}</h3>
            {segment.description && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {segment.description}
              </p>
            )}
          </div>
        </div>
        {/* Edit button */}
        <button
          id={`edit-segment-${segment.id}`}
          onClick={onEdit}
          className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
        >
          <Edit2 className="h-4 w-4" />
        </button>
      </div>

      {/* Audience size badge */}
      <div>
        <AudienceBadge size={segment.audience_size} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(segment.created_at)}
        </div>
        <span>{ruleCount} rule{ruleCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SegmentCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-4 h-6 w-40 rounded-full" />
      <div className="mt-4 border-t border-border pt-3">
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function SegmentList() {
  const navigate = useNavigate();
  const { data: segments, isLoading, isError } = useSegments();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Segments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? 'Loading…'
              : `${(segments ?? []).length} segment${(segments ?? []).length !== 1 ? 's' : ''} defined`}
          </p>
        </div>
        <Button
          id="new-segment-btn"
          onClick={() => navigate('/segments/new')}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Segment
        </Button>
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load segments. Please refresh.
        </div>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? [...Array(6)].map((_, i) => <SegmentCardSkeleton key={i} />)
          : (segments ?? []).length === 0
            ? (
              <div className="col-span-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center">
                <Layers className="mb-3 h-12 w-12 text-muted-foreground/40" />
                <p className="text-base font-medium text-foreground">No segments yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first audience segment to target customers.
                </p>
                <Button
                  id="new-segment-empty-btn"
                  variant="outline"
                  className="mt-4 gap-2"
                  onClick={() => navigate('/segments/new')}
                >
                  <Plus className="h-4 w-4" />
                  New Segment
                </Button>
              </div>
            )
            : (segments ?? []).map((segment) => (
              <SegmentCard
                key={segment.id}
                segment={segment}
                onClick={() => navigate(`/segments/${segment.id}`)}
                onEdit={(e) => {
                  e.stopPropagation();
                  navigate(`/segments/${segment.id}`);
                }}
              />
            ))}
      </div>
    </div>
  );
}
