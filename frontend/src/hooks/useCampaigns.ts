import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  segment_id: string;
  channel: string;
  message_template: string;
  status: 'draft' | 'running' | 'completed' | 'failed' | 'scheduled';
  started_at?: string;
  completed_at?: string;
  audience_snapshot?: { customer_ids?: string[] } | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignStats {
  campaign_id: string;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_opened: number;
  total_read: number;
  total_clicked: number;
  total_converted: number;
  delivery_rate: number | null;
  open_rate: number | null;
  ctr: number | null;
}

export interface CommunicationLog {
  id: string;
  campaign_id: string;
  customer_id: string;
  channel: string;
  message_body: string;
  status: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  failed_at?: string;
  created_at: string;
}

export interface PaginatedCampaigns {
  items: Campaign[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface PaginatedLogs {
  items: CommunicationLog[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface CreateCampaignPayload {
  name: string;
  segment_id: string;
  channel: string;
  message_template: string;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const campaignKeys = {
  all: ['campaigns'] as const,
  lists: () => [...campaignKeys.all, 'list'] as const,
  list: (filters?: object) => [...campaignKeys.lists(), filters] as const,
  details: () => [...campaignKeys.all, 'detail'] as const,
  detail: (id: string) => [...campaignKeys.details(), id] as const,
  stats: (id: string) => [...campaignKeys.detail(id), 'stats'] as const,
  logs: (id: string, page: number) => [...campaignKeys.detail(id), 'logs', page] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * All campaigns (paginated, optional status filter).
 */
export function useCampaigns(page = 1, size = 50, status?: string) {
  return useQuery<PaginatedCampaigns>({
    queryKey: campaignKeys.list({ page, size, status }),
    queryFn: async () => {
      const params: Record<string, unknown> = { page, size };
      if (status) params.status = status;
      const { data } = await api.get<PaginatedCampaigns>('/campaigns', { params });
      return data;
    },
  });
}

/**
 * Single campaign by ID.
 */
export function useCampaign(id: string) {
  return useQuery<Campaign>({
    queryKey: campaignKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Campaign>(`/campaigns/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Campaign funnel stats.
 */
export function useCampaignStats(id: string) {
  return useQuery<CampaignStats>({
    queryKey: campaignKeys.stats(id),
    queryFn: async () => {
      const { data } = await api.get<CampaignStats>(`/campaigns/${id}/stats`);
      return data;
    },
    enabled: !!id,
    // Poll every 30s when campaign is running
    refetchInterval: (query) => {
      const campaign = query.state.data;
      return campaign ? 30_000 : false;
    },
  });
}

/**
 * Paginated communication logs for a campaign.
 */
export function useCampaignLogs(id: string, page = 1) {
  return useQuery<PaginatedLogs>({
    queryKey: campaignKeys.logs(id, page),
    queryFn: async () => {
      const { data } = await api.get<PaginatedLogs>(`/campaigns/${id}/logs`, {
        params: { page, size: 20 },
      });
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Create campaign mutation → POST /campaigns.
 */
export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation<Campaign, Error, CreateCampaignPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post<Campaign>('/campaigns', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
    },
  });
}

/**
 * Launch campaign mutation → POST /campaigns/:id/launch.
 */
export function useLaunchCampaign() {
  const queryClient = useQueryClient();

  return useMutation<Campaign, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.post<Campaign>(`/campaigns/${id}/launch`);
      return data;
    },
    onSuccess: (campaign) => {
      // Invalidate the specific campaign and the list
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(campaign.id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
    },
  });
}
