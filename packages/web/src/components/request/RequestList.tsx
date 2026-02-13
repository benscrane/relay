import { useState, useMemo, useCallback } from 'react';
import type { RequestLog } from '@mockd/shared';
import { isFormUrlEncoded, getContentTypeFromHeaders, parseFormBody } from '@mockd/shared/utils';
import { RequestItem } from './RequestItem';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { CopyButton } from '../common/CopyButton';
import type { ConnectionStatus } from '../../hooks/useWebSocket';
import { useRequestReplay } from '../../hooks/useRequestReplay';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
const STATUS_CATEGORIES = [
  { label: '2xx Success', min: 200, max: 299 },
  { label: '3xx Redirect', min: 300, max: 399 },
  { label: '4xx Client Error', min: 400, max: 499 },
  { label: '5xx Server Error', min: 500, max: 599 },
] as const;

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 16);
}

function parseBodyForExport(body: string | null, headers: Record<string, string>): unknown {
  if (!body) return null;
  const contentType = getContentTypeFromHeaders(headers);
  if (isFormUrlEncoded(contentType)) {
    return parseFormBody(body);
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function exportToJson(requests: RequestLog[], filename: string): void {
  const data = requests.map(req => {
    const headers = JSON.parse(req.headers || '{}');
    return {
      id: req.id,
      method: req.method,
      path: req.path,
      headers,
      body: parseBodyForExport(req.body, headers),
      timestamp: req.timestamp,
      responseStatus: req.response_status,
      responseTimeMs: req.response_time_ms,
      matchedRuleId: req.matched_rule_id,
      matchedRuleName: req.matched_rule_name,
      pathParams: req.path_params ? JSON.parse(req.path_params) : null,
    };
  });

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportToCsv(requests: RequestLog[], filename: string): void {
  const headers = ['ID', 'Timestamp', 'Method', 'Path', 'Status', 'Response Time (ms)', 'Matched Rule', 'Headers', 'Body'];
  const rows = requests.map(req => [
    req.id,
    req.timestamp,
    req.method,
    req.path,
    req.response_status?.toString() || '',
    req.response_time_ms?.toString() || '',
    req.matched_rule_name || req.matched_rule_id || '',
    req.headers || '',
    req.body || '',
  ]);

  const escapeCsv = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCsv).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface RequestListProps {
  requests: RequestLog[];
  status: ConnectionStatus;
  onClear: () => void;
  endpointUrl?: string;
  mockBaseUrl?: string;
}

export function RequestList({ requests, status, onClear, endpointUrl, mockBaseUrl }: RequestListProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { replay, getReplayState } = useRequestReplay();

  const handleReplay = useCallback((request: RequestLog) => {
    if (mockBaseUrl) {
      replay(request, mockBaseUrl);
    }
  }, [replay, mockBaseUrl]);
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Method filter
      if (methodFilter && req.method.toUpperCase() !== methodFilter) {
        return false;
      }

      // Status filter
      if (statusFilter && req.response_status !== null) {
        const category = STATUS_CATEGORIES.find(c => c.label === statusFilter);
        if (category && (req.response_status < category.min || req.response_status > category.max)) {
          return false;
        }
      }

      // Text search filter (searches in path, headers, and body)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const pathMatch = req.path.toLowerCase().includes(query);
        const headersMatch = req.headers?.toLowerCase().includes(query);
        const bodyMatch = req.body?.toLowerCase().includes(query);
        if (!pathMatch && !headersMatch && !bodyMatch) {
          return false;
        }
      }

      // Date range filter
      if (startDate) {
        const reqDate = new Date(req.timestamp);
        const filterStart = new Date(startDate);
        if (reqDate < filterStart) {
          return false;
        }
      }

      if (endDate) {
        const reqDate = new Date(req.timestamp);
        const filterEnd = new Date(endDate);
        if (reqDate > filterEnd) {
          return false;
        }
      }

      return true;
    });
  }, [requests, methodFilter, statusFilter, searchQuery, startDate, endDate]);

  const hasActiveFilters = methodFilter || statusFilter || searchQuery || startDate || endDate;

  const clearFilters = useCallback(() => {
    setMethodFilter('');
    setStatusFilter('');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
  }, []);

  const handleExportJson = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    exportToJson(filteredRequests, `request-logs-${timestamp}.json`);
  }, [filteredRequests]);

  const handleExportCsv = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    exportToCsv(filteredRequests, `request-logs-${timestamp}.csv`);
  }, [filteredRequests]);

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
      {/* Header with title and basic controls */}
      <div className="px-4 py-3 border-b border-base-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-base-content">Request Stream</h3>
            {status === 'connected' && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-xs text-base-content/70">Live</span>
              </span>
            )}
            {hasActiveFilters && (
              <span className="badge badge-primary badge-sm">
                {filteredRequests.length}/{requests.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn btn-ghost btn-sm ${showFilters ? 'btn-active' : ''}`}
              title="Toggle filters"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            <div className="dropdown dropdown-end">
              <button
                tabIndex={0}
                disabled={filteredRequests.length === 0}
                className="btn btn-ghost btn-sm"
                title="Export logs"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-40">
                <li>
                  <button onClick={handleExportJson}>
                    Export JSON
                  </button>
                </li>
                <li>
                  <button onClick={handleExportCsv}>
                    Export CSV
                  </button>
                </li>
              </ul>
            </div>
            <button
              onClick={handleClearClick}
              disabled={requests.length === 0}
              className="btn btn-ghost btn-sm"
              title="Clear all logs"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search bar - always visible */}
        <div className="mt-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in path, headers, or body..."
              className="input input-bordered input-sm w-full pl-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Advanced filters panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-base-200 rounded-lg space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs">Method</span>
                </label>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="select select-bordered select-sm"
                >
                  <option value="">All Methods</option>
                  {HTTP_METHODS.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs">Status</span>
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select select-bordered select-sm"
                >
                  <option value="">All Status</option>
                  {STATUS_CATEGORIES.map(cat => (
                    <option key={cat.label} value={cat.label}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs">From</span>
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input input-bordered input-sm"
                />
              </div>
              <div className="form-control">
                <label className="label py-0">
                  <span className="label-text text-xs">To</span>
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input input-bordered input-sm"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex justify-end">
                <button
                  onClick={clearFilters}
                  className="btn btn-ghost btn-xs"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
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
        ) : filteredRequests.length === 0 ? (
          <div className="px-4 py-12 text-center text-base-content/50">
            {requests.length === 0 ? (
              <>
                <p className="mb-2">No requests yet</p>
                {endpointUrl ? (
                  <div className="max-w-md mx-auto">
                    <p className="text-sm mb-3">Try sending your first request:</p>
                    <div className="bg-base-200 rounded-lg p-3 text-left">
                      <code className="text-xs font-mono text-base-content block whitespace-pre-wrap break-all">
                        {`curl ${endpointUrl}`}
                      </code>
                    </div>
                    <div className="mt-2">
                      <CopyButton text={`curl ${endpointUrl}`} label="Copy command" />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm">
                    Send a request to your endpoint to see it appear here
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mb-2">No matching requests</p>
                <p className="text-sm">
                  Try adjusting your filters ({requests.length} request{requests.length === 1 ? '' : 's'} hidden)
                </p>
                <button
                  onClick={clearFilters}
                  className="btn btn-sm btn-ghost mt-2"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          filteredRequests.map(request => (
            <RequestItem
              key={request.id}
              request={request}
              mockBaseUrl={mockBaseUrl}
              replayState={getReplayState(request.id)}
              onReplay={handleReplay}
            />
          ))
        )}
      </div>
    </div>
  );
}
