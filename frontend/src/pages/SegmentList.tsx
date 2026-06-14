import { useNavigate } from 'react-router-dom';
import { Plus, Layers, Users, Calendar, Edit2 } from 'lucide-react';
import { useSegments } from '@/hooks/useSegments';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

// ── Audience badge ────────────────────────────────────────────────────────────
function AudienceBadge({ size }: { size?: number | null }) {
  if (size == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-400">
        <Users className="h-3 w-3" />
        Unknown
      </span>
    );
  }

  const color = 'bg-violet-500/20 text-violet-400 border border-violet-500/30';

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
      className="group relative flex cursor-pointer flex-col gap-4 glass-card p-5"
      onClick={onClick}
    >
      {/* Icon + name */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 leading-tight">{segment.name}</h3>
            {segment.description && (
              <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">
                {segment.description}
              </p>
            )}
          </div>
        </div>
        {/* Edit button */}
        <button
          id={`edit-segment-${segment.id}`}
          onClick={onEdit}
          className="flex-shrink-0 rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-white/10 hover:text-slate-100 group-hover:opacity-100"
        >
          <Edit2 className="h-4 w-4" />
        </button>
      </div>

      {/* Audience size badge */}
      <div>
        <AudienceBadge size={segment.audience_size} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-slate-400">
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
    <div className="glass p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4 bg-white/10" />
          <Skeleton className="h-3 w-1/2 bg-white/10" />
        </div>
      </div>
      <Skeleton className="mt-4 h-6 w-40 rounded-full bg-white/10" />
      <div className="mt-4 border-t border-white/10 pt-3">
        <Skeleton className="h-3 w-32 bg-white/10" />
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Segments</h1>
          <p className="mt-1 text-sm text-slate-400">
            {isLoading
              ? 'Loading…'
              : `${(segments ?? []).length} segment${(segments ?? []).length !== 1 ? 's' : ''} defined`}
          </p>
        </div>
        <Button
          id="new-segment-btn"
          onClick={() => navigate('/segments/new')}
          className="gap-2 bg-gradient-to-br from-violet-600 to-violet-400 text-white border-none hover:opacity-90 hover:-translate-y-[1px] shadow-[0_4px_15px_rgba(167,139,250,0.4)]"
        >
          <Plus className="h-4 w-4" />
          New Segment
        </Button>
      </div>

      {/* Error */}
      {isError && (
        <ErrorMessage 
          message="Failed to load segments." 
          onRetry={() => window.location.reload()} 
        />
      )}

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? [...Array(6)].map((_, i) => <SegmentCardSkeleton key={i} />)
          : (segments ?? []).length === 0
            ? (
              <div className="col-span-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 py-16 text-center glass">
                <Layers className="mb-3 h-12 w-12 text-slate-500/40" />
                <p className="text-base font-medium text-slate-100">No segments yet</p>
                <p className="mt-1 text-sm text-slate-400">
                  Create your first audience segment to target customers.
                </p>
                <Button
                  id="new-segment-empty-btn"
                  variant="outline"
                  className="mt-4 gap-2 bg-transparent border-white/20 text-slate-300 hover:bg-white/10 hover:text-slate-100"
                  onClick={() => navigate('/segments/new')}
                >
                  <Plus className="h-4 w-4" />
                  Create your first segment
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
