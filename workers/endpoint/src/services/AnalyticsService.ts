export interface EndpointAnalytics {
  totalRequests: number;
  avgResponseTime: number;
  statusCodes: Record<number, number>;
  methods: Record<string, number>;
  requestsOverTime: { timestamp: string; count: number }[];
  requestsToday: number;
  requestsYesterday: number;
}

export class AnalyticsService {
  constructor(private sql: SqlStorage) {}

  getAnalytics(endpointId: string): EndpointAnalytics {
    // Total request count
    const totalRow = this.sql
      .exec<{ count: number }>(
        'SELECT COUNT(*) as count FROM request_logs WHERE endpoint_id = ?',
        endpointId
      )
      .toArray()[0];
    const totalRequests = totalRow?.count ?? 0;

    // Average response time
    const avgRow = this.sql
      .exec<{ avg_time: number | null }>(
        'SELECT AVG(response_time_ms) as avg_time FROM request_logs WHERE endpoint_id = ? AND response_time_ms IS NOT NULL',
        endpointId
      )
      .toArray()[0];
    const avgResponseTime = avgRow?.avg_time ? Math.round(avgRow.avg_time) : 0;

    // Status code distribution
    const statusRows = this.sql
      .exec<{ response_status: number; count: number }>(
        'SELECT response_status, COUNT(*) as count FROM request_logs WHERE endpoint_id = ? AND response_status IS NOT NULL GROUP BY response_status ORDER BY count DESC',
        endpointId
      )
      .toArray();
    const statusCodes: Record<number, number> = {};
    for (const row of statusRows) {
      statusCodes[row.response_status] = row.count;
    }

    // Method distribution
    const methodRows = this.sql
      .exec<{ method: string; count: number }>(
        'SELECT method, COUNT(*) as count FROM request_logs WHERE endpoint_id = ? GROUP BY method ORDER BY count DESC',
        endpointId
      )
      .toArray();
    const methods: Record<string, number> = {};
    for (const row of methodRows) {
      methods[row.method] = row.count;
    }

    // Requests per hour for last 24 hours
    const requestsOverTime = this.sql
      .exec<{ hour: string; count: number }>(
        `SELECT strftime('%Y-%m-%dT%H:00:00', timestamp) as hour, COUNT(*) as count
           FROM request_logs
           WHERE endpoint_id = ? AND timestamp >= datetime('now', '-24 hours')
           GROUP BY hour ORDER BY hour ASC`,
        endpointId
      )
      .toArray();

    // Requests today vs yesterday for trend
    const todayRow = this.sql
      .exec<{ count: number }>(
        `SELECT COUNT(*) as count FROM request_logs WHERE endpoint_id = ? AND timestamp >= datetime('now', 'start of day')`,
        endpointId
      )
      .toArray()[0];
    const yesterdayRow = this.sql
      .exec<{ count: number }>(
        `SELECT COUNT(*) as count FROM request_logs WHERE endpoint_id = ? AND timestamp >= datetime('now', '-1 day', 'start of day') AND timestamp < datetime('now', 'start of day')`,
        endpointId
      )
      .toArray()[0];

    return {
      totalRequests,
      avgResponseTime,
      statusCodes,
      methods,
      requestsOverTime: requestsOverTime.map(r => ({ timestamp: r.hour, count: r.count })),
      requestsToday: todayRow?.count ?? 0,
      requestsYesterday: yesterdayRow?.count ?? 0,
    };
  }
}
