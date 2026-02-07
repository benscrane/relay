import type { EndpointAnalytics } from '../../hooks';
import type { RequestLog } from '@mockd/shared';

interface AnalyticsDashboardProps {
  analytics: EndpointAnalytics | null;
  loading: boolean;
  /** Live requests from WebSocket for real-time count update */
  liveRequests: RequestLog[];
  onRefresh: () => void;
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'bg-success';
  if (status >= 300 && status < 400) return 'bg-warning';
  if (status >= 400 && status < 500) return 'bg-error';
  if (status >= 500) return 'bg-error/70';
  return 'bg-base-300';
}

function getStatusLabel(status: number): string {
  if (status >= 200 && status < 300) return 'Success';
  if (status >= 300 && status < 400) return 'Redirect';
  if (status >= 400 && status < 500) return 'Client Error';
  if (status >= 500) return 'Server Error';
  return 'Unknown';
}

function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'bg-success',
    POST: 'bg-info',
    PUT: 'bg-warning',
    PATCH: 'bg-warning',
    DELETE: 'bg-error',
    HEAD: 'bg-secondary',
    OPTIONS: 'bg-base-300',
  };
  return colors[method] || 'bg-base-300';
}

function TrendArrow({ today, yesterday }: { today: number; yesterday: number }) {
  if (yesterday === 0 && today === 0) return <span className="text-base-content/50 text-xs">No data</span>;
  if (yesterday === 0) return <span className="text-success text-xs">New today</span>;

  const pctChange = Math.round(((today - yesterday) / yesterday) * 100);
  if (pctChange === 0) return <span className="text-base-content/50 text-xs">Same as yesterday</span>;

  return (
    <span className={`text-xs ${pctChange > 0 ? 'text-success' : 'text-error'}`}>
      {pctChange > 0 ? '+' : ''}{pctChange}% vs yesterday
    </span>
  );
}

function BarChart({ data }: { data: Array<{ timestamp: string; count: number }> }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-base-content/50 text-sm">
        No request data in the last 24 hours
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="flex items-end gap-px h-24">
      {data.map((d, i) => {
        const height = Math.max((d.count / maxCount) * 100, 2);
        const hour = new Date(d.timestamp).getHours();
        const isNow = i === data.length - 1;
        return (
          <div
            key={d.timestamp}
            className="group relative flex-1 flex flex-col items-center justify-end"
          >
            <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
              <div className="bg-base-300 text-base-content text-xs rounded px-2 py-1 whitespace-nowrap shadow">
                {hour}:00 — {d.count} req
              </div>
            </div>
            <div
              className={`w-full rounded-t transition-all ${isNow ? 'bg-primary' : 'bg-primary/40'} hover:bg-primary/70`}
              style={{ height: `${height}%`, minHeight: '2px' }}
            />
          </div>
        );
      })}
    </div>
  );
}

function DistributionBar({ items, getColor }: {
  items: Array<{ label: string; count: number; key: string | number }>;
  getColor: (key: string | number) => string;
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex rounded-full overflow-hidden h-3">
        {items.map(item => {
          const pct = (item.count / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={item.key}
              className={`${getColor(item.key)} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${item.label}: ${item.count} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map(item => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div key={item.key} className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${getColor(item.key)}`} />
              <span className="text-base-content/70">{item.label}</span>
              <span className="font-medium">{item.count}</span>
              <span className="text-base-content/40">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AnalyticsDashboard({ analytics, loading, liveRequests, onRefresh }: AnalyticsDashboardProps) {
  if (loading && !analytics) {
    return (
      <div className="card bg-base-100 shadow-sm mb-6 p-6">
        <div className="flex items-center gap-2 text-base-content/50">
          <span className="loading loading-spinner loading-xs" />
          Loading analytics...
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const liveTotal = analytics.totalRequests + liveRequests.length;

  const statusItems = Object.entries(analytics.statusCodes)
    .sort(([, a], [, b]) => b - a)
    .map(([status, count]) => ({
      key: Number(status),
      label: `${status} ${getStatusLabel(Number(status))}`,
      count,
    }));

  const methodItems = Object.entries(analytics.methods)
    .sort(([, a], [, b]) => b - a)
    .map(([method, count]) => ({
      key: method,
      label: method,
      count,
    }));

  return (
    <div className="card bg-base-100 shadow-sm mb-6">
      <div className="p-4 border-b border-base-200 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-base-content">Analytics</h2>
        <button
          onClick={onRefresh}
          className="btn btn-ghost btn-xs"
          disabled={loading}
          title="Refresh analytics"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 divide-x divide-base-200 border-b border-base-200">
        <div className="p-4 text-center">
          <div className="text-2xl font-bold text-base-content">{liveTotal.toLocaleString()}</div>
          <div className="text-xs text-base-content/60 mt-0.5">Total Requests</div>
          <TrendArrow today={analytics.requestsToday} yesterday={analytics.requestsYesterday} />
        </div>
        <div className="p-4 text-center">
          <div className="text-2xl font-bold text-base-content">{analytics.avgResponseTime}<span className="text-sm font-normal text-base-content/60">ms</span></div>
          <div className="text-xs text-base-content/60 mt-0.5">Avg Response</div>
        </div>
        <div className="p-4 text-center">
          <div className="text-2xl font-bold text-base-content">{Object.keys(analytics.methods).length}</div>
          <div className="text-xs text-base-content/60 mt-0.5">Methods Used</div>
        </div>
      </div>

      {/* Requests over time */}
      <div className="p-4 border-b border-base-200">
        <div className="text-xs text-base-content/60 mb-2">Requests (last 24h)</div>
        <BarChart data={analytics.requestsOverTime} />
      </div>

      {/* Status code distribution */}
      {statusItems.length > 0 && (
        <div className="p-4 border-b border-base-200">
          <div className="text-xs text-base-content/60 mb-2">Status Codes</div>
          <DistributionBar
            items={statusItems}
            getColor={(key) => getStatusColor(key as number)}
          />
        </div>
      )}

      {/* Method distribution */}
      {methodItems.length > 0 && (
        <div className="p-4">
          <div className="text-xs text-base-content/60 mb-2">Methods</div>
          <DistributionBar
            items={methodItems}
            getColor={(key) => getMethodColor(key as string)}
          />
        </div>
      )}
    </div>
  );
}
