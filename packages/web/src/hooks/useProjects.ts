import { useState, useCallback } from 'react';
import type { Project, CreateProjectRequest } from '@mockd/shared';
import { getApiBaseUrl } from '../config';
import {
  addAnonymousProjectId,
  removeAnonymousProjectId,
  getAnonymousProjectIds,
  clearAllAnonymousProjects,
} from '../utils/anonymousProjects';

interface UseProjectsReturn {
  projects: Project[];
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  fetchAnonymousProjects: () => Promise<Project[]>;
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

  // Fetch anonymous projects stored in localStorage
  const fetchAnonymousProjects = useCallback(async (): Promise<Project[]> => {
    const anonymousIds = getAnonymousProjectIds();
    if (anonymousIds.length === 0) return [];

    const projects: Project[] = [];

    await Promise.all(
      anonymousIds.map(async (id) => {
        try {
          const response = await fetch(`${getApiBaseUrl()}/api/projects/${id}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const json = await response.json();
            projects.push(json.data as Project);
          } else {
            // Project no longer exists, remove from localStorage
            removeAnonymousProjectId(id);
          }
        } catch {
          // Ignore individual fetch errors
        }
      })
    );

    return projects;
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
    // Only one anonymous project allowed per browser
    // Delete any existing anonymous projects before creating a new one
    const existingIds = getAnonymousProjectIds();
    if (existingIds.length > 0) {
      // Delete existing anonymous projects from the server (ignore errors)
      await Promise.all(
        existingIds.map(async (id) => {
          try {
            await fetch(`${getApiBaseUrl()}/api/projects/${id}`, {
              method: 'DELETE',
              credentials: 'include',
            });
          } catch {
            // Ignore deletion errors - project may already be gone
          }
        })
      );
      // Clear localStorage
      clearAllAnonymousProjects();
      // Remove from local state
      setProjects(prev => prev.filter(p => !existingIds.includes(p.id)));
    }

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

    // Store in localStorage so user can access it later
    addAnonymousProjectId(newProject.id);

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

    // Remove from localStorage if it was an anonymous project
    removeAnonymousProjectId(projectId);

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
    fetchAnonymousProjects,
    getProject,
    createProject,
    createAnonymousProject,
    deleteProject,
    clearProjects,
  };
}
