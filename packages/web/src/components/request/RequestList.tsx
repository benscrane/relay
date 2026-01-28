import type { RequestLog } from '@relay/shared';
import { RequestItem } from './RequestItem';
import type { ConnectionStatus } from '../../hooks/useWebSocket';

interface RequestListProps {
  requests: RequestLog[];
  status: ConnectionStatus;
  onClear: () => void;
}

export function RequestList({ requests, status, onClear }: RequestListProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-800">Request Stream</h3>
          {status === 'connected' && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">Live</span>
            </span>
          )}
        </div>
        <button
          onClick={onClear}
          disabled={requests.length === 0}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>

      <div className="max-h-[600px] overflow-y-auto">
        {requests.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-400">
            <p className="mb-2">No requests yet</p>
            <p className="text-sm">
              Send a request to your endpoint to see it appear here
            </p>
          </div>
        ) : (
          requests.map(request => (
            <RequestItem key={request.id} request={request} />
          ))
        )}
      </div>
    </div>
  );
}
