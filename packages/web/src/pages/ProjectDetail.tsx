import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Project, CreateEndpointRequest } from '@mockd/shared';
import { useProjects, useEndpoints } from '../hooks';
import { EndpointList, EndpointForm } from '../components/endpoint';
import { CopyButton } from '../components/common';
import { getMockApiSubdomainUrl } from '../config';

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getProject, updateProject, deleteProject } = useProjects();
  const { endpoints, loading: endpointsLoading, fetchEndpoints, createEndpoint, deleteEndpoint } = useEndpoints();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

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

  const handleDeleteEndpoint = async (endpointId: string) => {
    if (!projectId) return;

    if (window.confirm('Are you sure you want to delete this endpoint?')) {
      await deleteEndpoint(projectId, endpointId);
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

  const handleDeleteProject = async () => {
    if (!projectId || !project) return;

    if (window.confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      await deleteProject(projectId);
      navigate('/');
    }
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-base-content/70 hover:text-base-content">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
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
                  {!project.userId && (
                    <span className="ml-2 text-xs text-amber-600">(anonymous)</span>
                  )}
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
                  <button onClick={handleEditProject}>
                    Edit Project
                  </button>
                </li>
                <li>
                  <button onClick={handleDeleteProject} className="text-error">
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
            onDelete={handleDeleteEndpoint}
          />
        )}
      </main>
    </div>
  );
}
