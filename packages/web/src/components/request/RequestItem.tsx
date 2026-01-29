import { useState } from 'react';
import type { RequestLog } from '@mockd/shared';
import { MethodBadge } from '../common/MethodBadge';
import { RequestDetails } from './RequestDetails';

interface RequestItemProps {
  request: RequestLog;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }

  return date.toLocaleDateString();
}

export function RequestItem({ request }: RequestItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-base-200 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-4 hover:bg-base-200 transition-colors text-left"
      >
        <span className="text-base-content/50 text-sm">
          {expanded ? '▼' : '▶'}
        </span>
        <MethodBadge method={request.method} />
        <span className="flex-1 font-mono text-sm text-base-content truncate">
          {request.path}
        </span>
        {(request.matched_rule_name || request.matched_rule_id) && (
          <span className="badge badge-secondary">
            {request.matched_rule_name || 'Rule'}
          </span>
        )}
        <span className="text-xs text-base-content/50">
          {formatTimestamp(request.timestamp)}
        </span>
      </button>
      {expanded && <RequestDetails request={request} />}
    </div>
  );
}
