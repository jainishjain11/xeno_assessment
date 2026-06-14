import { useNavigate } from 'react-router-dom';
import { Plus, Megaphone, ChevronRight } from 'lucide-react';
import { useCampaigns } from '@/hooks/useCampaigns';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; cls: string }
> = {
  draft: {
    label: 'Draft',
    cls: 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border-slate-500/20',
  },
  scheduled: {
    label: 'Scheduled',
    cls: 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/20',
  },
  running: {
    label: 'Running',
    cls: 'bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/20',
  },
  completed: {
    label: 'Completed',
    cls: 'bg-green-500/15 text-green-500 dark:text-green-400 border-green-500/20',
  },
  failed: {
    label: 'Failed',
    cls: 'bg-red-500/15 text-red-500 dark:text-red-400 border-red-500/20',
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    cls: 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/20',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}
    >
      {status === 'running' && (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse inline-block" />
      )}
      {cfg.label}
    </span>
  );
}

// ── Channel badge ─────────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<string, { label: string; cls: string }> = {
  whatsapp: { label: 'WhatsApp', cls: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20' },
  sms: { label: 'SMS', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  email: { label: 'Email', cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  rcs: { label: 'RCS', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20' },
};

function ChannelBadge({ channel }: { channel: string }) {
  const cfg = CHANNEL_CONFIG[channel.toLowerCase()] ?? {
    label: channel,
    cls: 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/20',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <TableRow className="border-slate-100 dark:border-white/[0.05] hover:bg-transparent">
      {[...Array(6)].map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full bg-slate-200 dark:bg-white/10" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CampaignList() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useCampaigns();

  const campaigns = data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isLoading
              ? 'Loading…'
              : `${(data?.total ?? 0).toLocaleString()} campaign${(data?.total ?? 0) !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          id="new-campaign-btn"
          onClick={() => navigate('/campaigns/new')}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Error */}
      {isError && (
        <ErrorMessage 
          message="Failed to load campaigns." 
          onRetry={() => window.location.reload()} 
        />
      )}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {!isError && (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-[#1a1f2e] border-slate-200 dark:border-white/[0.07] hover:bg-slate-50 dark:hover:bg-[#1a1f2e]">
                <TableHead className="w-[240px] text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Campaign</TableHead>
                <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Channel</TableHead>
                <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Status</TableHead>
                <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Audience</TableHead>
                <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Delivery Rate</TableHead>
                <TableHead className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Created</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                : campaigns.length === 0
                  ? (
                    <TableRow className="border-slate-100 dark:border-white/[0.05] hover:bg-transparent">
                      <TableCell colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Megaphone className="h-10 w-10 text-slate-400 dark:text-slate-600" />
                          <p className="text-sm text-slate-500 dark:text-slate-400">No campaigns yet.</p>
                          <Button
                            id="new-campaign-empty-btn"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => navigate('/campaigns/new')}
                          >
                            <Plus className="h-4 w-4" />
                            Create Campaign
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                  : campaigns.map((campaign) => {
                    const audienceCount = Array.isArray(
                      campaign.audience_snapshot?.customer_ids
                    )
                      ? campaign.audience_snapshot.customer_ids.length
                      : null;

                    return (
                      <TableRow
                        key={campaign.id}
                        id={`campaign-row-${campaign.id}`}
                        className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] border-slate-100 dark:border-white/[0.05]"
                        onClick={() => navigate(`/campaigns/${campaign.id}`)}
                      >
                        {/* Name */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-crm-blue-dim dark:text-blue-500">
                              <Megaphone className="h-4 w-4" />
                            </div>
                            <span className="max-w-[180px] truncate font-medium text-slate-900 dark:text-slate-100">
                              {campaign.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Channel */}
                        <TableCell>
                          <ChannelBadge channel={campaign.channel} />
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <StatusBadge status={campaign.status} />
                        </TableCell>

                        {/* Audience */}
                        <TableCell className="text-slate-600 dark:text-slate-300">
                          {audienceCount != null
                            ? audienceCount.toLocaleString()
                            : '—'}
                        </TableCell>

                        {/* Delivery rate — shown only for completed/running */}
                        <TableCell className="text-slate-600 dark:text-slate-300">
                          {campaign.status === 'completed' || campaign.status === 'running'
                            ? '—'
                            : '—'}
                        </TableCell>

                        {/* Created */}
                        <TableCell className="text-slate-500 dark:text-slate-400">
                          {formatDate(campaign.created_at)}
                        </TableCell>

                        {/* Arrow */}
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
