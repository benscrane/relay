import { useState, useCallback } from 'react';
import type { Project, CreateProjectRequest } from '@relay/shared';
import { getApiBaseUrl } from '../config';

interface UseProjectsReturn {
  projects: Project[];
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  getProject: (projectId: string) => Promise<Project>;
  createProject: (data: CreateProjectRequest) => Promise<Project>;
  createAnonymousProject: () => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  clearProjects: () => void;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/projects`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const json = await response.json();
      setProjects(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const getProject = useCallback(async (projectId: string): Promise<Project> => {
    const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch project');
    }

    const json = await response.json();
    return json.data as Project;
  }, []);

  const createProject = useCallback(async (data: CreateProjectRequest): Promise<Project> => {
    const response = await fetch(`${getApiBaseUrl()}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw new Error(json.error || 'Failed to create project');
    }

    const json = await response.json();
    const newProject = json.data as Project;

    setProjects(prev => [...prev, newProject]);

    return newProject;
  }, []);

  const createAnonymousProject = useCallback(async (name?: string): Promise<Project> => {
    const response = await fetch(`${getApiBaseUrl()}/api/projects/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw new Error(json.error || 'Failed to create anonymous project');
    }

    const json = await response.json();
    const newProject = json.data as Project;

    setProjects(prev => [...prev, newProject]);

    return newProject;
  }, []);

  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to delete project');
    }

    setProjects(prev => prev.filter(p => p.id !== projectId));
  }, []);

  const clearProjects = useCallback(() => {
    setProjects([]);
  }, []);

  return {
    projects,
    loading,
    error,
    fetchProjects,
    getProject,
    createProject,
    createAnonymousProject,
    deleteProject,
    clearProjects,
  };
}
