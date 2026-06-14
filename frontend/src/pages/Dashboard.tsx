import { useNavigate } from 'react-router-dom';
import {
  Users,
  Megaphone,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Layers,
  Activity,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useAnalytics';
import { useCustomers } from '@/hooks/useCustomers';
import { useSegments } from '@/hooks/useSegments';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatPct } from '@/lib/formatters';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="relative overflow-hidden glass-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-400">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-9 w-28 bg-white/10" />
          ) : (
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-100">
              {value}
            </p>
          )}
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

// ── Quick action card ─────────────────────────────────────────────────────────

function QuickAction({
  icon: Icon,
  title,
  description,
  onClick,
  id,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
  id: string;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      className="group flex items-center gap-4 glass-card p-4 text-left w-full"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400 transition-colors group-hover:bg-violet-500 group-hover:text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-100 text-sm">{title}</p>
        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-400" />
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function Dashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading, isError } = useDashboardStats();
  const { data: customersData } = useCustomers(1, 5);
  const { data: segments } = useSegments();

  const recentCustomers = customersData?.items ?? [];
  const totalCustomers = customersData?.total ?? stats?.total_customers ?? 0;
  const totalSegments = segments?.length ?? 0;

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Overview of your campaigns and audience segments.
        </p>
      </div>

      {isError ? (
        <div className="mt-6">
          <ErrorMessage 
            message="Failed to load dashboard metrics." 
            onRetry={() => window.location.reload()} 
          />
        </div>
      ) : (
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Customers"
          value={stats?.total_customers?.toLocaleString() ?? 0}
          color="bg-violet-500/20 text-violet-400"
          loading={isLoading}
        />
        <StatCard
          icon={Activity}
          label="Active Campaigns"
          value={stats?.active_campaigns?.toLocaleString() ?? 0}
          sub="Running or scheduled"
          color="bg-emerald-500/20 text-emerald-400"
          loading={isLoading}
        />
        <StatCard
          icon={MessageSquare}
          label="Messages Sent"
          value={stats?.total_messages_sent?.toLocaleString() ?? 0}
          color="bg-blue-500/20 text-blue-400"
          loading={isLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Delivery Rate"
          value={stats ? formatPct(stats.avg_delivery_rate) : '0%'}
          color="bg-fuchsia-500/20 text-fuchsia-400"
          loading={isLoading}
        />
      </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-100">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            id="qa-new-segment"
            icon={Layers}
            title="New Segment"
            description="Define your target audience with rules"
            onClick={() => navigate('/segments/new')}
          />
          <QuickAction
            id="qa-new-campaign"
            icon={Megaphone}
            title="New Campaign"
            description="Create and launch a messaging campaign"
            onClick={() => navigate('/campaigns/new')}
          />
          <QuickAction
            id="qa-ai-assist"
            icon={Sparkles}
            title="AI Assistant"
            description="Describe intent in natural language"
            onClick={() => navigate('/ai')}
          />
          <QuickAction
            id="qa-view-customers"
            icon={Users}
            title="View Customers"
            description="Browse and search your customer base"
            onClick={() => navigate('/customers')}
          />
        </div>
      </div>

      {/* Recent customers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-slate-100">Recent Customers</h2>
            <button
              id="view-all-customers"
              onClick={() => navigate('/customers')}
              className="text-xs text-violet-400 hover:underline"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-white/10">
            {recentCustomers.length === 0
              ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  No customers yet.
                </div>
              )
              : recentCustomers.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => navigate(`/customers/${c.id}`)}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-400">
                    {c.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{c.name}</p>
                    <p className="truncate text-xs text-slate-400">{c.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-100">
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        maximumFractionDigits: 0,
                      }).format(c.total_spent)}
                    </p>
                    <p className="text-xs text-slate-400">{c.order_count} orders</p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Segments overview */}
        <div className="glass overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-slate-100">Audience Segments</h2>
            <button
              id="view-all-segments"
              onClick={() => navigate('/segments')}
              className="text-xs text-violet-400 hover:underline"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-white/10">
            {(segments ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-slate-400">No segments yet.</p>
                <Button
                  id="dashboard-new-segment"
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2 bg-transparent border-white/20 text-slate-300 hover:bg-white/10 hover:text-slate-100"
                  onClick={() => navigate('/segments/new')}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Create first segment
                </Button>
              </div>
            ) : (
              (segments ?? []).slice(0, 5).map((seg) => (
                <div
                  key={seg.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => navigate(`/segments/${seg.id}`)}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{seg.name}</p>
                    {seg.description && (
                      <p className="truncate text-xs text-slate-400">{seg.description}</p>
                    )}
                  </div>
                  {seg.audience_size != null && (
                    <div className="flex-shrink-0 rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-medium text-violet-400">
                      {seg.audience_size?.toLocaleString()}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
