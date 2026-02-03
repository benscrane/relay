import { Link } from 'react-router-dom';
import type { Project } from '@mockd/shared';

interface ProjectCardProps {
  project: Project;
  endpointCount?: number;
}

export function ProjectCard({ project, endpointCount = 0 }: ProjectCardProps) {
  const isAnonymous = !project.userId;

  return (
    <div className="bg-base-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <Link to={`/projects/${project.id}`} className="block p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-base-content truncate">
              {isAnonymous ? 'Temp Mock' : project.name}
            </h3>
            <p className="text-sm text-neutral-content mt-1">
              <code className="text-xs bg-neutral px-1.5 py-0.5 rounded-sm">
                {project.subdomain}
              </code>
            </p>
          </div>
        </div>

        <div className="mt-4 text-sm">
          <span className="text-base-content/70">
            {endpointCount} {endpointCount === 1 ? 'endpoint' : 'endpoints'}
          </span>
        </div>
      </Link>
    </div>
  );
}
