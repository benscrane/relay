import { Link } from 'react-router-dom';
import type { Endpoint } from '@relay/shared';
import { MethodBadge } from '../common/MethodBadge';
import { EmptyState } from '../common/EmptyState';

interface EndpointListProps {
  projectId: string;
  endpoints: Endpoint[];
  onDelete?: (endpointId: string) => void;
  emptyAction?: React.ReactNode;
}

export function EndpointList({ projectId, endpoints, onDelete, emptyAction }: EndpointListProps) {
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
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Method
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Path
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Delay
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {endpoints.map(endpoint => (
            <tr key={endpoint.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap">
                <MethodBadge method={endpoint.method} />
              </td>
              <td className="px-4 py-3">
                <Link
                  to={`/projects/${projectId}/endpoints/${endpoint.id}`}
                  className="text-sm font-mono text-blue-600 hover:text-blue-800"
                >
                  {endpoint.path}
                </Link>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {endpoint.statusCode}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {endpoint.delay > 0 ? `${endpoint.delay}ms` : '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                <Link
                  to={`/projects/${projectId}/endpoints/${endpoint.id}`}
                  className="text-blue-600 hover:text-blue-800 mr-3"
                >
                  View
                </Link>
                {onDelete && (
                  <button
                    onClick={() => onDelete(endpoint.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
