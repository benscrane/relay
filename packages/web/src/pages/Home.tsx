import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useProjects, useAuth } from '../hooks';
import { ProjectList, ProjectForm } from '../components/project';
import { getApiBaseUrl } from '../config';

export function Home() {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();
  const { projects, loading, error, fetchProjects, createProject, createAnonymousProject, deleteProject } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [endpointCounts, setEndpointCounts] = useState<Record<string, number>>({});

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

  // Fetch endpoint counts when projects change
  useEffect(() => {
    if (projects.length > 0) {
      fetchEndpointCounts(projects.map(p => p.id));
    }
  }, [projects, fetchEndpointCounts]);

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
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Relay</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={handleQuickStart}
                disabled={isCreating}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Quick Start
              </button>
              {user && (
                <button
                  onClick={() => setShowForm(true)}
                  disabled={isCreating}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Project
                </button>
              )}
              {!authLoading && (
                user ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">{user.email}</span>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Sign in
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {showForm && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Project</h2>
            <ProjectForm
              onSubmit={handleCreateProject}
              onCancel={() => setShowForm(false)}
              isLoading={isCreating}
            />
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
            {error}
          </div>
        )}

        {loading && projects.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Loading projects...</div>
        ) : (
          <ProjectList
            projects={projects}
            endpointCounts={endpointCounts}
            onDelete={handleDelete}
            emptyAction={
              <div className="flex gap-3">
                <button
                  onClick={handleQuickStart}
                  disabled={isCreating}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  Quick Start (Anonymous)
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  disabled={isCreating}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Project
                </button>
              </div>
            }
          />
        )}
      </main>
    </div>
  );
}
