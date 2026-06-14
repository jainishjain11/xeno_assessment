import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  Activity,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { useCampaign, useCampaignLogs } from '@/hooks/useCampaigns';
import { useCampaignSSE } from '@/hooks/useCampaignSSE';
import type { CampaignStats } from '@/hooks/useCampaigns';
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
import { formatPct, formatDate } from '@/lib/formatters';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

const STATUS_CONFIG: Record<string, { cls: string }> = {
  draft: { cls: 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border-slate-500/20' },
  running: { cls: 'bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/20' },
  completed: { cls: 'bg-green-500/15 text-green-500 dark:text-green-400 border-green-500/20' },
  failed: { cls: 'bg-red-500/15 text-red-500 dark:text-red-400 border-red-500/20' },
  queued: { cls: 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border-slate-500/20' },
  sent: { cls: 'bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/20' },
  delivered: { cls: 'bg-green-500/15 text-green-500 dark:text-green-400 border-green-500/20' },
  opened: { cls: 'bg-purple-500/15 text-purple-500 dark:text-purple-400 border-purple-500/20' },
  clicked: { cls: 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/20' },
  converted: { cls: 'bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/20' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { cls: 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/20' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      {status === 'running' && (
        <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400 inline-block" />
      )}
      {status}
    </span>
  );
}

const CHANNEL_EMOJI: Record<string, string> = {
  whatsapp: '💬',
  sms: '📱',
  email: '✉️',
  rcs: '🌐',
};

// ── Funnel chart ──────────────────────────────────────────────────────────────

const FUNNEL_STAGES = [
  { key: 'total_sent', label: 'Sent', color: '#64748b' },
  { key: 'total_delivered', label: 'Delivered', color: '#94a3b8' },
  { key: 'total_opened', label: 'Opened', color: '#60a5fa' },
  { key: 'total_read', label: 'Read', color: '#3b82f6' },
  { key: 'total_clicked', label: 'Clicked', color: '#2563eb' },
  { key: 'total_converted', label: 'Converted', color: '#1d4ed8' },
] as const;

interface FunnelChartProps {
  stats: CampaignStats;
}

function FunnelChart({ stats }: FunnelChartProps) {
  const data = FUNNEL_STAGES.map((stage, i) => {
    const count = stats[stage.key as keyof CampaignStats] as number ?? 0;
    const prevCount =
      i === 0
        ? count
        : (stats[FUNNEL_STAGES[i - 1].key as keyof CampaignStats] as number ?? 0);
    const pct =
      i === 0
        ? 100
        : prevCount > 0
          ? Math.round((count / prevCount) * 100)
          : 0;

    return {
      label: stage.label,
      count,
      pct,
      color: stage.color,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 80, left: 0, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={80}
          tick={{ fontSize: 13, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value, _name, props) => [
            `${Number(value).toLocaleString()} (${(props.payload as { pct: number }).pct}% of prev)`,
            'Count',
          ]}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(30,30,40,0.9)',
            color: '#f1f5f9',
            fontSize: 13,
            backdropFilter: 'blur(10px)',
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={36}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} fillOpacity={0.85} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            style={{ fontSize: 13, fill: '#f1f5f9' }}
            formatter={(v: unknown) => Number(v).toLocaleString()}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Rate card ─────────────────────────────────────────────────────────────────

interface RateCardProps {
  label: string;
  value: number | null | undefined;
  description: string;
}

function RateCard({ label, value, description }: RateCardProps) {
  const numVal = value ?? 0;
  const colorClass =
    numVal >= 50
      ? 'text-blue-500 dark:text-blue-400'
      : numVal >= 20
        ? 'text-slate-600 dark:text-slate-400'
        : 'text-red-500 dark:text-red-400';

  return (
    <div className="glass-card p-5">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${value == null ? 'text-slate-400 dark:text-slate-500/40' : colorClass}`}>
        {formatPct(value)}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

// ── Empty stats placeholder ───────────────────────────────────────────────────

function EmptyStats() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-white/20 py-12 text-center glass">
      <Activity className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500/40" />
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No analytics data yet</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Stats will appear here once the campaign is launched and messages start delivering.
      </p>
    </div>
  );
}

// ── Live indicator ────────────────────────────────────────────────────────────

function LiveIndicator({ isLive }: { isLive: boolean }) {
  if (isLive) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-500 dark:text-blue-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />
        <Wifi className="h-3 w-3" />
        Live
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
      <WifiOff className="h-3 w-3" />
      Offline
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [logsPage, setLogsPage] = useState(1);

  const { data: campaign, isLoading, isError } = useCampaign(id!);
  const { data: logsData, isLoading: logsLoading } = useCampaignLogs(id!, logsPage);
  const { stats: sseStats, isLive } = useCampaignSSE(id!);

  // Use SSE stats when available, otherwise show a "no data" state
  const stats = sseStats;
  const logs = logsData?.items ?? [];

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-white/10" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl bg-white/10" />)}
        </div>
        <Skeleton className="h-64 rounded-xl bg-white/10" />
      </div>
    );
  }

  if (isError || !campaign) {
    return (
      <div className="py-12">
        <ErrorMessage message="Campaign not found. It may have been deleted." />
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => navigate('/campaigns')} className="bg-transparent border-white/20 text-slate-300 hover:bg-white/10 hover:text-slate-100">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const channelEmoji = CHANNEL_EMOJI[campaign.channel] ?? '📣';

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => navigate('/campaigns')}
          className="mb-3 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Campaigns
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-500 dark:bg-crm-blue-dim dark:text-blue-500 text-2xl">
              {channelEmoji}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{campaign.name}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="capitalize">{campaign.channel}</span>
                <span>·</span>
                <span>Created {formatDate(campaign.created_at)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={campaign.status} />
            <LiveIndicator isLive={isLive} />
          </div>
        </div>
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RateCard
          label="Delivery Rate"
          value={stats?.delivery_rate}
          description="Messages delivered / sent"
        />
        <RateCard
          label="Open Rate"
          value={stats?.open_rate}
          description="Opened / delivered"
        />
        <RateCard
          label="CTR"
          value={stats?.ctr}
          description="Clicked / opened"
        />
        <RateCard
          label="Conversion Rate"
          value={
            stats && stats.total_clicked > 0
              ? (stats.total_converted / stats.total_clicked) * 100
              : null
          }
          description="Converted / clicked"
        />
      </div>

      {/* Funnel chart */}
      <div className="glass-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Delivery Funnel</h2>
          {stats && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {stats.total_sent.toLocaleString()} total sent
            </p>
          )}
        </div>

        {stats && stats.total_sent > 0 ? (
          <FunnelChart stats={stats} />
        ) : (
          <EmptyStats />
        )}
      </div>

      {/* Communication logs */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/[0.07]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Communication Logs
            {logsData && (
              <span className="ml-2 rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/20">
                {logsData.total.toLocaleString()}
              </span>
            )}
          </h2>
          {logsLoading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-[#1a1f2e] border-slate-200 dark:border-white/[0.07] hover:bg-slate-50 dark:hover:bg-[#1a1f2e]">
              <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Customer ID</TableHead>
              <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Status</TableHead>
              <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Sent At</TableHead>
              <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Delivered At</TableHead>
              <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Opened At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsLoading
              ? [...Array(5)].map((_, i) => (
                <TableRow key={i} className="border-slate-100 dark:border-white/[0.05] hover:bg-transparent">
                  {[...Array(5)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full bg-slate-200 dark:bg-white/10" /></TableCell>
                  ))}
                </TableRow>
              ))
              : logs.length === 0
                ? (
                  <TableRow className="border-slate-100 dark:border-white/[0.05] hover:bg-transparent">
                    <TableCell colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      {campaign.status === 'draft'
                        ? 'No messages sent yet — launch the campaign to start.'
                        : 'No logs found.'}
                    </TableCell>
                  </TableRow>
                )
                : logs.map((log) => (
                  <TableRow key={log.id} className="border-slate-100 dark:border-white/[0.05] hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                    <TableCell className="text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {log.customer_id.slice(0, 8)}…
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} />
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400 text-xs">
                      {formatDate(log.sent_at)}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400 text-xs">
                      {formatDate(log.delivered_at)}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400 text-xs">
                      {formatDate(log.opened_at)}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        {logsData && logsData.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/[0.07] px-5 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Page {logsPage} of {logsData.pages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                id="logs-prev-page"
                variant="outline"
                size="sm"
                onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                disabled={logsPage === 1}
                className="bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                id="logs-next-page"
                variant="outline"
                size="sm"
                onClick={() => setLogsPage((p) => Math.min(logsData.pages, p + 1))}
                disabled={logsPage === logsData.pages}
                className="bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
