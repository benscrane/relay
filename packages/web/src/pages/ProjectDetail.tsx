import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Project, CreateEndpointRequest } from '@mockd/shared';
import { useProjects, useEndpoints, useAuth } from '../hooks';
import { EndpointList, EndpointForm } from '../components/endpoint';
import { Breadcrumbs, CopyButton, ConfirmDialog } from '../components/common';
import { getMockApiSubdomainUrl } from '../config';

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { getProject, updateProject, deleteProject, claimProject } = useProjects();
  const { endpoints, loading: endpointsLoading, fetchEndpoints, createEndpoint } = useEndpoints();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(searchParams.get('from') === 'template');

  const isAnonymous = project !== null && !project.userId;
  const canClaim = isAnonymous && !!user;

  const handleClaimProject = async () => {
    if (!projectId) return;
    setIsClaiming(true);
    try {
      const claimed = await claimProject(projectId);
      setProject(claimed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim project');
    } finally {
      setIsClaiming(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [projectData] = await Promise.all([
          getProject(projectId),
          fetchEndpoints(projectId),
        ]);
        setProject(projectData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, getProject, fetchEndpoints]);

  const handleCreateEndpoint = async (data: CreateEndpointRequest) => {
    if (!projectId) return;

    setIsCreating(true);
    try {
      await createEndpoint(projectId, data);
      setShowForm(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditProject = () => {
    if (!project) return;
    setEditName(project.name);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!projectId || !editName.trim()) return;

    try {
      const updated = await updateProject(projectId, { name: editName.trim() });
      setProject(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName('');
  };

  const handleDeleteProject = () => {
    setShowDeleteProject(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectId) return;
    await deleteProject(projectId);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-base-content/70">Loading project...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <p className="text-error mb-4">{error || 'Project not found'}</p>
          <Link to="/" className="link link-primary">Back to Home</Link>
        </div>
      </div>
    );
  }

  const endpointBaseUrl = getMockApiSubdomainUrl(project.subdomain);

  return (
    <div className="min-h-screen bg-base-200">
      <header className="bg-base-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: project.name },
            ]}
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-4">
              <div>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input input-bordered input-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                    />
                    <button onClick={handleSaveEdit} className="btn btn-primary btn-sm">Save</button>
                    <button onClick={handleCancelEdit} className="btn btn-ghost btn-sm">Cancel</button>
                  </div>
                ) : (
                  <h1 className="text-xl font-bold text-base-content">{project.name}</h1>
                )}
                <p className="text-sm text-base-content/70">
                  <code className="text-xs bg-base-200 px-1.5 py-0.5 rounded-sm">{project.subdomain}</code>
                </p>
              </div>
            </div>
            <div className="dropdown dropdown-end">
              <label tabIndex={0} className="btn btn-ghost btn-sm btn-square">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </label>
              <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                <li>
                  <button onClick={() => { (document.activeElement as HTMLElement)?.blur(); handleEditProject(); }}>
                    Edit Project
                  </button>
                </li>
                <li>
                  <button onClick={() => { (document.activeElement as HTMLElement)?.blur(); handleDeleteProject(); }} className="text-error">
                    Delete Project
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="card bg-base-100 shadow-sm mb-6 p-4">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <label className="text-sm text-base-content/70 block mb-1">Mock API URL</label>
              <code className="text-sm font-mono text-base-content block truncate">{endpointBaseUrl}</code>
            </div>
            <CopyButton text={endpointBaseUrl} label="Copy URL" iconOnly className="shrink-0" />
          </div>
        </div>

        {showGettingStarted && endpoints.length > 0 && (
          <div className="alert alert-success mb-6">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Your mock API is ready! Try it out:</p>
              <code className="text-xs font-mono block mt-1 truncate">
                curl {endpointBaseUrl}{endpoints[0].path}
              </code>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CopyButton
                text={`curl ${endpointBaseUrl}${endpoints[0].path}`}
                label="Copy"
                className="btn-sm"
              />
              <button
                onClick={() => {
                  setShowGettingStarted(false);
                  setSearchParams({});
                }}
                className="btn btn-ghost btn-sm btn-square"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {canClaim && (
          <div className="alert mb-6">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium">This is a temporary project</p>
              <p className="text-xs text-base-content/70">Claim it to save it to your account permanently.</p>
            </div>
            <button
              onClick={handleClaimProject}
              disabled={isClaiming}
              className="btn btn-primary btn-sm"
            >
              {isClaiming ? 'Claiming...' : 'Claim Project'}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-base-content">Endpoints</h2>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              Add Endpoint
            </button>
          )}
        </div>

        {showForm && (
          <div className="card bg-base-100 shadow-sm mb-6 p-6">
            <h3 className="text-lg font-medium text-base-content mb-4">Create New Endpoint</h3>
            <EndpointForm
              onSubmit={handleCreateEndpoint}
              onCancel={() => setShowForm(false)}
              isLoading={isCreating}
            />
          </div>
        )}

        {endpointsLoading && endpoints.length === 0 ? (
          <div className="text-center py-12 text-base-content/70">Loading endpoints...</div>
        ) : (
          <EndpointList
            projectId={projectId!}
            endpoints={endpoints}
          />
        )}
      </main>

      <ConfirmDialog
        isOpen={showDeleteProject}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDeleteProject}
        onCancel={() => setShowDeleteProject(false)}
      />
    </div>
  );
}
