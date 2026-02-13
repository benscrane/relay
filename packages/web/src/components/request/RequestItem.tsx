import { useState, useCallback } from 'react';
import type { RequestLog } from '@mockd/shared';
import toast from 'react-hot-toast';
import { MethodBadge } from '../common/MethodBadge';
import { StatusBadge } from '../common/StatusBadge';
import { RequestDetails } from './RequestDetails';
import type { ReplayState } from '../../hooks/useRequestReplay';

interface RequestItemProps {
  request: RequestLog;
  mockBaseUrl?: string;
  replayState?: ReplayState;
  onReplay?: (request: RequestLog) => void;
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

function buildFullCurlCommand(request: RequestLog, mockBaseUrl: string): string {
  const parts = [`curl -X ${request.method}`];

  try {
    const headers = JSON.parse(request.headers || '{}');
    for (const [key, value] of Object.entries(headers)) {
      const lower = key.toLowerCase();
      if (lower === 'host' || lower === 'content-length' || lower.startsWith('cf-')) continue;
      parts.push(`-H '${key}: ${value}'`);
    }
  } catch {
    // skip malformed headers
  }

  if (request.body && request.body !== 'null') {
    try {
      const parsed = JSON.parse(request.body);
      parts.push(`-d '${JSON.stringify(parsed)}'`);
    } catch {
      parts.push(`-d '${request.body}'`);
    }
  }

  parts.push(`'${mockBaseUrl}${request.path}'`);
  return parts.join(' \\\n  ');
}

export function RequestItem({ request, mockBaseUrl, replayState, onReplay }: RequestItemProps) {
  const [expanded, setExpanded] = useState(false);

  const handleReplay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onReplay?.(request);
  }, [onReplay, request]);

  const handleCopyCurl = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!mockBaseUrl) return;
    try {
      await navigator.clipboard.writeText(buildFullCurlCommand(request, mockBaseUrl));
      toast.success('cURL command copied');
    } catch {
      toast.error('Copy failed. Try using HTTPS.');
    }
  }, [request, mockBaseUrl]);

  const isReplaying = replayState?.isReplaying ?? false;
  const replayResponse = replayState?.response ?? null;
  const replayError = replayState?.error ?? null;
  const hasReplayResult = replayResponse !== null || replayError !== null;

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
        <StatusBadge status={request.response_status} />
        <span className="flex-1 font-mono text-sm text-base-content truncate">
          {request.path}
        </span>
        {(request.matched_rule_name || request.matched_rule_id) && (
          <span className="badge badge-secondary">
            {request.matched_rule_name || 'Rule'}
          </span>
        )}
        {request.response_time_ms !== null && (
          <span className="text-xs text-base-content/50 font-mono">
            {request.response_time_ms}ms
          </span>
        )}

        {/* Action buttons */}
        {mockBaseUrl && (
          <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={handleReplay}
              disabled={isReplaying}
              className="btn btn-ghost btn-xs"
              title="Replay request"
            >
              {isReplaying ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
            <button
              onClick={handleCopyCurl}
              className="btn btn-ghost btn-xs"
              title="Copy as cURL"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </span>
        )}

        <span className="text-xs text-base-content/50">
          {formatTimestamp(request.timestamp)}
        </span>
      </button>

      {/* Replay result inline */}
      {hasReplayResult && (
        <div className="px-4 pb-3">
          {replayError ? (
            <div className="bg-error/10 border border-error/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-error text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Replay failed
              </div>
              <p className="text-xs text-error/80 mt-1">{replayError}</p>
            </div>
          ) : replayResponse ? (
            <div className="bg-base-200 border border-base-300 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-base-content/70">Replay Response</span>
                <StatusBadge status={replayResponse.status} />
                <span className="text-xs text-base-content/50 font-mono">
                  {replayResponse.duration}ms
                </span>
              </div>
              {replayResponse.body && (
                <pre className="bg-base-100 p-2 rounded text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(replayResponse.body), null, 2);
                    } catch {
                      return replayResponse.body;
                    }
                  })()}
                </pre>
              )}
            </div>
          ) : null}
        </div>
      )}

      {expanded && <RequestDetails request={request} mockBaseUrl={mockBaseUrl} />}
    </div>
  );
}
