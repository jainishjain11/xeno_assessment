import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FilterRule {
  field: string;
  op: string;
  value: string | number;
}

export interface FilterGroup {
  operator: 'AND' | 'OR';
  rules: (FilterRule | FilterGroup)[];
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  filter_rules: FilterGroup;
  ai_prompt?: string;
  audience_size?: number;
  created_at: string;
  updated_at: string;
}

export interface SegmentPreview {
  /** Count of matching customers */
  estimated_count: number;
  /** SQL query string (informational) */
  sql_query?: string;
}

export interface CreateSegmentPayload {
  name: string;
  description?: string;
  filter_rules: FilterGroup;
  ai_prompt?: string;
}

export interface PaginatedSegments {
  items: Segment[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const segmentKeys = {
  all: ['segments'] as const,
  lists: () => [...segmentKeys.all, 'list'] as const,
  details: () => [...segmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...segmentKeys.details(), id] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * All segments list (returns paginated from backend, we unwrap items).
 */
export function useSegments() {
  return useQuery<Segment[]>({
    queryKey: segmentKeys.lists(),
    queryFn: async () => {
      // Backend returns PaginatedResponse with items array
      const { data } = await api.get<PaginatedSegments>('/segments', {
        params: { page: 1, size: 100 },
      });
      return data.items ?? [];
    },
  });
}

/**
 * Single segment detail.
 */
export function useSegment(id: string) {
  return useQuery<Segment>({
    queryKey: segmentKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Segment>(`/segments/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Mutation to create a new segment.
 */
export function useCreateSegment() {
  const queryClient = useQueryClient();

  return useMutation<Segment, Error, CreateSegmentPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post<Segment>('/segments', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: segmentKeys.lists() });
    },
  });
}

/**
 * Mutation to preview a segment — calls POST /segments/preview with filter_rules.
 * Returns { estimated_count, sql_query }.
 */
export function usePreviewSegment() {
  return useMutation<SegmentPreview, Error, FilterGroup>({
    mutationFn: async (filter_rules) => {
      const { data } = await api.post<SegmentPreview>('/segments/preview', filter_rules);
      return data;
    },
  });
}
