import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { Endpoint, CreateEndpointRequest, UpdateEndpointRequest } from '@mockd/shared';
import { getApiBaseUrl } from '../config';

interface UseEndpointsReturn {
  endpoints: Endpoint[];
  loading: boolean;
  error: string | null;
  fetchEndpoints: (projectId: string) => Promise<void>;
  createEndpoint: (projectId: string, data: CreateEndpointRequest) => Promise<Endpoint>;
  updateEndpoint: (projectId: string, endpointId: string, data: UpdateEndpointRequest) => Promise<Endpoint>;
  deleteEndpoint: (projectId: string, endpointId: string) => Promise<void>;
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
      const errorMsg = json.error || 'Failed to create endpoint';
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    const json = await response.json();
    const newEndpoint = json.data as Endpoint;

    setEndpoints(prev => [...prev, newEndpoint]);
    toast.success('Endpoint created');

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
      const json = await response.json().catch(() => ({}));
      const errorMsg = json.error || 'Failed to update endpoint';
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    const json = await response.json();
    const updatedEndpoint = json.data as Endpoint;

    setEndpoints(prev => prev.map(e => e.id === endpointId ? updatedEndpoint : e));
    toast.success('Endpoint updated');

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
      const json = await response.json().catch(() => ({}));
      const errorMsg = json.error || 'Failed to delete endpoint';
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    setEndpoints(prev => prev.filter(e => e.id !== endpointId));
    toast.success('Endpoint deleted');
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
