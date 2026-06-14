import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  external_id?: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  tags: string[];
  total_spent: number;
  order_count: number;
  last_order_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  external_id?: string;
  amount: number;
  status: string;
  channel?: string;
  items: unknown[];
  ordered_at: string;
  created_at: string;
}

export interface CommunicationLog {
  id: string;
  campaign_id: string;
  channel: string;
  message_body: string;
  status: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  failed_at?: string;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  orders?: Order[];
}

export interface PaginatedCustomers {
  items: Customer[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ImportCustomer {
  name: string;
  email: string;
  phone?: string;
  city?: string;
  tags?: string[];
  external_id?: string;
}

export interface ImportResult {
  message: string;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (page: number, size: number, search?: string) =>
    [...customerKeys.lists(), { page, size, search }] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Paginated customer list.
 * NOTE: The backend GET /customers does not currently support a "search" query
 * param, so we do client-side filtering on the returned page when search is set.
 */
export function useCustomers(page = 1, size = 50, search?: string) {
  return useQuery<PaginatedCustomers>({
    queryKey: customerKeys.list(page, size, search),
    queryFn: async () => {
      const { data } = await api.get<PaginatedCustomers>('/customers', {
        params: { page, size },
      });
      // Client-side search filter while backend doesn't have search param
      if (search?.trim()) {
        const term = search.trim().toLowerCase();
        const filtered = data.items.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            c.email.toLowerCase().includes(term) ||
            (c.city ?? '').toLowerCase().includes(term)
        );
        return { ...data, items: filtered, total: filtered.length };
      }
      return data;
    },
  });
}

/**
 * Single customer detail with order history.
 */
export function useCustomer(id: string) {
  return useQuery<CustomerDetail>({
    queryKey: customerKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<CustomerDetail>(`/customers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Customer orders via /customers/:id/orders endpoint.
 */
export function useCustomerOrders(customerId: string) {
  return useQuery<Order[]>({
    queryKey: [...customerKeys.detail(customerId), 'orders'],
    queryFn: async () => {
      const { data } = await api.get<{ items?: Order[] } | Order[]>(
        `/customers/${customerId}/orders`
      );
      return Array.isArray(data) ? data : (data as { items?: Order[] }).items ?? [];
    },
    enabled: !!customerId,
  });
}

/**
 * Mutation to bulk-import customers via POST /customers/bulk.
 */
export function useImportCustomers() {
  const queryClient = useQueryClient();

  return useMutation<ImportResult, Error, ImportCustomer[]>({
    mutationFn: async (customers) => {
      const { data } = await api.post<ImportResult>('/customers/bulk', {
        customers,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}
