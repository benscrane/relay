import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Project, Endpoint } from '@relay/shared';
import { useProjects, useEndpoints, useWebSocket } from '../hooks';
import { RequestList } from '../components/request';
import { RulesPanel } from '../components/rules';
import { CopyButton, MethodBadge } from '../components/common';
import { getMockApiUrl, getProjectDoName } from '../config';

export function EndpointDetail() {
  const { projectId, endpointId } = useParams<{ projectId: string; endpointId: string }>();
  const { getProject } = useProjects();
  const { endpoints, fetchEndpoints } = useEndpoints();

  const [project, setProject] = useState<Project | null>(null);
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get the DO name for WebSocket connection (subdomain for user-owned, id for anonymous)
  const doName = useMemo(() => project ? getProjectDoName(project) : undefined, [project]);

  // Connect to WebSocket with project's DO name (reconnects when doName/endpointId changes)
  const { status, requests, clearRequests } = useWebSocket({
    subdomain: doName,
    endpointId: endpointId,
  });

  useEffect(() => {
    if (!projectId || !endpointId) return;

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
        setError(err instanceof Error ? err.message : 'Failed to load endpoint');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, endpointId, getProject, fetchEndpoints]);

  // Find the endpoint from the fetched list
  useEffect(() => {
    if (endpointId && endpoints.length > 0) {
      const found = endpoints.find(e => e.id === endpointId);
      setEndpoint(found || null);
    }
  }, [endpointId, endpoints]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading endpoint...</div>
      </div>
    );
  }

  if (error || !project || !endpoint) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Endpoint not found'}</p>
          <Link to={projectId ? `/projects/${projectId}` : '/'} className="text-blue-600 hover:text-blue-800">
            Back to Project
          </Link>
        </div>
      </div>
    );
  }

  const endpointUrl = getMockApiUrl(getProjectDoName(project)) + endpoint.path;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to={`/projects/${projectId}`} className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <MethodBadge method={endpoint.method} />
              <div>
                <h1 className="text-xl font-bold text-gray-900 font-mono">{endpoint.path}</h1>
                <p className="text-sm text-gray-500">{project.name}</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {status === 'connected' && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-gray-500">Live</span>
                </span>
              )}
              {status === 'connecting' && (
                <span className="text-xs text-gray-500">Connecting...</span>
              )}
              {status === 'disconnected' && (
                <span className="text-xs text-red-500">Disconnected</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-gray-500 block mb-1">Endpoint URL</label>
              <code className="text-sm font-mono text-gray-800">{endpointUrl}</code>
            </div>
            <CopyButton text={endpointUrl} label="Copy URL" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <div>
              <span className="text-xs text-gray-500">Status Code</span>
              <p className="text-sm font-medium">{endpoint.statusCode}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Delay</span>
              <p className="text-sm font-medium">{endpoint.delay > 0 ? `${endpoint.delay}ms` : 'None'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <RequestList
              requests={requests}
              status={status}
              onClear={clearRequests}
            />
          </div>

          <div>
            <RulesPanel
              projectId={projectId!}
              endpointId={endpointId!}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
