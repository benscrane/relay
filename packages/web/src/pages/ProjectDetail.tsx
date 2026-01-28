import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Project, CreateEndpointRequest } from '@relay/shared';
import { useProjects, useEndpoints } from '../hooks';
import { EndpointList, EndpointForm } from '../components/endpoint';
import { CopyButton } from '../components/common';
import { getMockApiUrl, getProjectDoName } from '../config';

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getProject, deleteProject } = useProjects();
  const { endpoints, loading: endpointsLoading, fetchEndpoints, createEndpoint, deleteEndpoint } = useEndpoints();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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

  const handleDeleteProject = async () => {
    if (!projectId || !project) return;

    if (window.confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      await deleteProject(projectId);
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading project...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Project not found'}</p>
          <Link to="/" className="text-blue-600 hover:text-blue-800">Back to Home</Link>
        </div>
      </div>
    );
  }

  const endpointBaseUrl = getMockApiUrl(getProjectDoName(project));

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500">
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded-sm">{project.subdomain}</code>
                  {!project.userId && (
                    <span className="ml-2 text-xs text-amber-600">(anonymous)</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleDeleteProject}
              className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-sm"
            >
              Delete Project
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-gray-500 block mb-1">Mock API URL</label>
              <code className="text-sm font-mono text-gray-800">{endpointBaseUrl}</code>
            </div>
            <CopyButton text={endpointBaseUrl} label="Copy URL" />
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Endpoints</h2>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add Endpoint
            </button>
          )}
        </div>

        {showForm && (
          <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Endpoint</h3>
            <EndpointForm
              onSubmit={handleCreateEndpoint}
              onCancel={() => setShowForm(false)}
              isLoading={isCreating}
            />
          </div>
        )}

        {endpointsLoading && endpoints.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Loading endpoints...</div>
        ) : (
          <EndpointList
            projectId={projectId!}
            endpoints={endpoints}
            onDelete={handleDeleteEndpoint}
            emptyAction={
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Endpoint
              </button>
            }
          />
        )}
      </main>
    </div>
  );
}
