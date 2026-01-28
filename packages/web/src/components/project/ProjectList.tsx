import type { Project } from '@relay/shared';
import { ProjectCard } from './ProjectCard';
import { EmptyState } from '../common/EmptyState';

interface ProjectListProps {
  projects: Project[];
  endpointCounts?: Record<string, number>;
  onDelete?: (projectId: string) => void;
}

export function ProjectList({ projects, endpointCounts = {}, onDelete }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects yet"
        description="Create your first project to start capturing and mocking HTTP requests."
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
