import type { Project } from '@relay/shared';
import { ProjectCard } from './ProjectCard';
import { EmptyState } from '../common/EmptyState';

interface ProjectListProps {
  projects: Project[];
  endpointCounts?: Record<string, number>;
  onDelete?: (projectId: string) => void;
  emptyAction?: React.ReactNode;
}

export function ProjectList({ projects, endpointCounts = {}, onDelete, emptyAction }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        }
        title="No projects yet"
        description="Create your first project to start capturing and mocking HTTP requests."
        action={emptyAction}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map(project => (
        <ProjectCard
          key={project.id}
          project={project}
          endpointCount={endpointCounts[project.id]}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
