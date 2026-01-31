import { Link } from 'react-router-dom';
import type { Endpoint } from '@mockd/shared';
import { EmptyState } from '../common/EmptyState';

interface EndpointListProps {
  projectId: string;
  endpoints: Endpoint[];
  emptyAction?: React.ReactNode;
}

export function EndpointList({ projectId, endpoints, emptyAction }: EndpointListProps) {
  if (endpoints.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
        title="No endpoints yet"
        description="Create an endpoint to define how your mock API responds to requests."
        action={emptyAction}
      />
    );
  }

  return (
    <div className="card bg-base-100 shadow-sm overflow-hidden">
      <div className="divide-y divide-base-200">
        {endpoints.map(endpoint => (
          <Link
            key={endpoint.id}
            to={`/projects/${projectId}/endpoints/${endpoint.id}`}
            className="block px-4 py-3 hover:bg-base-200 transition-colors"
          >
            <span className="text-sm font-mono text-primary">{endpoint.path}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
