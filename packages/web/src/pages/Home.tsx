import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useProjects, useAuth } from '../hooks';
import { ProjectList, ProjectForm } from '../components/project';
import { getApiBaseUrl } from '../config';
import type { Project } from '@mockd/shared';

export function Home() {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();
  const { projects, loading, error, fetchProjects, fetchAnonymousProjects, createProject, createAnonymousProject, deleteProject, clearProjects } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [endpointCounts, setEndpointCounts] = useState<Record<string, number>>({});
  const [anonymousProjects, setAnonymousProjects] = useState<Project[]>([]);

  // Fetch endpoint counts for all projects
  const fetchEndpointCounts = useCallback(async (projectIds: string[]) => {
    const counts: Record<string, number> = {};

    await Promise.all(
      projectIds.map(async (projectId) => {
        try {
          const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/endpoints`, {
            credentials: 'include',
          });
          if (response.ok) {
            const json = await response.json();
            counts[projectId] = (json.data || []).length;
          }
        } catch {
          // Ignore errors for individual projects
        }
      })
    );

    setEndpointCounts(counts);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Fetch anonymous projects from localStorage
  useEffect(() => {
    const loadAnonymousProjects = async () => {
      const anon = await fetchAnonymousProjects();
      setAnonymousProjects(anon);
    };
    loadAnonymousProjects();
  }, [fetchAnonymousProjects]);

  // Clear projects when user logs out
  useEffect(() => {
    if (!user && !authLoading) {
      clearProjects();
    }
  }, [user, authLoading, clearProjects]);

  // Combine authenticated projects with anonymous projects
  const allProjects = [...projects, ...anonymousProjects];

  // Fetch endpoint counts when projects change
  useEffect(() => {
    const allIds = [...projects.map(p => p.id), ...anonymousProjects.map(p => p.id)];
    if (allIds.length > 0) {
      fetchEndpointCounts(allIds);
    }
  }, [projects, anonymousProjects, fetchEndpointCounts]);

  const handleLogout = async () => {
    await logout();
    fetchProjects(); // Refresh projects after logout
  };

  const handleCreateProject = async (data: { name: string; subdomain: string }) => {
    setIsCreating(true);
    try {
      const project = await createProject(data);
      setShowForm(false);
      navigate(`/projects/${project.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleQuickStart = async () => {
    setIsCreating(true);
    try {
      const project = await createAnonymousProject();
      // Add to anonymous projects list
      setAnonymousProjects(prev => [...prev, project]);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      console.error('Failed to create anonymous project:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      await deleteProject(projectId);
      // Also remove from anonymous projects state if it was there
      setAnonymousProjects(prev => prev.filter(p => p.id !== projectId));
    }
  };

  return (
    <div className="min-h-screen bg-base-100">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-row items-center justify-end">
            <div className="flex items-center gap-3">
              <button
                onClick={handleQuickStart}
                disabled={isCreating}
                className="btn btn-outline"
              >
                Quick Start
              </button>
              {user && (
                <button
                  onClick={()=>(document.getElementById('new_project_modal') as any)?.showModal()}
                  disabled={isCreating}
                  className="btn btn-primary"
                >
                  Create Project
                </button>
              )}
            </div>
          </div>
        </div>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <dialog id="new_project_modal" className="modal modal-bottom sm:modal-middle">
          <div className="modal-box max-w-4xl">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => console.log('clicked')}>✕</button>
            </form>
            <h3 className="font-bold text-lg">New Project</h3>
            <ProjectForm
              onSubmit={handleCreateProject}
              onCancel={() => setShowForm(false)}
              isLoading={isCreating}
            />
            <div className="modal-action">
            </div>
          </div>
        </dialog>

        {error && (
          <div className="alert alert-error mb-8">
            {error}
          </div>
        )}

        {loading && allProjects.length === 0 ? (
          <div className="text-center py-12 text-base-content/70">Loading projects...</div>
        ) : (
          <ProjectList
            projects={allProjects}
            endpointCounts={endpointCounts}
            onDelete={handleDelete}
          />
        )}
      </main>
    </div>
  );
}
