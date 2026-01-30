import { Link } from 'react-router-dom';
import type { Project } from '@mockd/shared';

interface ProjectCardProps {
  project: Project;
  endpointCount?: number;
}

export function ProjectCard({ project, endpointCount = 0 }: ProjectCardProps) {
  const isAnonymous = !project.userId;

  return (
    <div className="bg-base-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <Link to={`/projects/${project.id}`} className="block p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-base-content truncate">
              {isAnonymous ? 'Anonymous' : project.name}
            </h3>
            <p className="text-sm text-neutral-content mt-1">
              <code className="text-xs bg-neutral px-1.5 py-0.5 rounded-sm">
                {project.subdomain}
              </code>
              {isAnonymous && (
                <span className="ml-2 text-xs text-amber-600">(anonymous)</span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-base-content/70">
            {endpointCount} {endpointCount === 1 ? 'endpoint' : 'endpoints'}
          </span>
          <span className="text-base-content/70 text-xs">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
      </Link>
    </div>
  );
}
