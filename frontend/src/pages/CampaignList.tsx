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
    cls: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  scheduled: {
    label: 'Scheduled',
    cls: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  running: {
    label: 'Running',
    cls: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  completed: {
    label: 'Completed',
    cls: 'bg-green-100 text-green-700 border-green-200',
  },
  failed: {
    label: 'Failed',
    cls: 'bg-red-100 text-red-700 border-red-200',
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    cls: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}
    >
      {status === 'running' && (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
      )}
      {cfg.label}
    </span>
  );
}

// ── Channel badge ─────────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<string, { label: string; cls: string }> = {
  whatsapp: { label: 'WhatsApp', cls: 'bg-emerald-100 text-emerald-700' },
  sms: { label: 'SMS', cls: 'bg-sky-100 text-sky-700' },
  email: { label: 'Email', cls: 'bg-purple-100 text-purple-700' },
  rcs: { label: 'RCS', cls: 'bg-orange-100 text-orange-700' },
};

function ChannelBadge({ channel }: { channel: string }) {
  const cfg = CHANNEL_CONFIG[channel.toLowerCase()] ?? {
    label: channel,
    cls: 'bg-gray-100 text-gray-600',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <TableRow>
      {[...Array(6)].map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {!isError && (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[240px]">Campaign</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Delivery Rate</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                : campaigns.length === 0
                  ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Megaphone className="h-10 w-10 text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
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
                        className="cursor-pointer transition-colors hover:bg-muted/40"
                        onClick={() => navigate(`/campaigns/${campaign.id}`)}
                      >
                        {/* Name */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Megaphone className="h-4 w-4" />
                            </div>
                            <span className="max-w-[180px] truncate font-medium text-foreground">
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
                        <TableCell className="text-muted-foreground">
                          {audienceCount != null
                            ? audienceCount.toLocaleString()
                            : '—'}
                        </TableCell>

                        {/* Delivery rate — shown only for completed/running */}
                        <TableCell className="text-muted-foreground">
                          {campaign.status === 'completed' || campaign.status === 'running'
                            ? '—'
                            : '—'}
                        </TableCell>

                        {/* Created */}
                        <TableCell className="text-muted-foreground">
                          {formatDate(campaign.created_at)}
                        </TableCell>

                        {/* Arrow */}
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
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
