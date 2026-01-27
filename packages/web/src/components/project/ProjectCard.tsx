import { Link } from 'react-router-dom';
import type { Project } from '@relay/shared';

interface ProjectCardProps {
  project: Project;
  endpointCount?: number;
  onDelete?: (projectId: string) => void;
}

export function ProjectCard({ project, endpointCount = 0, onDelete }: ProjectCardProps) {
  const isAnonymous = !project.userId;

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <Link to={`/projects/${project.id}`} className="block p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {project.name}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                {project.subdomain}
              </code>
              {isAnonymous && (
                <span className="ml-2 text-xs text-amber-600">(anonymous)</span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {endpointCount} {endpointCount === 1 ? 'endpoint' : 'endpoints'}
          </span>
          <span className="text-gray-400 text-xs">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
      </Link>

      {onDelete && (
        <div className="border-t border-gray-100 px-4 py-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete(project.id);
            }}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
