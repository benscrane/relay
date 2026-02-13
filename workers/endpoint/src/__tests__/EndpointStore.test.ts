import { describe, it, expect, beforeEach } from 'vitest';
import { TIER_LIMITS } from '@mockd/shared/constants';
import { EndpointStore } from '../services/EndpointStore';
import type { DbEndpoint } from '../services/EndpointStore';

// --- Mock SqlStorage that tracks rows in memory ---

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

    // SELECT all endpoints ordered by created_at DESC
    if (q.includes('select * from endpoints') && q.includes('order by created_at desc')) {
      const sorted = [...rows.values()].sort(
        (a, b) => (b.created_at as string).localeCompare(a.created_at as string)
      );
      return { toArray: () => sorted as T[] };
    }

    // SELECT all endpoints ordered by created_at ASC
    if (q.includes('select * from endpoints') && q.includes('order by created_at asc')) {
      const sorted = [...rows.values()].sort(
        (a, b) => (a.created_at as string).localeCompare(b.created_at as string)
      );
      return { toArray: () => sorted as T[] };
    }

    // SELECT endpoint by path
    if (q.includes('select * from endpoints where path = ?')) {
      const path = params[0] as string;
      const match = [...rows.values()].find(r => r.path === path);
      return { toArray: () => (match ? [match] : []) as T[] };
    }

    // SELECT endpoint by id
    if (q.includes('select * from endpoints where id = ?')) {
      const id = params[0] as string;
      const match = rows.get(id);
      return { toArray: () => (match ? [match] : []) as T[] };
    }

    // INSERT endpoint
    if (q.includes('insert into endpoints')) {
      const id = params[0] as string;
      const row: Record<string, string | number | null> = {
        id,
        path: params[1] as string,
        content_type: params[2] as string,
        response_body: params[3] as string,
        status_code: params[4] as number,
        delay_ms: params[5] as number,
        rate_limit: params[6] as number,
        created_at: params[7] as string,
        updated_at: params[8] as string,
      };
      rows.set(id, row);
      return { toArray: () => [] as T[] };
    }

    // UPDATE endpoint
    if (q.includes('update endpoints set')) {
      // The last param is the id (WHERE id = ?)
      const id = params[params.length - 1] as string;
      const row = rows.get(id);
      if (row) {
        // Parse SET clause to apply updates
        // Extract column assignments from the query
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
            // datetime('now') - simulate with ISO string
            row[col] = new Date().toISOString();
          }
        }
      }
      return { toArray: () => [] as T[] };
    }

    // DELETE endpoint
    if (q.includes('delete from endpoints where id = ?')) {
      const id = params[0] as string;
      rows.delete(id);
      return { toArray: () => [] as T[] };
    }

    return { toArray: () => [] as T[] };
  };

  return { exec, _rows: rows } as unknown as SqlStorage & { _rows: Map<string, Record<string, string | number | null>> };
}

// --- Tests ---

describe('EndpointStore', () => {
  let store: EndpointStore;
  let sql: ReturnType<typeof createMockSqlStorage>;

  beforeEach(() => {
    sql = createMockSqlStorage();
    store = new EndpointStore(sql as unknown as SqlStorage);
  });

  describe('list', () => {
    it('should return empty array initially', () => {
      const endpoints = store.list();
      expect(endpoints).toEqual([]);
    });

    it('should return endpoints after creation', () => {
      store.create({ path: '/api/users' });
      store.create({ path: '/api/posts' });

      const endpoints = store.list();
      expect(endpoints).toHaveLength(2);
    });

    it('should include projectId in response when provided', () => {
      store.create({ path: '/api/users' });
      const endpoints = store.list('prj_abc123');

      expect(endpoints[0].projectId).toBe('prj_abc123');
    });
  });

  describe('create', () => {
    it('should return an endpoint with ep_ prefix ID', () => {
      const endpoint = store.create({ path: '/api/users' });

      expect(endpoint).not.toBeNull();
      expect(endpoint!.id).toMatch(/^ep_/);
    });

    it('should return null for duplicate path', () => {
      store.create({ path: '/api/users' });
      const duplicate = store.create({ path: '/api/users' });

      expect(duplicate).toBeNull();
    });

    it('should use default values when not provided', () => {
      const endpoint = store.create({ path: '/api/users' });

      expect(endpoint).not.toBeNull();
      expect(endpoint!.contentType).toBe('application/json');
      expect(endpoint!.responseBody).toBe('{}');
      expect(endpoint!.statusCode).toBe(200);
      expect(endpoint!.delay).toBe(0);
      expect(endpoint!.rateLimit).toBe(TIER_LIMITS.free.defaultEndpointRateLimit);
    });

    it('should use provided values', () => {
      const endpoint = store.create({
        path: '/api/users',
        content_type: 'text/plain',
        response_body: '"hello"',
        status_code: 201,
        delay_ms: 500,
        rate_limit: 10,
      });

      expect(endpoint).not.toBeNull();
      expect(endpoint!.contentType).toBe('text/plain');
      expect(endpoint!.responseBody).toBe('"hello"');
      expect(endpoint!.statusCode).toBe(201);
      expect(endpoint!.delay).toBe(500);
      expect(endpoint!.rateLimit).toBe(10);
    });

    it('should set createdAt and updatedAt timestamps', () => {
      const endpoint = store.create({ path: '/api/users' });

      expect(endpoint).not.toBeNull();
      expect(endpoint!.createdAt).toBeTruthy();
      expect(endpoint!.updatedAt).toBeTruthy();
    });
  });

  describe('findById', () => {
    it('should return created endpoint', () => {
      const created = store.create({ path: '/api/users' })!;
      const found = store.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.path).toBe('/api/users');
    });

    it('should return null for non-existent id', () => {
      const found = store.findById('ep_nonexistent');
      expect(found).toBeNull();
    });

    it('should include projectId when provided', () => {
      const created = store.create({ path: '/api/users' })!;
      const found = store.findById(created.id, 'prj_abc123');

      expect(found).not.toBeNull();
      expect(found!.projectId).toBe('prj_abc123');
    });
  });

  describe('findByPath', () => {
    it('should return endpoint for existing path', () => {
      store.create({ path: '/api/users' });
      const found = store.findByPath('/api/users');

      expect(found).not.toBeNull();
      expect(found!.path).toBe('/api/users');
    });

    it('should return null for non-existent path', () => {
      const found = store.findByPath('/api/nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update endpoint fields', () => {
      const created = store.create({ path: '/api/users' })!;
      const updated = store.update(created.id, {
        status_code: 201,
        response_body: '{"updated": true}',
      });

      expect(updated).not.toBeNull();
      expect(updated!.statusCode).toBe(201);
      expect(updated!.responseBody).toBe('{"updated": true}');
    });

    it('should return null for non-existent id', () => {
      const result = store.update('ep_nonexistent', { status_code: 404 });
      expect(result).toBeNull();
    });

    it('should include projectId when provided', () => {
      const created = store.create({ path: '/api/users' })!;
      const updated = store.update(created.id, { status_code: 201 }, 'prj_abc123');

      expect(updated).not.toBeNull();
      expect(updated!.projectId).toBe('prj_abc123');
    });

    it('should not change fields that are not included in update', () => {
      const created = store.create({
        path: '/api/users',
        status_code: 200,
        delay_ms: 500,
      })!;

      const updated = store.update(created.id, { status_code: 201 });

      expect(updated).not.toBeNull();
      expect(updated!.statusCode).toBe(201);
      expect(updated!.delay).toBe(500);
    });
  });

  describe('delete', () => {
    it('should remove the endpoint', () => {
      const created = store.create({ path: '/api/users' })!;
      store.delete(created.id);

      const found = store.findById(created.id);
      expect(found).toBeNull();
    });

    it('should not throw for non-existent id', () => {
      expect(() => store.delete('ep_nonexistent')).not.toThrow();
    });
  });

  describe('listForMatching', () => {
    it('should return empty array initially', () => {
      const endpoints = store.listForMatching();
      expect(endpoints).toEqual([]);
    });

    it('should return raw DbEndpoint rows', () => {
      store.create({ path: '/api/users' });
      const endpoints = store.listForMatching();

      expect(endpoints).toHaveLength(1);
      // DbEndpoint has snake_case fields (not camelCase like ApiEndpoint)
      expect(endpoints[0].path).toBe('/api/users');
      expect(endpoints[0].status_code).toBe(200);
      expect(endpoints[0].delay_ms).toBe(0);
      expect(endpoints[0].content_type).toBe('application/json');
    });

    it('should be sorted by created_at ASC', () => {
      store.create({ path: '/api/first' });
      store.create({ path: '/api/second' });
      const endpoints = store.listForMatching();

      expect(endpoints).toHaveLength(2);
      // First created should come first (ASC order)
      expect(endpoints[0].path).toBe('/api/first');
      expect(endpoints[1].path).toBe('/api/second');
    });
  });
});
