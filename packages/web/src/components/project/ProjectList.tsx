import { useState, useMemo } from 'react';
import type { Project } from '@mockd/shared';
import { ProjectCard } from './ProjectCard';
import { EmptyState } from '../common/EmptyState';

interface ProjectListProps {
  projects: Project[];
  endpointCounts?: Record<string, number>;
}

export function ProjectList({ projects, endpointCounts = {} }: ProjectListProps) {
  const [search, setSearch] = useState('');

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      p => p.name.toLowerCase().includes(q) || p.subdomain.toLowerCase().includes(q)
    );
  }, [projects, search]);

  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects yet"
        description="Create your first project to start capturing and mocking HTTP requests."
      />
    );
  }

  return (
    <div>
      {projects.length > 3 && (
        <div className="mb-4">
          <div className="relative max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="input input-bordered input-sm w-full pl-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {filteredProjects.length === 0 ? (
        <div className="text-center py-8 text-base-content/50">
          <p>No projects matching &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch('')} className="btn btn-ghost btn-sm mt-2">Clear search</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              endpointCount={endpointCounts[project.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
