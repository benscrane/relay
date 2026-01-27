import { useState, useCallback } from 'react';
import type { MockRule, CreateMockRuleRequest, UpdateMockRuleRequest } from '@relay/shared';

interface UseRulesReturn {
  rules: MockRule[];
  loading: boolean;
  error: string | null;
  fetchRules: (projectId: string, endpointId: string) => Promise<void>;
  createRule: (projectId: string, endpointId: string, data: Omit<CreateMockRuleRequest, 'endpointId'>) => Promise<MockRule>;
  updateRule: (projectId: string, endpointId: string, ruleId: string, data: UpdateMockRuleRequest) => Promise<MockRule>;
  deleteRule: (projectId: string, endpointId: string, ruleId: string) => Promise<void>;
}

function getApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return 'http://localhost:8787';
  }
  return import.meta.env.VITE_API_URL || '';
}

export function useRules(): UseRulesReturn {
  const [rules, setRules] = useState<MockRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async (projectId: string, endpointId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/projects/${projectId}/endpoints/${endpointId}/rules`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch rules');
      }

      const json = await response.json();
      setRules(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  }, []);

  const createRule = useCallback(async (
    projectId: string,
    endpointId: string,
    data: Omit<CreateMockRuleRequest, 'endpointId'>
  ): Promise<MockRule> => {
    const response = await fetch(
      `${getApiBaseUrl()}/api/projects/${projectId}/endpoints/${endpointId}/rules`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create rule');
    }

    const json = await response.json();
    const newRule = json.data as MockRule;

    setRules(prev => [...prev, newRule]);

    return newRule;
  }, []);

  const updateRule = useCallback(async (
    projectId: string,
    endpointId: string,
    ruleId: string,
    data: UpdateMockRuleRequest
  ): Promise<MockRule> => {
    const response = await fetch(
      `${getApiBaseUrl()}/api/projects/${projectId}/endpoints/${endpointId}/rules/${ruleId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update rule');
    }

    const json = await response.json();
    const updatedRule = json.data as MockRule;

    setRules(prev => prev.map(r => r.id === ruleId ? updatedRule : r));

    return updatedRule;
  }, []);

  const deleteRule = useCallback(async (
    projectId: string,
    endpointId: string,
    ruleId: string
  ): Promise<void> => {
    const response = await fetch(
      `${getApiBaseUrl()}/api/projects/${projectId}/endpoints/${endpointId}/rules/${ruleId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete rule');
    }

    setRules(prev => prev.filter(r => r.id !== ruleId));
  }, []);

  return {
    rules,
    loading,
    error,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
  };
}
