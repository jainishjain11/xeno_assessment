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
    cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  },
  scheduled: {
    label: 'Scheduled',
    cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  running: {
    label: 'Running',
    cls: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  },
  completed: {
    label: 'Completed',
    cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  failed: {
    label: 'Failed',
    cls: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    cls: 'bg-white/10 text-slate-300 border-white/20',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}
    >
      {status === 'running' && (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-pink-400 animate-pulse inline-block" />
      )}
      {cfg.label}
    </span>
  );
}

// ── Channel badge ─────────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<string, { label: string; cls: string }> = {
  whatsapp: { label: 'WhatsApp', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  sms: { label: 'SMS', cls: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
  email: { label: 'Email', cls: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  rcs: { label: 'RCS', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
};

function ChannelBadge({ channel }: { channel: string }) {
  const cfg = CHANNEL_CONFIG[channel.toLowerCase()] ?? {
    label: channel,
    cls: 'bg-white/10 text-slate-300 border-white/20',
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
    <TableRow className="border-white/10 hover:bg-transparent">
      {[...Array(6)].map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full bg-white/10" />
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-400">
            {isLoading
              ? 'Loading…'
              : `${(data?.total ?? 0).toLocaleString()} campaign${(data?.total ?? 0) !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          id="new-campaign-btn"
          onClick={() => navigate('/campaigns/new')}
          className="gap-2 bg-gradient-to-br from-violet-600 to-violet-400 text-white border-none hover:opacity-90 hover:-translate-y-[1px] shadow-[0_4px_15px_rgba(167,139,250,0.4)]"
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
      <div className="glass overflow-hidden">
        {!isError && (
          <Table>
            <TableHeader>
              <TableRow className="bg-white/5 border-white/10 hover:bg-white/5">
                <TableHead className="w-[240px] text-slate-300">Campaign</TableHead>
                <TableHead className="text-slate-300">Channel</TableHead>
                <TableHead className="text-slate-300">Status</TableHead>
                <TableHead className="text-slate-300">Audience</TableHead>
                <TableHead className="text-slate-300">Delivery Rate</TableHead>
                <TableHead className="text-slate-300">Created</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                : campaigns.length === 0
                  ? (
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableCell colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Megaphone className="h-10 w-10 text-slate-500/40" />
                          <p className="text-sm text-slate-400">No campaigns yet.</p>
                          <Button
                            id="new-campaign-empty-btn"
                            variant="outline"
                            size="sm"
                            className="gap-2 bg-transparent border-white/20 text-slate-300 hover:bg-white/10 hover:text-slate-100"
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
                        className="cursor-pointer transition-colors hover:bg-white/5 border-white/10"
                        onClick={() => navigate(`/campaigns/${campaign.id}`)}
                      >
                        {/* Name */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
                              <Megaphone className="h-4 w-4" />
                            </div>
                            <span className="max-w-[180px] truncate font-medium text-slate-100">
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
                        <TableCell className="text-slate-400">
                          {audienceCount != null
                            ? audienceCount.toLocaleString()
                            : '—'}
                        </TableCell>

                        {/* Delivery rate — shown only for completed/running */}
                        <TableCell className="text-slate-400">
                          {campaign.status === 'completed' || campaign.status === 'running'
                            ? '—'
                            : '—'}
                        </TableCell>

                        {/* Created */}
                        <TableCell className="text-slate-400">
                          {formatDate(campaign.created_at)}
                        </TableCell>

                        {/* Arrow */}
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-slate-400/50" />
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
