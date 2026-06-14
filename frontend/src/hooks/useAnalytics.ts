import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_customers: number;
  active_campaigns: number;
  total_messages_sent: number;
  avg_delivery_rate: number | null;
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
      const { data } = await api.get<DashboardStats>('/analytics/dashboard');
      return data;
    },
    staleTime: 60_000,
  });
}
