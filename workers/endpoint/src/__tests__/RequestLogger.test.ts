import { describe, it, expect, beforeEach } from 'vitest';
import { RequestLogger } from '../services/RequestLogger';
import type { RequestLog } from '@mockd/shared/types/websocket';

// --- Mock SqlStorage that tracks request_logs rows in memory ---

interface MockCursor<T> {
  toArray(): T[];
}

function createMockSqlStorage() {
  const rows: Map<string, Record<string, string | number | null>> = new Map();

  const exec = <T = Record<string, string | number | null>>(
    query: string,
    ...params: (string | number | null)[]
  ): MockCursor<T> => {
    const q = query.toLowerCase().trim();

    // Schema-related queries are no-ops in tests
    if (q.startsWith('pragma') || q.startsWith('create') || q.startsWith('alter') || q.startsWith('drop')) {
      return { toArray: () => [] as T[] };
    }

    // INSERT into request_logs
    if (q.includes('insert into request_logs')) {
      const id = params[0] as string;
      const row: Record<string, string | number | null> = {
        id,
        endpoint_id: params[1] as string,
        method: params[2] as string,
        path: params[3] as string,
        headers: params[4] as string,
        body: params[5] as string | null,
        timestamp: params[6] as string,
        matched_rule_id: params[7] as string | null,
        matched_rule_name: params[8] as string | null,
        path_params: params[9] as string | null,
        response_status: params[10] as number | null,
        response_time_ms: params[11] as number | null,
      };
      rows.set(id, row);
      return { toArray: () => [] as T[] };
    }

    // SELECT * FROM request_logs (with optional WHERE and ORDER BY/LIMIT)
    if (q.includes('select * from request_logs')) {
      let matched = [...rows.values()];

      if (q.includes('where endpoint_id = ?')) {
        const endpointId = params[0] as string;
        matched = matched.filter(r => r.endpoint_id === endpointId);
      }

      // Sort by timestamp DESC
      matched.sort((a, b) => {
        const ta = a.timestamp as string;
        const tb = b.timestamp as string;
        return tb.localeCompare(ta);
      });

      // Apply LIMIT
      if (q.includes('limit ?')) {
        const limitParam = params[params.length - 1] as number;
        matched = matched.slice(0, limitParam);
      }

      return { toArray: () => matched as T[] };
    }

    // DELETE FROM request_logs WHERE endpoint_id = ?
    if (q.includes('delete from request_logs') && q.includes('where endpoint_id = ?')) {
      const endpointId = params[0] as string;
      for (const [id, row] of rows) {
        if (row.endpoint_id === endpointId) {
          rows.delete(id);
        }
      }
      return { toArray: () => [] as T[] };
    }

    // DELETE FROM request_logs (all)
    if (q.includes('delete from request_logs')) {
      rows.clear();
      return { toArray: () => [] as T[] };
    }

    return { toArray: () => [] as T[] };
  };

  return { exec, _rows: rows } as unknown as SqlStorage & { _rows: Map<string, Record<string, string | number | null>> };
}

// --- Tests ---

describe('RequestLogger', () => {
  let logger: RequestLogger;
  let sql: ReturnType<typeof createMockSqlStorage>;

  beforeEach(() => {
    sql = createMockSqlStorage();
    logger = new RequestLogger(sql as unknown as SqlStorage);
  });

  describe('log', () => {
    it('should create entry with req_ prefix ID and return RequestLog', () => {
      const result = logger.log({
        endpointId: 'ep_abc123',
        method: 'GET',
        path: '/test',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: null,
        matchedRuleId: null,
        matchedRuleName: null,
        pathParams: null,
        responseStatus: 200,
        responseTimeMs: 42,
      });

      expect(result.id).toMatch(/^req_/);
      expect(result.endpoint_id).toBe('ep_abc123');
      expect(result.method).toBe('GET');
      expect(result.path).toBe('/test');
      expect(result.body).toBeNull();
      expect(result.matched_rule_id).toBeNull();
      expect(result.matched_rule_name).toBeNull();
      expect(result.path_params).toBeNull();
      expect(result.response_status).toBe(200);
      expect(result.response_time_ms).toBe(42);
      expect(result.timestamp).toBeTruthy();
    });

    it('should filter out Cloudflare headers from the stored headers JSON', () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'cf-connecting-ip': '1.2.3.4',
        'cf-ray': 'abc123',
        'x-forwarded-for': '1.2.3.4',
        'cdn-loop': 'cloudflare',
        'x-custom-header': 'keep-me',
      });

      const result = logger.log({
        endpointId: 'ep_abc123',
        method: 'POST',
        path: '/test',
        headers,
        body: '{"data": true}',
        matchedRuleId: null,
        matchedRuleName: null,
        pathParams: null,
        responseStatus: 200,
        responseTimeMs: 10,
      });

      const parsedHeaders = JSON.parse(result.headers);
      expect(parsedHeaders['content-type']).toBe('application/json');
      expect(parsedHeaders['x-custom-header']).toBe('keep-me');
      expect(parsedHeaders['cf-connecting-ip']).toBeUndefined();
      expect(parsedHeaders['cf-ray']).toBeUndefined();
      expect(parsedHeaders['x-forwarded-for']).toBeUndefined();
      expect(parsedHeaders['cdn-loop']).toBeUndefined();
    });

    it('should keep non-Cloudflare headers', () => {
      const headers = new Headers({
        'content-type': 'text/plain',
        'authorization': 'Bearer token123',
        'accept': 'application/json',
        'x-request-id': 'req-456',
      });

      const result = logger.log({
        endpointId: 'ep_abc123',
        method: 'GET',
        path: '/test',
        headers,
        body: null,
        matchedRuleId: null,
        matchedRuleName: null,
        pathParams: null,
        responseStatus: 200,
        responseTimeMs: 5,
      });

      const parsedHeaders = JSON.parse(result.headers);
      expect(parsedHeaders['content-type']).toBe('text/plain');
      expect(parsedHeaders['authorization']).toBe('Bearer token123');
      expect(parsedHeaders['accept']).toBe('application/json');
      expect(parsedHeaders['x-request-id']).toBe('req-456');
    });

    it('should serialize pathParams correctly - non-empty becomes JSON', () => {
      const result = logger.log({
        endpointId: 'ep_abc123',
        method: 'GET',
        path: '/users/42',
        headers: new Headers(),
        body: null,
        matchedRuleId: 'rul_xyz',
        matchedRuleName: 'User Rule',
        pathParams: { id: '42' },
        responseStatus: 200,
        responseTimeMs: 15,
      });

      expect(result.path_params).toBe(JSON.stringify({ id: '42' }));
    });

    it('should serialize pathParams correctly - empty object becomes null', () => {
      const result = logger.log({
        endpointId: 'ep_abc123',
        method: 'GET',
        path: '/test',
        headers: new Headers(),
        body: null,
        matchedRuleId: null,
        matchedRuleName: null,
        pathParams: {},
        responseStatus: 200,
        responseTimeMs: 5,
      });

      expect(result.path_params).toBeNull();
    });

    it('should serialize pathParams correctly - null stays null', () => {
      const result = logger.log({
        endpointId: 'ep_abc123',
        method: 'GET',
        path: '/test',
        headers: new Headers(),
        body: null,
        matchedRuleId: null,
        matchedRuleName: null,
        pathParams: null,
        responseStatus: 200,
        responseTimeMs: 5,
      });

      expect(result.path_params).toBeNull();
    });

    it('should store the log entry in the database', () => {
      const result = logger.log({
        endpointId: 'ep_abc123',
        method: 'GET',
        path: '/test',
        headers: new Headers(),
        body: null,
        matchedRuleId: null,
        matchedRuleName: null,
        pathParams: null,
        responseStatus: 200,
        responseTimeMs: 10,
      });

      expect(sql._rows.has(result.id)).toBe(true);
      const dbRow = sql._rows.get(result.id)!;
      expect(dbRow.endpoint_id).toBe('ep_abc123');
      expect(dbRow.method).toBe('GET');
    });
  });

  describe('query', () => {
    function createLog(endpointId: string, method: string, timestampOffset: number) {
      // Use a controlled timestamp so ordering is predictable
      const ts = new Date(Date.now() + timestampOffset * 1000).toISOString();
      const id = `req_${Math.random().toString(36).slice(2, 10)}`;
      sql._rows.set(id, {
        id,
        endpoint_id: endpointId,
        method,
        path: '/test',
        headers: '{}',
        body: null,
        timestamp: ts,
        matched_rule_id: null,
        matched_rule_name: null,
        path_params: null,
        response_status: 200,
        response_time_ms: 10,
      });
      return { id, timestamp: ts };
    }

    it('should return all logs when no filter', () => {
      createLog('ep_abc123', 'GET', 0);
      createLog('ep_abc123', 'POST', 1);
      createLog('ep_def456', 'GET', 2);

      const logs = logger.query();
      expect(logs).toHaveLength(3);
    });

    it('should filter by endpointId', () => {
      createLog('ep_abc123', 'GET', 0);
      createLog('ep_abc123', 'POST', 1);
      createLog('ep_def456', 'GET', 2);

      const logs = logger.query({ endpointId: 'ep_abc123' });
      expect(logs).toHaveLength(2);
      expect(logs.every(l => l.endpoint_id === 'ep_abc123')).toBe(true);
    });

    it('should respect limit parameter', () => {
      createLog('ep_abc123', 'GET', 0);
      createLog('ep_abc123', 'POST', 1);
      createLog('ep_abc123', 'PUT', 2);
      createLog('ep_abc123', 'DELETE', 3);

      const logs = logger.query({ limit: 2 });
      expect(logs).toHaveLength(2);
    });

    it('should order by timestamp DESC', () => {
      const first = createLog('ep_abc123', 'GET', 0);
      const second = createLog('ep_abc123', 'POST', 1);
      const third = createLog('ep_abc123', 'PUT', 2);

      const logs = logger.query();
      expect(logs[0].timestamp >= logs[1].timestamp).toBe(true);
      expect(logs[1].timestamp >= logs[2].timestamp).toBe(true);
    });

    it('should default limit to 100', () => {
      // Create 105 logs
      for (let i = 0; i < 105; i++) {
        createLog('ep_abc123', 'GET', i);
      }

      const logs = logger.query();
      expect(logs).toHaveLength(100);
    });

    it('should combine endpointId and limit', () => {
      createLog('ep_abc123', 'GET', 0);
      createLog('ep_abc123', 'POST', 1);
      createLog('ep_abc123', 'PUT', 2);
      createLog('ep_def456', 'GET', 3);

      const logs = logger.query({ endpointId: 'ep_abc123', limit: 2 });
      expect(logs).toHaveLength(2);
      expect(logs.every(l => l.endpoint_id === 'ep_abc123')).toBe(true);
    });
  });

  describe('clear', () => {
    function createLog(endpointId: string) {
      const id = `req_${Math.random().toString(36).slice(2, 10)}`;
      sql._rows.set(id, {
        id,
        endpoint_id: endpointId,
        method: 'GET',
        path: '/test',
        headers: '{}',
        body: null,
        timestamp: new Date().toISOString(),
        matched_rule_id: null,
        matched_rule_name: null,
        path_params: null,
        response_status: 200,
        response_time_ms: 10,
      });
    }

    it('should delete all logs when no endpointId specified', () => {
      createLog('ep_abc123');
      createLog('ep_def456');
      createLog('ep_ghi789');

      expect(sql._rows.size).toBe(3);

      logger.clear();

      expect(sql._rows.size).toBe(0);
    });

    it('should delete only matching logs when endpointId specified', () => {
      createLog('ep_abc123');
      createLog('ep_abc123');
      createLog('ep_def456');

      expect(sql._rows.size).toBe(3);

      logger.clear('ep_abc123');

      expect(sql._rows.size).toBe(1);
      const remaining = [...sql._rows.values()];
      expect(remaining[0].endpoint_id).toBe('ep_def456');
    });
  });
});
