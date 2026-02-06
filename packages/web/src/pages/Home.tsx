import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useProjects, useAuth, useTemplateCreation } from '../hooks';
import { ProjectList, ProjectForm } from '../components/project';
import { WelcomeModal, hasSeenWelcome, TemplateSelector } from '../components/onboarding';
import { getApiBaseUrl } from '../config';
import type { Project, ProjectTemplate } from '@mockd/shared';

export function Home() {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();
  const { projects, loading, error, fetchProjects, fetchAnonymousProjects, createProject, createAnonymousProject, clearProjects } = useProjects();
  const { createFromTemplate, isCreating: isTemplateCreating, loadingTemplateId } = useTemplateCreation();
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [endpointCounts, setEndpointCounts] = useState<Record<string, number>>({});
  const [anonymousProjects, setAnonymousProjects] = useState<Project[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);

  // Show welcome modal for first-time visitors once loading finishes
  useEffect(() => {
    if (!loading && !authLoading && !hasSeenWelcome()) {
      setShowWelcome(true);
    }
  }, [loading, authLoading]);

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

  const handleTemplateSelect = async (template: ProjectTemplate) => {
    try {
      const project = await createFromTemplate(template);
      navigate(`/projects/${project.id}?from=template`);
    } catch {
      // Error handled by hook
    }
  };

  const hasProjects = allProjects.length > 0;

  return (
    <div className="min-h-screen bg-base-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-row items-center justify-end">
            <div className="flex items-center gap-3">
              <button
                onClick={handleQuickStart}
                disabled={isCreating || isTemplateCreating}
                className="btn btn-outline"
              >
                Temp Mock
              </button>
              {user && (
                <button
                  onClick={()=>(document.getElementById('new_project_modal') as any)?.showModal()}
                  disabled={isCreating || isTemplateCreating}
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
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
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
        ) : hasProjects ? (
          <ProjectList
            projects={allProjects}
            endpointCounts={endpointCounts}
          />
        ) : (
          <div className="flex flex-col items-center py-12 px-4">
            <svg className="w-12 h-12 text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-lg font-medium text-base-content mb-1">No projects yet</h3>
            <p className="text-sm text-base-content/70 mb-6 max-w-md text-center">
              Get started quickly by choosing a template below, or create a blank project.
            </p>
            <div className="w-full max-w-2xl">
              <h4 className="text-sm font-medium text-base-content/70 mb-3">Start from a template</h4>
              <TemplateSelector
                onSelect={handleTemplateSelect}
                isLoading={isTemplateCreating}
                loadingTemplateId={loadingTemplateId}
              />
            </div>
          </div>
        )}
      </main>

      <WelcomeModal
        isOpen={showWelcome}
        onClose={() => setShowWelcome(false)}
        onGetStarted={() => {
          setShowWelcome(false);
          // If user has no projects, the template selector is already visible below.
          // Scroll to it for emphasis.
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
