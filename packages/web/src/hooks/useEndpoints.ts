import { useState, useCallback } from 'react';
import type { Endpoint, CreateEndpointRequest, UpdateEndpointRequest } from '@relay/shared';

interface UseEndpointsReturn {
  endpoints: Endpoint[];
  loading: boolean;
  error: string | null;
  fetchEndpoints: (projectId: string) => Promise<void>;
  createEndpoint: (projectId: string, data: CreateEndpointRequest) => Promise<Endpoint>;
  updateEndpoint: (projectId: string, endpointId: string, data: UpdateEndpointRequest) => Promise<Endpoint>;
  deleteEndpoint: (projectId: string, endpointId: string) => Promise<void>;
}

function getApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return 'http://localhost:8787';
  }
  return import.meta.env.VITE_API_URL || '';
}

export function useEndpoints(): UseEndpointsReturn {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEndpoints = useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/endpoints`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch endpoints');
      }

      const json = await response.json();
      setEndpoints(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch endpoints');
    } finally {
      setLoading(false);
    }
  }, []);

  const createEndpoint = useCallback(async (
    projectId: string,
    data: CreateEndpointRequest
  ): Promise<Endpoint> => {
    const response = await fetch(
      `${getApiBaseUrl()}/api/projects/${projectId}/endpoints`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw new Error(json.error || 'Failed to create endpoint');
    }

    const json = await response.json();
    const newEndpoint = json.data as Endpoint;

    setEndpoints(prev => [...prev, newEndpoint]);

    return newEndpoint;
  }, []);

  const updateEndpoint = useCallback(async (
    projectId: string,
    endpointId: string,
    data: UpdateEndpointRequest
  ): Promise<Endpoint> => {
    const response = await fetch(
      `${getApiBaseUrl()}/api/projects/${projectId}/endpoints/${endpointId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update endpoint');
    }

    const json = await response.json();
    const updatedEndpoint = json.data as Endpoint;

    setEndpoints(prev => prev.map(e => e.id === endpointId ? updatedEndpoint : e));

    return updatedEndpoint;
  }, []);

  const deleteEndpoint = useCallback(async (
    projectId: string,
    endpointId: string
  ): Promise<void> => {
    const response = await fetch(
      `${getApiBaseUrl()}/api/projects/${projectId}/endpoints/${endpointId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete endpoint');
    }

    setEndpoints(prev => prev.filter(e => e.id !== endpointId));
  }, []);

  return {
    endpoints,
    loading,
    error,
    fetchEndpoints,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
  };
}
