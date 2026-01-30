import type { Env } from '../index';

// Mock data storage
export type MockDataStore = {
  users: Map<string, DbUser>;
  sessions: Map<string, DbSession>;
  projects: Map<string, DbProject>;
};

interface DbUser {
  id: string;
  email: string;
  password_hash: string | null;
  tier: string;
  created_at: string;
  updated_at: string;
  stripe_customer_id: string | null;
}

interface DbSession {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

interface DbProject {
  id: string;
  user_id: string | null;
  name: string;
  subdomain: string;
  created_at: string;
  updated_at: string;
}

export function createMockDataStore(): MockDataStore {
  return {
    users: new Map(),
    sessions: new Map(),
    projects: new Map(),
  };
}

// Mock D1 Database
export function createMockD1(store: MockDataStore): D1Database {
  return {
    prepare: (query: string) => createMockStatement(query, store),
    dump: () => Promise.resolve(new ArrayBuffer(0)),
    batch: () => Promise.resolve([]),
    exec: () => Promise.resolve({ count: 0, duration: 0 }),
    withSession: () => {
      throw new Error('withSession not implemented in mock');
    },
  } as unknown as D1Database;
}

function createMockStatement(query: string, store: MockDataStore): D1PreparedStatement {
  let boundValues: unknown[] = [];

  const statement = {
    bind: (...values: unknown[]) => {
      boundValues = values;
      return statement;
    },
    first: async <T>(): Promise<T | null> => {
      const q = query.toLowerCase();

      // SELECT user by ID
      if (q.includes('select * from users where id =')) {
        const userId = boundValues[0] as string;
        return (store.users.get(userId) as T) || null;
      }

      // SELECT user by email
      if (q.includes('select * from users where email =')) {
        const email = boundValues[0] as string;
        for (const user of store.users.values()) {
          if (user.email === email) return user as T;
        }
        return null;
      }

      // SELECT session by ID (with expiry check)
      if (q.includes('select * from sessions where id =') && q.includes('expires_at')) {
        const sessionId = boundValues[0] as string;
        const session = store.sessions.get(sessionId);
        if (session && new Date(session.expires_at) > new Date()) {
          return session as T;
        }
        return null;
      }

      // SELECT project by ID
      if (q.includes('select * from projects where id =')) {
        const projectId = boundValues[0] as string;
        return (store.projects.get(projectId) as T) || null;
      }

      // COUNT projects by user_id
      if (q.includes('select count(*) as count from projects where user_id =')) {
        const userId = boundValues[0] as string;
        let count = 0;
        for (const project of store.projects.values()) {
          if (project.user_id === userId) {
            count++;
          }
        }
        return { count } as T;
      }

      // Check if user exists (for registration)
      if (q.includes('select id from users where email =')) {
        const email = boundValues[0] as string;
        for (const user of store.users.values()) {
          if (user.email === email) return { id: user.id } as T;
        }
        return null;
      }

      return null;
    },
    all: async <T>(): Promise<D1Result<T>> => {
      const q = query.toLowerCase();

      // SELECT projects by user_id
      if (q.includes('select * from projects where user_id =')) {
        const userId = boundValues[0] as string;
        const results: DbProject[] = [];
        for (const project of store.projects.values()) {
          if (project.user_id === userId) {
            results.push(project);
          }
        }
        return { results: results as T[], success: true, meta: {} as D1Result<T>['meta'] };
      }

      return { results: [], success: true, meta: {} as D1Result<T>['meta'] };
    },
    run: async () => {
      const q = query.toLowerCase();

      // INSERT user
      if (q.includes('insert into users')) {
        const [id, email, passwordHash, tier, createdAt, updatedAt] = boundValues as string[];
        store.users.set(id, {
          id,
          email,
          password_hash: passwordHash,
          tier,
          created_at: createdAt,
          updated_at: updatedAt,
          stripe_customer_id: null,
        });
      }

      // INSERT session
      if (q.includes('insert into sessions')) {
        const [id, userId, expiresAt, createdAt] = boundValues as string[];
        store.sessions.set(id, {
          id,
          user_id: userId,
          expires_at: expiresAt,
          created_at: createdAt,
        });
      }

      // INSERT project
      if (q.includes('insert into projects')) {
        // Handle both authenticated and anonymous project creation
        const hasNullUserId = q.includes('null,');
        let id: string, userId: string | null, name: string, subdomain: string, createdAt: string, updatedAt: string;

        if (hasNullUserId) {
          // Anonymous: (id, NULL, name, subdomain, created_at, updated_at)
          [id, name, subdomain, createdAt, updatedAt] = boundValues as string[];
          userId = null;
        } else {
          // Authenticated: (id, user_id, name, subdomain, created_at, updated_at)
          [id, userId, name, subdomain, createdAt, updatedAt] = boundValues as string[];
        }

        // Check for unique subdomain constraint
        for (const project of store.projects.values()) {
          if (project.subdomain === subdomain) {
            const error = new Error('UNIQUE constraint failed: projects.subdomain');
            throw error;
          }
        }

        store.projects.set(id, {
          id,
          user_id: userId,
          name,
          subdomain,
          created_at: createdAt,
          updated_at: updatedAt,
        });
      }

      // DELETE session
      if (q.includes('delete from sessions where id =')) {
        const sessionId = boundValues[0] as string;
        store.sessions.delete(sessionId);
      }

      // DELETE project
      if (q.includes('delete from projects where id =')) {
        const projectId = boundValues[0] as string;
        store.projects.delete(projectId);
      }

      return { success: true, meta: {} as D1Result<unknown>['meta'], results: [] };
    },
    raw: async () => [] as unknown[],
  } as unknown as D1PreparedStatement;

  return statement;
}

// Mock Durable Object
export function createMockDurableObject(): DurableObjectNamespace {
  const endpoints = new Map<string, { id: string; path: string; response_body: string; status_code: number; delay_ms: number }>();
  const rules = new Map<string, Record<string, unknown>>();
  let endpointCounter = 0;
  let ruleCounter = 0;

  const mockStub = {
    fetch: async (request: Request) => {
      const url = new URL(request.url);
      const path = url.pathname;

      // GET endpoints
      if (path === '/__internal/endpoints' && request.method === 'GET') {
        return new Response(JSON.stringify({ data: Array.from(endpoints.values()) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // POST endpoint
      if (path === '/__internal/endpoints' && request.method === 'POST') {
        const body = await request.json() as Record<string, unknown>;
        const id = `ep_${++endpointCounter}`;
        const endpoint = {
          id,
          path: body.path as string,
          response_body: body.response_body as string,
          status_code: body.status_code as number,
          delay_ms: body.delay_ms as number,
        };
        endpoints.set(id, endpoint);
        return new Response(JSON.stringify({ data: endpoint }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // PUT endpoint
      const putMatch = path.match(/^\/__internal\/endpoints\/(.+)$/);
      if (putMatch && request.method === 'PUT') {
        const id = putMatch[1];
        const existing = endpoints.get(id);
        if (!existing) {
          return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const body = await request.json() as Record<string, unknown>;
        const updated = {
          id: existing.id,
          path: existing.path,
          response_body: (body.response_body as string | undefined) ?? existing.response_body,
          status_code: (body.status_code as number | undefined) ?? existing.status_code,
          delay_ms: (body.delay_ms as number | undefined) ?? existing.delay_ms,
        };
        endpoints.set(id, updated);
        return new Response(JSON.stringify({ data: updated }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // DELETE endpoint
      const deleteMatch = path.match(/^\/__internal\/endpoints\/(.+)$/);
      if (deleteMatch && request.method === 'DELETE') {
        const id = deleteMatch[1];
        endpoints.delete(id);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // GET rules
      if (path.startsWith('/__internal/rules') && request.method === 'GET') {
        const endpointId = url.searchParams.get('endpointId');
        const filteredRules = Array.from(rules.values()).filter(
          (r) => r.endpointId === endpointId
        );
        return new Response(JSON.stringify({ data: filteredRules }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // POST rule
      if (path === '/__internal/rules' && request.method === 'POST') {
        const body = await request.json() as Record<string, unknown>;
        const id = `rule_${++ruleCounter}`;
        const rule = { id, ...body };
        rules.set(id, rule);
        return new Response(JSON.stringify({ data: rule }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // PUT rule
      const putRuleMatch = path.match(/^\/__internal\/rules\/(.+)$/);
      if (putRuleMatch && request.method === 'PUT') {
        const id = putRuleMatch[1];
        const existing = rules.get(id);
        if (!existing) {
          return new Response(JSON.stringify({ error: 'Rule not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const body = await request.json() as Record<string, unknown>;
        const updated = { ...existing, ...body };
        rules.set(id, updated);
        return new Response(JSON.stringify({ data: updated }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // DELETE rule
      const deleteRuleMatch = path.match(/^\/__internal\/rules\/(.+)$/);
      if (deleteRuleMatch && request.method === 'DELETE') {
        const id = deleteRuleMatch[1];
        rules.delete(id);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  } as unknown as DurableObjectStub;

  return {
    idFromName: () => ({ toString: () => 'mock-do-id' }) as DurableObjectId,
    idFromString: () => ({ toString: () => 'mock-do-id' }) as DurableObjectId,
    newUniqueId: () => ({ toString: () => 'mock-do-id' }) as DurableObjectId,
    get: () => mockStub,
    getByName: () => mockStub,
    jurisdiction: () => ({}) as DurableObjectNamespace,
  } as unknown as DurableObjectNamespace;
}

// Create mock environment
export function createMockEnv(store: MockDataStore): Env {
  return {
    DB: createMockD1(store),
    ENDPOINT_DO: createMockDurableObject(),
    ENVIRONMENT: 'test',
    RESEND_API_KEY: 'test-resend-key',
    GITHUB_CLIENT_ID: 'test-github-client-id',
    GITHUB_CLIENT_SECRET: 'test-github-client-secret',
    APP_URL: 'http://localhost:5173',
    API_URL: 'http://localhost:8787',
    COOKIE_DOMAIN: undefined,
  };
}

// Helper to create test user
export function createTestUser(store: MockDataStore, overrides: Partial<DbUser> = {}): DbUser {
  const user: DbUser = {
    id: overrides.id || `user_${Date.now()}`,
    email: overrides.email || 'test@example.com',
    password_hash: overrides.password_hash || null,
    tier: overrides.tier || 'free',
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString(),
    stripe_customer_id: overrides.stripe_customer_id || null,
  };
  store.users.set(user.id, user);
  return user;
}

// Helper to create test session
export function createTestSession(store: MockDataStore, userId: string, overrides: Partial<DbSession> = {}): DbSession {
  const session: DbSession = {
    id: overrides.id || `session_${Date.now()}`,
    user_id: userId,
    expires_at: overrides.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: overrides.created_at || new Date().toISOString(),
  };
  store.sessions.set(session.id, session);
  return session;
}

// Helper to create test project
export function createTestProject(store: MockDataStore, overrides: Partial<DbProject> = {}): DbProject {
  const project: DbProject = {
    id: overrides.id || `proj_${Date.now()}`,
    user_id: overrides.user_id !== undefined ? overrides.user_id : null,
    name: overrides.name || 'Test Project',
    subdomain: overrides.subdomain || `test-${Date.now()}`,
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString(),
  };
  store.projects.set(project.id, project);
  return project;
}

// Helper to make requests to the app
export function makeRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    cookie?: string;
  } = {}
): Request {
  const { method = 'GET', body, headers = {}, cookie } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (cookie) {
    requestHeaders['Cookie'] = cookie;
  }

  return new Request(`http://localhost${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Type helper for JSON responses
export type JsonResponse = Record<string, unknown>;
