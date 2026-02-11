import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuleStore } from '../services/RuleStore';

// --- Mock SqlStorage that tracks mock_rules rows in memory ---

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

    // SELECT all mock_rules for an endpoint
    if (q.includes('select * from mock_rules where endpoint_id = ?')) {
      const endpointId = params[0] as string;
      const matched = [...rows.values()].filter(r => r.endpoint_id === endpointId);
      return { toArray: () => matched as T[] };
    }

    // SELECT mock_rule by id
    if (q.includes('select * from mock_rules where id = ?')) {
      const id = params[0] as string;
      const match = rows.get(id);
      return { toArray: () => (match ? [match] : []) as T[] };
    }

    // INSERT mock_rule
    if (q.includes('insert into mock_rules')) {
      const id = params[0] as string;
      const row: Record<string, string | number | null> = {
        id,
        endpoint_id: params[1] as string,
        priority: params[2] as number,
        name: params[3] as string | null,
        match_method: params[4] as string | null,
        match_path: params[5] as string | null,
        match_headers: params[6] as string | null,
        response_status: params[7] as number,
        response_headers: params[8] as string | null,
        response_body: params[9] as string,
        response_delay_ms: params[10] as number,
        is_active: params[11] as number,
        created_at: params[12] as string,
        updated_at: params[13] as string,
      };
      rows.set(id, row);
      return { toArray: () => [] as T[] };
    }

    // UPDATE mock_rule
    if (q.includes('update mock_rules set')) {
      // The last param is the id (WHERE id = ?)
      const id = params[params.length - 1] as string;
      const row = rows.get(id);
      if (row) {
        const setClause = query.substring(
          query.toLowerCase().indexOf('set ') + 4,
          query.toLowerCase().indexOf(' where ')
        );
        const assignments = setClause.split(',').map(a => a.trim());
        let paramIdx = 0;
        for (const assignment of assignments) {
          const col = assignment.split('=')[0].trim();
          if (assignment.includes('?')) {
            row[col] = params[paramIdx];
            paramIdx++;
          } else if (col === 'updated_at') {
            row[col] = new Date().toISOString();
          }
        }
      }
      return { toArray: () => [] as T[] };
    }

    // DELETE mock_rule
    if (q.includes('delete from mock_rules where id = ?')) {
      const id = params[0] as string;
      rows.delete(id);
      return { toArray: () => [] as T[] };
    }

    return { toArray: () => [] as T[] };
  };

  return { exec, _rows: rows } as unknown as SqlStorage & { _rows: Map<string, Record<string, string | number | null>> };
}

// --- Tests ---

describe('RuleStore', () => {
  let store: RuleStore;
  let sql: ReturnType<typeof createMockSqlStorage>;

  beforeEach(() => {
    sql = createMockSqlStorage();
    store = new RuleStore(sql as unknown as SqlStorage);
  });

  describe('listForEndpoint', () => {
    it('should return empty array initially', () => {
      const rules = store.listForEndpoint('ep_abc123');
      expect(rules).toEqual([]);
    });

    it('should return rules after creation', () => {
      store.create({
        endpointId: 'ep_abc123',
        responseBody: '{"ok": true}',
      });

      const rules = store.listForEndpoint('ep_abc123');
      expect(rules).toHaveLength(1);
      expect(rules[0].endpointId).toBe('ep_abc123');
    });

    it('should only return rules for the specified endpoint', () => {
      store.create({ endpointId: 'ep_abc123', responseBody: '{}' });
      store.create({ endpointId: 'ep_def456', responseBody: '{}' });

      const rules = store.listForEndpoint('ep_abc123');
      expect(rules).toHaveLength(1);
      expect(rules[0].endpointId).toBe('ep_abc123');
    });

    it('should use cache on second call', () => {
      store.create({ endpointId: 'ep_abc123', responseBody: '{}' });

      // First call - populates cache
      const rules1 = store.listForEndpoint('ep_abc123');
      expect(rules1).toHaveLength(1);

      // Spy on sql.exec to verify cache is used
      const execSpy = vi.spyOn(sql, 'exec');

      // Second call - should use cache
      const rules2 = store.listForEndpoint('ep_abc123');
      expect(rules2).toHaveLength(1);
      expect(execSpy).not.toHaveBeenCalled();

      execSpy.mockRestore();
    });

    it('should re-query after cache TTL expires', () => {
      store.create({ endpointId: 'ep_abc123', responseBody: '{}' });

      // First call - populates cache
      store.listForEndpoint('ep_abc123');

      // Advance time past TTL
      const originalDateNow = Date.now;
      Date.now = () => originalDateNow() + 61000; // 61 seconds later

      const execSpy = vi.spyOn(sql, 'exec');

      // Should re-query because cache is expired
      store.listForEndpoint('ep_abc123');
      expect(execSpy).toHaveBeenCalled();

      Date.now = originalDateNow;
      execSpy.mockRestore();
    });
  });

  describe('findById', () => {
    it('should return created rule', () => {
      const created = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{"ok": true}',
      });
      const found = store.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent id', () => {
      const found = store.findById('rul_nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('create', () => {
    it('should return a rule with rul_ prefix ID', () => {
      const rule = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{"ok": true}',
      });

      expect(rule.id).toMatch(/^rul_/);
    });

    it('should use default values when not provided', () => {
      const rule = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{"ok": true}',
      });

      expect(rule.priority).toBe(0);
      expect(rule.name).toBeNull();
      expect(rule.matchMethod).toBeNull();
      expect(rule.matchPath).toBeNull();
      expect(rule.matchHeaders).toBeNull();
      expect(rule.responseStatus).toBe(200);
      expect(rule.responseHeaders).toBeNull();
      expect(rule.responseDelayMs).toBe(0);
      expect(rule.isActive).toBe(true);
    });

    it('should use provided values', () => {
      const rule = store.create({
        endpointId: 'ep_abc123',
        priority: 10,
        name: 'My Rule',
        matchMethod: 'POST',
        matchPath: '/users/:id',
        matchHeaders: { 'X-Custom': 'value' },
        responseStatus: 201,
        responseHeaders: { 'X-Response': 'ok' },
        responseBody: '{"created": true}',
        responseDelayMs: 500,
        isActive: false,
      });

      expect(rule.endpointId).toBe('ep_abc123');
      expect(rule.priority).toBe(10);
      expect(rule.name).toBe('My Rule');
      expect(rule.matchMethod).toBe('POST');
      expect(rule.matchPath).toBe('/users/:id');
      expect(rule.matchHeaders).toEqual({ 'X-Custom': 'value' });
      expect(rule.responseStatus).toBe(201);
      expect(rule.responseHeaders).toEqual({ 'X-Response': 'ok' });
      expect(rule.responseBody).toBe('{"created": true}');
      expect(rule.responseDelayMs).toBe(500);
      expect(rule.isActive).toBe(false);
    });

    it('should invalidate cache for the endpoint', () => {
      // Populate cache
      store.listForEndpoint('ep_abc123');

      // Create rule invalidates cache
      store.create({ endpointId: 'ep_abc123', responseBody: '{}' });

      // Next list should query DB again (not use cache)
      const execSpy = vi.spyOn(sql, 'exec');
      store.listForEndpoint('ep_abc123');
      expect(execSpy).toHaveBeenCalled();

      execSpy.mockRestore();
    });

    it('should set createdAt and updatedAt timestamps', () => {
      const rule = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{}',
      });

      expect(rule.createdAt).toBeTruthy();
      expect(rule.updatedAt).toBeTruthy();
    });
  });

  describe('update', () => {
    it('should return null for non-existent rule', () => {
      const result = store.update('rul_nonexistent', { responseStatus: 404 });
      expect(result).toBeNull();
    });

    it('should update rule fields', () => {
      const created = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{}',
      });

      const updated = store.update(created.id, {
        responseStatus: 201,
        name: 'Updated Rule',
        responseBody: '{"updated": true}',
      });

      expect(updated).not.toBeNull();
      expect(updated!.responseStatus).toBe(201);
      expect(updated!.name).toBe('Updated Rule');
      expect(updated!.responseBody).toBe('{"updated": true}');
    });

    it('should invalidate cache for the endpoint', () => {
      const created = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{}',
      });

      // Populate cache
      store.listForEndpoint('ep_abc123');

      // Update rule invalidates cache
      store.update(created.id, { responseStatus: 201 });

      const execSpy = vi.spyOn(sql, 'exec');
      store.listForEndpoint('ep_abc123');
      expect(execSpy).toHaveBeenCalled();

      execSpy.mockRestore();
    });

    it('should not change fields that are not included in update', () => {
      const created = store.create({
        endpointId: 'ep_abc123',
        name: 'Original Name',
        responseBody: '{"original": true}',
        responseStatus: 200,
      });

      const updated = store.update(created.id, { responseStatus: 201 });

      expect(updated).not.toBeNull();
      expect(updated!.responseStatus).toBe(201);
      expect(updated!.name).toBe('Original Name');
      expect(updated!.responseBody).toBe('{"original": true}');
    });

    it('should handle isActive conversion correctly', () => {
      const created = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{}',
        isActive: true,
      });

      const updated = store.update(created.id, { isActive: false });
      expect(updated).not.toBeNull();
      expect(updated!.isActive).toBe(false);

      const updated2 = store.update(created.id, { isActive: true });
      expect(updated2).not.toBeNull();
      expect(updated2!.isActive).toBe(true);
    });
  });

  describe('delete', () => {
    it('should return endpoint_id on success', () => {
      const created = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{}',
      });

      const result = store.delete(created.id);
      expect(result).toBe('ep_abc123');
    });

    it('should return null for non-existent rule', () => {
      const result = store.delete('rul_nonexistent');
      expect(result).toBeNull();
    });

    it('should remove the rule from the store', () => {
      const created = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{}',
      });

      store.delete(created.id);
      const found = store.findById(created.id);
      expect(found).toBeNull();
    });

    it('should invalidate cache for the endpoint', () => {
      const created = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{}',
      });

      // Populate cache
      store.listForEndpoint('ep_abc123');

      // Delete rule invalidates cache
      store.delete(created.id);

      const execSpy = vi.spyOn(sql, 'exec');
      store.listForEndpoint('ep_abc123');
      expect(execSpy).toHaveBeenCalled();

      execSpy.mockRestore();
    });
  });

  describe('JSON serialization', () => {
    it('should serialize matchHeaders on write and deserialize on read', () => {
      const headers = { 'Content-Type': 'application/json', 'X-Custom': 'value' };
      const created = store.create({
        endpointId: 'ep_abc123',
        matchHeaders: headers,
        responseBody: '{}',
      });

      expect(created.matchHeaders).toEqual(headers);

      // Verify it was stored as JSON string in the DB
      const dbRow = sql._rows.get(created.id);
      expect(dbRow!.match_headers).toBe(JSON.stringify(headers));
    });

    it('should serialize responseHeaders on write and deserialize on read', () => {
      const headers = { 'X-Response': 'ok', 'Cache-Control': 'no-cache' };
      const created = store.create({
        endpointId: 'ep_abc123',
        responseHeaders: headers,
        responseBody: '{}',
      });

      expect(created.responseHeaders).toEqual(headers);

      // Verify it was stored as JSON string in the DB
      const dbRow = sql._rows.get(created.id);
      expect(dbRow!.response_headers).toBe(JSON.stringify(headers));
    });

    it('should handle null matchHeaders and responseHeaders', () => {
      const created = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{}',
      });

      expect(created.matchHeaders).toBeNull();
      expect(created.responseHeaders).toBeNull();

      const dbRow = sql._rows.get(created.id);
      expect(dbRow!.match_headers).toBeNull();
      expect(dbRow!.response_headers).toBeNull();
    });
  });

  describe('is_active conversion', () => {
    it('should store as 1 when isActive is true', () => {
      const created = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{}',
        isActive: true,
      });

      const dbRow = sql._rows.get(created.id);
      expect(dbRow!.is_active).toBe(1);
      expect(created.isActive).toBe(true);
    });

    it('should store as 0 when isActive is false', () => {
      const created = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{}',
        isActive: false,
      });

      const dbRow = sql._rows.get(created.id);
      expect(dbRow!.is_active).toBe(0);
      expect(created.isActive).toBe(false);
    });

    it('should default to 1 when isActive is not provided', () => {
      const created = store.create({
        endpointId: 'ep_abc123',
        responseBody: '{}',
      });

      const dbRow = sql._rows.get(created.id);
      expect(dbRow!.is_active).toBe(1);
      expect(created.isActive).toBe(true);
    });
  });

  describe('invalidateCache', () => {
    it('should allow public cache invalidation', () => {
      // Populate cache
      store.create({ endpointId: 'ep_abc123', responseBody: '{}' });
      store.listForEndpoint('ep_abc123');

      // Publicly invalidate cache
      store.invalidateCache('ep_abc123');

      // Next list should query DB
      const execSpy = vi.spyOn(sql, 'exec');
      store.listForEndpoint('ep_abc123');
      expect(execSpy).toHaveBeenCalled();

      execSpy.mockRestore();
    });
  });
});
