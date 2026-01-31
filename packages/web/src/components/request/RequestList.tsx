import { useState } from 'react';
import type { RequestLog } from '@mockd/shared';
import { RequestItem } from './RequestItem';
import { ConfirmDialog } from '../common/ConfirmDialog';
import type { ConnectionStatus } from '../../hooks/useWebSocket';

interface RequestListProps {
  requests: RequestLog[];
  status: ConnectionStatus;
  onClear: () => void;
}

export function RequestList({ requests, status, onClear }: RequestListProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearClick = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    onClear();
    setShowClearConfirm(false);
  };

  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="px-4 py-3 border-b border-base-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-base-content">Request Stream</h3>
          {status === 'connected' && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-xs text-base-content/70">Live</span>
            </span>
          )}
        </div>
        <button
          onClick={handleClearClick}
          disabled={requests.length === 0}
          className="btn btn-ghost btn-sm"
        >
          Clear
        </button>
      </div>

      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Request Logs"
        message={`Are you sure you want to clear all ${requests.length} request log${requests.length === 1 ? '' : 's'}? This action cannot be undone.`}
        confirmText="Clear All"
        cancelText="Cancel"
        variant="warning"
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
      />

      <div className="max-h-[600px] overflow-y-auto">
        {status === 'connecting' ? (
          <div className="px-4 py-12 text-center text-base-content/50">
            <span className="loading loading-spinner loading-md mb-2" />
            <p className="text-sm">Connecting to request stream...</p>
          </div>
        ) : status === 'error' || status === 'disconnected' ? (
          <div className="px-4 py-12 text-center text-base-content/50">
            <p className="mb-2 text-warning">Connection lost</p>
            <p className="text-sm">Attempting to reconnect...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="px-4 py-12 text-center text-base-content/50">
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
