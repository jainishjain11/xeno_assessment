import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_customers: number;
  active_campaigns: number;
  total_messages_sent: number;
  avg_delivery_rate: number;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Derives dashboard summary stats from existing endpoints
 * (customers list total + campaigns list aggregation).
 */
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['analytics', 'dashboard'],
    queryFn: async () => {
      // Fetch in parallel
      const [customersRes, campaignsRes] = await Promise.allSettled([
        api.get('/customers', { params: { page: 1, size: 1 } }),
        api.get('/campaigns', { params: { page: 1, size: 100 } }),
      ]);

      const totalCustomers =
        customersRes.status === 'fulfilled'
          ? (customersRes.value.data as { total?: number }).total ?? 0
          : 0;

      const campaigns =
        campaignsRes.status === 'fulfilled'
          ? ((campaignsRes.value.data as { items?: { status: string }[] }).items ?? [])
          : [];

      const activeCampaigns = campaigns.filter(
        (c) => c.status === 'running' || c.status === 'draft'
      ).length;

      // Rough stats — real funnel data would come from /campaigns/:id/stats
      return {
        total_customers: totalCustomers,
        active_campaigns: activeCampaigns,
        total_messages_sent: 0, // Would require aggregating all campaigns
        avg_delivery_rate: 0,   // Same
      };
    },
    staleTime: 60_000,
  });
}
