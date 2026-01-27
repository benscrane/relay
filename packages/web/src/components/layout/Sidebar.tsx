import { Link, useLocation } from 'react-router-dom';
import type { Project, Endpoint } from '@relay/shared';
import { MethodBadge } from '../common/MethodBadge';

interface SidebarProps {
  projects?: Project[];
  endpoints?: Endpoint[];
  currentProjectId?: string;
  currentEndpointId?: string;
}

export function Sidebar({ projects = [], endpoints = [], currentProjectId, currentEndpointId }: SidebarProps) {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
      <div className="mb-6">
        <Link to="/" className="text-lg font-bold text-gray-900 hover:text-blue-600">
          Relay
        </Link>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Projects
        </h2>
        {projects.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No projects yet</p>
        ) : (
          <nav className="space-y-1">
            {projects.map(project => {
              const isActive = project.id === currentProjectId;
              const projectEndpoints = endpoints.filter(e => e.projectId === project.id);

              return (
                <div key={project.id}>
                  <Link
                    to={`/projects/${project.id}`}
                    className={`block px-3 py-2 text-sm rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="truncate">{project.name}</div>
                    <div className="text-xs text-gray-500 truncate">{project.subdomain}</div>
                  </Link>

                  {isActive && projectEndpoints.length > 0 && (
                    <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 pl-3">
                      {projectEndpoints.map(endpoint => (
                        <Link
                          key={endpoint.id}
                          to={`/projects/${project.id}/endpoints/${endpoint.id}`}
                          className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors ${
                            endpoint.id === currentEndpointId
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <MethodBadge method={endpoint.method} size="sm" />
                          <span className="truncate font-mono">{endpoint.path}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </div>

      {!isHomePage && (
        <div className="pt-4 border-t border-gray-200">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Project
          </Link>
        </div>
      )}
    </aside>
  );
}
