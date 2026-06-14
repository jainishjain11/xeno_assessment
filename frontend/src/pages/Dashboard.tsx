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
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-9 w-28" />
          ) : (
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              {value}
            </p>
          )}
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
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
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md w-full"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function Dashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: customersData } = useCustomers(1, 5);
  const { data: segments } = useSegments();

  const recentCustomers = customersData?.items ?? [];
  const totalCustomers = customersData?.total ?? stats?.total_customers ?? 0;
  const totalSegments = segments?.length ?? 0;

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome to Aura Beauty CRM — your AI-powered marketing platform.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Customers"
          value={statsLoading ? '—' : totalCustomers.toLocaleString()}
          sub="In your database"
          color="bg-blue-100 text-blue-600"
          loading={statsLoading}
        />
        <StatCard
          icon={Megaphone}
          label="Active Campaigns"
          value={statsLoading ? '—' : (stats?.active_campaigns ?? 0).toLocaleString()}
          sub="Running or drafted"
          color="bg-purple-100 text-purple-600"
          loading={statsLoading}
        />
        <StatCard
          icon={Layers}
          label="Segments"
          value={totalSegments.toLocaleString()}
          sub="Audience definitions"
          color="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          icon={Activity}
          label="Messages Sent"
          value="—"
          sub="Launch a campaign to track"
          color="bg-amber-100 text-amber-600"
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Quick Actions</h2>
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
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Recent Customers</h2>
            <button
              id="view-all-customers"
              onClick={() => navigate('/customers')}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-border">
            {recentCustomers.length === 0
              ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No customers yet.
                </div>
              )
              : recentCustomers.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/customers/${c.id}`)}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {c.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        maximumFractionDigits: 0,
                      }).format(c.total_spent)}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.order_count} orders</p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Segments overview */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Audience Segments</h2>
            <button
              id="view-all-segments"
              onClick={() => navigate('/segments')}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-border">
            {(segments ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground">No segments yet.</p>
                <Button
                  id="dashboard-new-segment"
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
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
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/segments/${seg.id}`)}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{seg.name}</p>
                    {seg.description && (
                      <p className="truncate text-xs text-muted-foreground">{seg.description}</p>
                    )}
                  </div>
                  {seg.audience_size != null && (
                    <div className="flex-shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {seg.audience_size.toLocaleString()}
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
