import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useAuthStore } from '@/store/auth';
import type { CampaignStats } from './useCampaigns';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SSEState {
  /** Live funnel stats from SSE stream */
  stats: CampaignStats | null;
  /** Whether the SSE connection is currently established */
  isLive: boolean;
  /** Any connection error message */
  error: string | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useCampaignSSE
 *
 * Connects to GET /api/analytics/live/:campaignId?token=JWT via Server-Sent Events.
 * - Parses "funnel_update" events → updates stats state
 * - "heartbeat" events are no-ops (just keeps connection alive)
 * - Automatically reconnects on disconnect (built-in to fetchEventSource with retry)
 * - Cleans up the connection on component unmount
 * - Exposes isLive boolean to show a "Live" indicator badge
 */
export function useCampaignSSE(campaignId: string): SSEState {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Abort controller ref for cleanup
  const abortRef = useRef<AbortController | null>(null);

  const connect = useCallback(() => {
    // Clean up any previous connection
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const token = useAuthStore.getState().token;
    if (!token || !campaignId) return;

    // Build the SSE URL — backend accepts token as query param for EventSource clients
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';
    // The SSE route is at /api/analytics/live/:id (no /v1 in the backend prefix)
    // Strip /v1 if present to hit the correct path
    const apiRoot = baseUrl.replace(/\/v1\/?$/, '');
    const url = `${apiRoot}/analytics/live/${campaignId}?token=${encodeURIComponent(token)}`;

    const abortController = new AbortController();
    abortRef.current = abortController;

    fetchEventSource(url, {
      signal: abortController.signal,
      headers: {
        Accept: 'text/event-stream',
      },

      onopen: async (response) => {
        if (response.ok) {
          setIsLive(true);
          setError(null);
        } else {
          setIsLive(false);
          setError(`Connection failed: ${response.status}`);
          // Don't retry on 4xx auth errors
          if (response.status === 401 || response.status === 403) {
            abortController.abort();
          }
        }
      },

      onmessage: (event) => {
        if (event.event === 'funnel_update') {
          try {
            const data = JSON.parse(event.data) as Partial<CampaignStats> & {
              detail?: string;
            };
            // Ignore "no stats yet" placeholder
            if (!data.detail) {
              setStats(data as CampaignStats);
            }
          } catch {
            // Ignore malformed events
          }
        }
        // heartbeat → no-op
      },

      onerror: (err) => {
        setIsLive(false);
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
        }
        // fetchEventSource retries automatically unless we throw
        // We throw only on AbortError (intentional cleanup)
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw err;
        }
        // For other errors, let the library retry with backoff
      },

      onclose: () => {
        setIsLive(false);
      },
    }).catch((err: unknown) => {
      // AbortError is expected on cleanup — suppress it
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.name === 'AbortError') return;
      setIsLive(false);
      setError(err instanceof Error ? err.message : 'SSE connection error');
    });
  }, [campaignId]);

  useEffect(() => {
    connect();

    return () => {
      // Cleanup: abort the SSE connection on unmount
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setIsLive(false);
    };
  }, [connect]);

  return { stats, isLive, error };
}
