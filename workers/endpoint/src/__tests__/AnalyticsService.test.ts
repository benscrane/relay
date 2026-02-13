import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsService } from '../services/AnalyticsService';

// --- Mock SqlStorage that returns canned responses for analytics queries ---

interface MockCursor<T> {
  toArray(): T[];
}

interface QueryResponse {
  pattern: RegExp;
  result: unknown[];
}

function createMockSqlStorage(responses: QueryResponse[] = []) {
  const calls: { query: string; params: (string | number | null)[] }[] = [];

  const exec = <T = Record<string, string | number | null>>(
    query: string,
    ...params: (string | number | null)[]
  ): MockCursor<T> => {
    calls.push({ query, params });

    for (const resp of responses) {
      if (resp.pattern.test(query)) {
        return { toArray: () => resp.result as T[] };
      }
    }

    return { toArray: () => [] as T[] };
  };

  return { exec, _calls: calls } as unknown as SqlStorage & {
    _calls: { query: string; params: (string | number | null)[] }[];
  };
}

// --- Tests ---

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let sql: ReturnType<typeof createMockSqlStorage>;

  describe('getAnalytics with populated data', () => {
    beforeEach(() => {
      sql = createMockSqlStorage([
        // Total request count (must NOT match the today/yesterday queries that include timestamp)
        {
          pattern: /^SELECT COUNT\(\*\) as count FROM request_logs WHERE endpoint_id = \?$/,
          result: [{ count: 150 }],
        },
        // Average response time
        {
          pattern: /SELECT AVG\(response_time_ms\) as avg_time/,
          result: [{ avg_time: 42.7 }],
        },
        // Status code distribution
        {
          pattern: /SELECT response_status, COUNT\(\*\) as count/,
          result: [
            { response_status: 200, count: 100 },
            { response_status: 404, count: 30 },
            { response_status: 500, count: 20 },
          ],
        },
        // Method distribution
        {
          pattern: /SELECT method, COUNT\(\*\) as count/,
          result: [
            { method: 'GET', count: 80 },
            { method: 'POST', count: 50 },
            { method: 'DELETE', count: 20 },
          ],
        },
        // Requests over time
        {
          pattern: /strftime/,
          result: [
            { hour: '2025-01-15T10:00:00', count: 5 },
            { hour: '2025-01-15T11:00:00', count: 12 },
            { hour: '2025-01-15T12:00:00', count: 8 },
          ],
        },
        // Today count (has 'start of day' but NOT '-1 day')
        {
          pattern: /^SELECT COUNT\(\*\) as count FROM request_logs WHERE endpoint_id = \? AND timestamp >= datetime\('now', 'start of day'\)$/,
          result: [{ count: 25 }],
        },
        // Yesterday count
        {
          pattern: /datetime\('now', '-1 day', 'start of day'\)/,
          result: [{ count: 18 }],
        },
      ]);
      service = new AnalyticsService(sql as unknown as SqlStorage);
    });

    it('should return correct totalRequests', () => {
      const result = service.getAnalytics('ep_test123');
      expect(result.totalRequests).toBe(150);
    });

    it('should return avgResponseTime rounded to integer', () => {
      const result = service.getAnalytics('ep_test123');
      expect(result.avgResponseTime).toBe(43);
    });

    it('should return statusCodes as Record<number, number>', () => {
      const result = service.getAnalytics('ep_test123');
      expect(result.statusCodes).toEqual({
        200: 100,
        404: 30,
        500: 20,
      });
    });

    it('should return methods as Record<string, number>', () => {
      const result = service.getAnalytics('ep_test123');
      expect(result.methods).toEqual({
        GET: 80,
        POST: 50,
        DELETE: 20,
      });
    });

    it('should return requestsOverTime mapped as { timestamp, count }[]', () => {
      const result = service.getAnalytics('ep_test123');
      expect(result.requestsOverTime).toEqual([
        { timestamp: '2025-01-15T10:00:00', count: 5 },
        { timestamp: '2025-01-15T11:00:00', count: 12 },
        { timestamp: '2025-01-15T12:00:00', count: 8 },
      ]);
    });

    it('should return requestsToday and requestsYesterday', () => {
      const result = service.getAnalytics('ep_test123');
      expect(result.requestsToday).toBe(25);
      expect(result.requestsYesterday).toBe(18);
    });

    it('should pass endpointId to all queries', () => {
      service.getAnalytics('ep_test123');
      // All 7 SQL calls should have received the endpointId
      expect(sql._calls).toHaveLength(7);
      for (const call of sql._calls) {
        expect(call.params[0]).toBe('ep_test123');
      }
    });
  });

  describe('getAnalytics with zero/empty results', () => {
    beforeEach(() => {
      // All queries return empty arrays (no matching responses)
      sql = createMockSqlStorage([]);
      service = new AnalyticsService(sql as unknown as SqlStorage);
    });

    it('should default totalRequests to 0 when no rows returned', () => {
      const result = service.getAnalytics('ep_empty');
      expect(result.totalRequests).toBe(0);
    });

    it('should default avgResponseTime to 0 when no rows returned', () => {
      const result = service.getAnalytics('ep_empty');
      expect(result.avgResponseTime).toBe(0);
    });

    it('should return empty statusCodes when no rows', () => {
      const result = service.getAnalytics('ep_empty');
      expect(result.statusCodes).toEqual({});
    });

    it('should return empty methods when no rows', () => {
      const result = service.getAnalytics('ep_empty');
      expect(result.methods).toEqual({});
    });

    it('should return empty requestsOverTime when no rows', () => {
      const result = service.getAnalytics('ep_empty');
      expect(result.requestsOverTime).toEqual([]);
    });

    it('should default requestsToday to 0 when no rows', () => {
      const result = service.getAnalytics('ep_empty');
      expect(result.requestsToday).toBe(0);
    });

    it('should default requestsYesterday to 0 when no rows', () => {
      const result = service.getAnalytics('ep_empty');
      expect(result.requestsYesterday).toBe(0);
    });
  });

  describe('getAnalytics with null avg_time', () => {
    beforeEach(() => {
      sql = createMockSqlStorage([
        {
          pattern: /SELECT COUNT\(\*\) as count FROM request_logs WHERE endpoint_id = \?/,
          result: [{ count: 5 }],
        },
        {
          pattern: /SELECT AVG\(response_time_ms\) as avg_time/,
          result: [{ avg_time: null }],
        },
        {
          pattern: /SELECT response_status, COUNT\(\*\) as count/,
          result: [],
        },
        {
          pattern: /SELECT method, COUNT\(\*\) as count/,
          result: [],
        },
        {
          pattern: /strftime/,
          result: [],
        },
        {
          pattern: /timestamp >= datetime\('now', 'start of day'\)$/,
          result: [{ count: 0 }],
        },
        {
          pattern: /datetime\('now', '-1 day', 'start of day'\)/,
          result: [{ count: 0 }],
        },
      ]);
      service = new AnalyticsService(sql as unknown as SqlStorage);
    });

    it('should return 0 when avg_time is null', () => {
      const result = service.getAnalytics('ep_null_avg');
      expect(result.avgResponseTime).toBe(0);
    });
  });

  describe('getAnalytics rounds avgResponseTime correctly', () => {
    it('should round 42.3 down to 42', () => {
      sql = createMockSqlStorage([
        {
          pattern: /SELECT COUNT\(\*\) as count FROM request_logs WHERE endpoint_id = \?/,
          result: [{ count: 10 }],
        },
        {
          pattern: /SELECT AVG\(response_time_ms\) as avg_time/,
          result: [{ avg_time: 42.3 }],
        },
        { pattern: /SELECT response_status/, result: [] },
        { pattern: /SELECT method/, result: [] },
        { pattern: /strftime/, result: [] },
        { pattern: /timestamp >= datetime\('now', 'start of day'\)$/, result: [{ count: 0 }] },
        { pattern: /datetime\('now', '-1 day', 'start of day'\)/, result: [{ count: 0 }] },
      ]);
      service = new AnalyticsService(sql as unknown as SqlStorage);

      const result = service.getAnalytics('ep_round');
      expect(result.avgResponseTime).toBe(42);
    });

    it('should round 42.5 up to 43', () => {
      sql = createMockSqlStorage([
        {
          pattern: /SELECT COUNT\(\*\) as count FROM request_logs WHERE endpoint_id = \?/,
          result: [{ count: 10 }],
        },
        {
          pattern: /SELECT AVG\(response_time_ms\) as avg_time/,
          result: [{ avg_time: 42.5 }],
        },
        { pattern: /SELECT response_status/, result: [] },
        { pattern: /SELECT method/, result: [] },
        { pattern: /strftime/, result: [] },
        { pattern: /timestamp >= datetime\('now', 'start of day'\)$/, result: [{ count: 0 }] },
        { pattern: /datetime\('now', '-1 day', 'start of day'\)/, result: [{ count: 0 }] },
      ]);
      service = new AnalyticsService(sql as unknown as SqlStorage);

      const result = service.getAnalytics('ep_round');
      expect(result.avgResponseTime).toBe(43);
    });

    it('should round 99.9 up to 100', () => {
      sql = createMockSqlStorage([
        {
          pattern: /SELECT COUNT\(\*\) as count FROM request_logs WHERE endpoint_id = \?/,
          result: [{ count: 10 }],
        },
        {
          pattern: /SELECT AVG\(response_time_ms\) as avg_time/,
          result: [{ avg_time: 99.9 }],
        },
        { pattern: /SELECT response_status/, result: [] },
        { pattern: /SELECT method/, result: [] },
        { pattern: /strftime/, result: [] },
        { pattern: /timestamp >= datetime\('now', 'start of day'\)$/, result: [{ count: 0 }] },
        { pattern: /datetime\('now', '-1 day', 'start of day'\)/, result: [{ count: 0 }] },
      ]);
      service = new AnalyticsService(sql as unknown as SqlStorage);

      const result = service.getAnalytics('ep_round');
      expect(result.avgResponseTime).toBe(100);
    });

    it('should handle avg_time of 0 (falsy but valid)', () => {
      sql = createMockSqlStorage([
        {
          pattern: /SELECT COUNT\(\*\) as count FROM request_logs WHERE endpoint_id = \?/,
          result: [{ count: 10 }],
        },
        {
          pattern: /SELECT AVG\(response_time_ms\) as avg_time/,
          result: [{ avg_time: 0 }],
        },
        { pattern: /SELECT response_status/, result: [] },
        { pattern: /SELECT method/, result: [] },
        { pattern: /strftime/, result: [] },
        { pattern: /timestamp >= datetime\('now', 'start of day'\)$/, result: [{ count: 0 }] },
        { pattern: /datetime\('now', '-1 day', 'start of day'\)/, result: [{ count: 0 }] },
      ]);
      service = new AnalyticsService(sql as unknown as SqlStorage);

      const result = service.getAnalytics('ep_round');
      // Note: The original code uses `avgRow?.avg_time ? Math.round(avgRow.avg_time) : 0`
      // which means 0 is falsy and will return 0 (same result either way)
      expect(result.avgResponseTime).toBe(0);
    });
  });

  describe('SQL query correctness', () => {
    beforeEach(() => {
      sql = createMockSqlStorage([]);
      service = new AnalyticsService(sql as unknown as SqlStorage);
    });

    it('should execute exactly 7 SQL queries', () => {
      service.getAnalytics('ep_test');
      expect(sql._calls).toHaveLength(7);
    });

    it('should use correct SQL for total request count', () => {
      service.getAnalytics('ep_test');
      expect(sql._calls[0].query).toBe(
        'SELECT COUNT(*) as count FROM request_logs WHERE endpoint_id = ?'
      );
    });

    it('should use correct SQL for average response time', () => {
      service.getAnalytics('ep_test');
      expect(sql._calls[1].query).toBe(
        'SELECT AVG(response_time_ms) as avg_time FROM request_logs WHERE endpoint_id = ? AND response_time_ms IS NOT NULL'
      );
    });

    it('should use correct SQL for status code distribution', () => {
      service.getAnalytics('ep_test');
      expect(sql._calls[2].query).toBe(
        'SELECT response_status, COUNT(*) as count FROM request_logs WHERE endpoint_id = ? AND response_status IS NOT NULL GROUP BY response_status ORDER BY count DESC'
      );
    });

    it('should use correct SQL for method distribution', () => {
      service.getAnalytics('ep_test');
      expect(sql._calls[3].query).toBe(
        'SELECT method, COUNT(*) as count FROM request_logs WHERE endpoint_id = ? GROUP BY method ORDER BY count DESC'
      );
    });

    it('should use correct SQL for requests over time', () => {
      service.getAnalytics('ep_test');
      const query = sql._calls[4].query;
      expect(query).toContain("strftime('%Y-%m-%dT%H:00:00', timestamp) as hour");
      expect(query).toContain("timestamp >= datetime('now', '-24 hours')");
      expect(query).toContain('GROUP BY hour ORDER BY hour ASC');
    });

    it('should use correct SQL for today count', () => {
      service.getAnalytics('ep_test');
      const query = sql._calls[5].query;
      expect(query).toContain("timestamp >= datetime('now', 'start of day')");
      expect(query).not.toContain('-1 day');
    });

    it('should use correct SQL for yesterday count', () => {
      service.getAnalytics('ep_test');
      const query = sql._calls[6].query;
      expect(query).toContain("timestamp >= datetime('now', '-1 day', 'start of day')");
      expect(query).toContain("timestamp < datetime('now', 'start of day')");
    });
  });
});
