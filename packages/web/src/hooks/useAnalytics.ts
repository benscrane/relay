import { useState, useCallback, useEffect } from 'react';
import { getApiBaseUrl } from '../config';

export interface EndpointAnalytics {
  totalRequests: number;
  avgResponseTime: number;
  statusCodes: Record<number, number>;
  methods: Record<string, number>;
  requestsOverTime: Array<{ timestamp: string; count: number }>;
  requestsToday: number;
  requestsYesterday: number;
}

interface UseAnalyticsReturn {
  analytics: EndpointAnalytics | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAnalytics(projectId?: string, endpointId?: string): UseAnalyticsReturn {
  const [analytics, setAnalytics] = useState<EndpointAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!projectId || !endpointId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/projects/${projectId}/endpoints/${endpointId}/analytics`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const json = await response.json();
      setAnalytics(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [projectId, endpointId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { analytics, loading, error, refetch: fetchAnalytics };
}
