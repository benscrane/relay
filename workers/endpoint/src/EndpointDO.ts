import {
  matchPath,
  normalizePath,
  generateId,
  generateRuleId,
  matchRule,
  interpolateParams,
  calculatePathSpecificity,
  getWindowKey,
  calculateRateLimitHeaders,
  getRateLimitExceededData,
  RATE_LIMIT_WINDOW_MS,
} from '@mockd/shared/utils';
import { TIER_LIMITS } from '@mockd/shared/constants';
import type { RequestContext } from '@mockd/shared/utils';
import type {
  ClientMessage,
  ServerMessage,
  RequestLog,
} from '@mockd/shared/types/websocket';
import type {
  MockRule,
  DbMockRule,
  CreateMockRuleRequest,
  UpdateMockRuleRequest,
} from '@mockd/shared/types/mock-rule';

interface DOEnv {
  INTERNAL_API_SECRET: string;
}

// Headers added by Cloudflare that should be filtered from request logs
// These are infrastructure headers, not headers sent by the actual client
const CLOUDFLARE_HEADERS = new Set([
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-request-id',
  'cf-warp-tag-id',
  'cf-ew-via',
  'cf-pseudo-ipv4',
  'cf-connecting-ipv6',
  'x-forwarded-proto',
  'x-forwarded-for',
  'x-real-ip',
  'cdn-loop',
]);

interface DbEndpoint {
  [key: string]: string | number | null;
  id: string;
  path: string;
  response_body: string;
  status_code: number;
  delay_ms: number;
  rate_limit: number;
  created_at: string;
  updated_at: string;
}

interface ApiEndpoint {
  id: string;
  projectId: string;
  path: string;
  responseBody: string;
  statusCode: number;
  delay: number;
  rateLimit: number;
  createdAt: string;
  updatedAt: string;
}

interface RulesCache {
  rules: MockRule[];
  timestamp: number;
}

const RULES_CACHE_TTL_MS = 60000; // 60 seconds

export class EndpointDO implements DurableObject {
  private sql: SqlStorage;
  private sessions: Map<WebSocket, { endpointId?: string }> = new Map();
  private rulesCache: Map<string, RulesCache> = new Map();

  constructor(private state: DurableObjectState, private env: DOEnv) {
    this.sql = state.storage.sql;
    this.initializeSchema();
  }

  private validateInternalAuth(request: Request): boolean {
    const authHeader = request.headers.get('X-Internal-Auth');
    return authHeader === this.env.INTERNAL_API_SECRET;
  }

  private initializeSchema(): void {
    // Migrate from old schema that had 'method' column
    const existingColumns = this.sql.exec<{ name: string }>(
      "PRAGMA table_info(endpoints)"
    ).toArray();

    if (existingColumns.some(c => c.name === 'method')) {
      this.sql.exec(`DROP TABLE IF EXISTS endpoints`);
    }

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS endpoints (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        response_body TEXT NOT NULL DEFAULT '{}',
        status_code INTEGER NOT NULL DEFAULT 200,
        delay_ms INTEGER NOT NULL DEFAULT 0,
        rate_limit INTEGER NOT NULL DEFAULT 30,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS request_logs (
        id TEXT PRIMARY KEY,
        endpoint_id TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        headers TEXT NOT NULL DEFAULT '{}',
        body TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        matched_rule_id TEXT,
        matched_rule_name TEXT,
        path_params TEXT,
        response_status INTEGER,
        response_time_ms INTEGER,
        FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
      );

      CREATE TABLE IF NOT EXISTS mock_rules (
        id TEXT PRIMARY KEY,
        endpoint_id TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        name TEXT,
        match_method TEXT,
        match_path TEXT,
        match_headers TEXT,
        response_status INTEGER DEFAULT 200,
        response_headers TEXT,
        response_body TEXT NOT NULL DEFAULT '{}',
        response_delay_ms INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_endpoints_path ON endpoints(path);
      CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint ON request_logs(endpoint_id);
      CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_mock_rules_endpoint ON mock_rules(endpoint_id);
    `);

    // Migrate: add response_status and response_time_ms columns to request_logs
    const requestLogColumns = this.sql.exec<{ name: string }>(
      "PRAGMA table_info(request_logs)"
    ).toArray();

    if (!requestLogColumns.some(c => c.name === 'response_status')) {
      this.sql.exec(`ALTER TABLE request_logs ADD COLUMN response_status INTEGER`);
    }
    if (!requestLogColumns.some(c => c.name === 'response_time_ms')) {
      this.sql.exec(`ALTER TABLE request_logs ADD COLUMN response_time_ms INTEGER`);
    }

    // Migrate: add rate_limit column to endpoints
    const endpointColumns = this.sql.exec<{ name: string }>(
      "PRAGMA table_info(endpoints)"
    ).toArray();

    if (!endpointColumns.some(c => c.name === 'rate_limit')) {
      this.sql.exec(`ALTER TABLE endpoints ADD COLUMN rate_limit INTEGER NOT NULL DEFAULT 30`);
    }
  }

  private getRulesForEndpoint(endpointId: string): MockRule[] {
    const cached = this.rulesCache.get(endpointId);
    const now = Date.now();

    if (cached && now - cached.timestamp < RULES_CACHE_TTL_MS) {
      return cached.rules;
    }

    const dbRules = this.sql
      .exec<DbMockRule>('SELECT * FROM mock_rules WHERE endpoint_id = ?', endpointId)
      .toArray();

    const rules = dbRules.map(this.mapDbRuleToRule);

    this.rulesCache.set(endpointId, { rules, timestamp: now });

    return rules;
  }

  private invalidateRulesCache(endpointId: string): void {
    this.rulesCache.delete(endpointId);
  }

  private mapDbRuleToRule(dbRule: DbMockRule): MockRule {
    return {
      id: dbRule.id,
      endpointId: dbRule.endpoint_id,
      priority: dbRule.priority,
      name: dbRule.name,
      matchMethod: dbRule.match_method,
      matchPath: dbRule.match_path,
      matchHeaders: dbRule.match_headers ? JSON.parse(dbRule.match_headers) : null,
      responseStatus: dbRule.response_status,
      responseHeaders: dbRule.response_headers ? JSON.parse(dbRule.response_headers) : null,
      responseBody: dbRule.response_body,
      responseDelayMs: dbRule.response_delay_ms,
      isActive: dbRule.is_active === 1,
      createdAt: dbRule.created_at,
      updatedAt: dbRule.updated_at,
    };
  }

  private mapDbEndpointToEndpoint(dbEndpoint: DbEndpoint, projectId: string = ''): ApiEndpoint {
    return {
      id: dbEndpoint.id,
      projectId,
      path: dbEndpoint.path,
      responseBody: dbEndpoint.response_body,
      statusCode: dbEndpoint.status_code,
      delay: dbEndpoint.delay_ms,
      rateLimit: dbEndpoint.rate_limit ?? TIER_LIMITS.free.defaultEndpointRateLimit,
      createdAt: dbEndpoint.created_at,
      updatedAt: dbEndpoint.updated_at,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Handle internal API calls (from main API worker)
    if (url.pathname.startsWith('/__internal/')) {
      return this.handleInternalRequest(request);
    }

    // Handle mock endpoint requests
    return this.handleMockRequest(request);
  }

  private handleWebSocket(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);
    this.sessions.set(server, {});

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleInternalRequest(request: Request): Promise<Response> {
    // Validate internal authentication
    if (!this.validateInternalAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // GET /__internal/endpoints - List all endpoints
    if (path === '/__internal/endpoints' && request.method === 'GET') {
      const dbEndpoints = this.sql
        .exec<DbEndpoint>('SELECT * FROM endpoints ORDER BY created_at DESC')
        .toArray();

      const endpoints = dbEndpoints.map(e => this.mapDbEndpointToEndpoint(e));

      return new Response(JSON.stringify({ data: endpoints }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // POST /__internal/endpoints - Create a new endpoint
    if (path === '/__internal/endpoints' && request.method === 'POST') {
      const body = await request.json() as { path: string; response_body?: string; status_code?: number; delay_ms?: number; rate_limit?: number };

      if (!body.path) {
        return new Response(JSON.stringify({ error: 'path is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check if endpoint with this path already exists
      const existing = this.sql
        .exec<DbEndpoint>('SELECT * FROM endpoints WHERE path = ?', body.path)
        .toArray()[0];

      if (existing) {
        return new Response(JSON.stringify({ error: 'An endpoint with this path already exists' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const id = `ep_${generateId()}`;
      const now = new Date().toISOString();

      this.sql.exec(
        `INSERT INTO endpoints (id, path, response_body, status_code, delay_ms, rate_limit, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        body.path,
        body.response_body ?? '{}',
        body.status_code ?? 200,
        body.delay_ms ?? 0,
        body.rate_limit ?? TIER_LIMITS.free.defaultEndpointRateLimit,
        now,
        now
      );

      const dbEndpoint = this.sql
        .exec<DbEndpoint>('SELECT * FROM endpoints WHERE id = ?', id)
        .toArray()[0];

      return new Response(JSON.stringify({ data: this.mapDbEndpointToEndpoint(dbEndpoint) }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // PUT /__internal/endpoints/:id - Update an endpoint
    const endpointUpdateMatch = path.match(/^\/__internal\/endpoints\/([^/]+)$/);
    if (endpointUpdateMatch && request.method === 'PUT') {
      const endpointId = endpointUpdateMatch[1];
      const body = await request.json() as { response_body?: string; status_code?: number; delay_ms?: number; rate_limit?: number };

      // Check if endpoint exists
      const existing = this.sql
        .exec<DbEndpoint>('SELECT * FROM endpoints WHERE id = ?', endpointId)
        .toArray()[0];

      if (!existing) {
        return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const updates: string[] = [];
      const params: (string | number)[] = [];

      if (body.response_body !== undefined) {
        updates.push('response_body = ?');
        params.push(body.response_body);
      }
      if (body.status_code !== undefined) {
        updates.push('status_code = ?');
        params.push(body.status_code);
      }
      if (body.delay_ms !== undefined) {
        updates.push('delay_ms = ?');
        params.push(body.delay_ms);
      }
      if (body.rate_limit !== undefined) {
        updates.push('rate_limit = ?');
        params.push(body.rate_limit);
      }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        params.push(endpointId);

        this.sql.exec(
          `UPDATE endpoints SET ${updates.join(', ')} WHERE id = ?`,
          ...params
        );
      }

      const dbEndpoint = this.sql
        .exec<DbEndpoint>('SELECT * FROM endpoints WHERE id = ?', endpointId)
        .toArray()[0];

      return new Response(JSON.stringify({ data: this.mapDbEndpointToEndpoint(dbEndpoint) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // DELETE /__internal/endpoints/:id - Delete an endpoint
    const endpointDeleteMatch = path.match(/^\/__internal\/endpoints\/([^/]+)$/);
    if (endpointDeleteMatch && request.method === 'DELETE') {
      const endpointId = endpointDeleteMatch[1];

      this.sql.exec('DELETE FROM endpoints WHERE id = ?', endpointId);
      this.invalidateRulesCache(endpointId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // GET /__internal/logs - Get request history
    if (path === '/__internal/logs' && request.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);
      const endpointId = url.searchParams.get('endpointId');

      let query = 'SELECT * FROM request_logs';
      const params: (string | number)[] = [];

      if (endpointId) {
        query += ' WHERE endpoint_id = ?';
        params.push(endpointId);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const logs = this.sql.exec<RequestLog>(query, ...params).toArray();

      return new Response(JSON.stringify({ data: logs }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // DELETE /__internal/logs - Clear request history
    if (path === '/__internal/logs' && request.method === 'DELETE') {
      const endpointId = url.searchParams.get('endpointId');

      if (endpointId) {
        this.sql.exec('DELETE FROM request_logs WHERE endpoint_id = ?', endpointId);
      } else {
        this.sql.exec('DELETE FROM request_logs');
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // GET /__internal/rules - List rules for an endpoint
    if (path === '/__internal/rules' && request.method === 'GET') {
      const endpointId = url.searchParams.get('endpointId');

      if (!endpointId) {
        return new Response(JSON.stringify({ error: 'endpointId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const rules = this.getRulesForEndpoint(endpointId);

      return new Response(JSON.stringify({ data: rules }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // POST /__internal/rules - Create a new rule
    if (path === '/__internal/rules' && request.method === 'POST') {
      const body = await request.json() as CreateMockRuleRequest;

      if (!body.endpointId) {
        return new Response(JSON.stringify({ error: 'endpointId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const id = generateRuleId();
      const now = new Date().toISOString();

      this.sql.exec(
        `INSERT INTO mock_rules (
          id, endpoint_id, priority, name, match_method, match_path, match_headers,
          response_status, response_headers, response_body, response_delay_ms, is_active,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        body.endpointId,
        body.priority ?? 0,
        body.name ?? null,
        body.matchMethod ?? null,
        body.matchPath ?? null,
        body.matchHeaders ? JSON.stringify(body.matchHeaders) : null,
        body.responseStatus ?? 200,
        body.responseHeaders ? JSON.stringify(body.responseHeaders) : null,
        body.responseBody,
        body.responseDelayMs ?? 0,
        body.isActive !== false ? 1 : 0,
        now,
        now
      );

      this.invalidateRulesCache(body.endpointId);

      const dbRule = this.sql
        .exec<DbMockRule>('SELECT * FROM mock_rules WHERE id = ?', id)
        .toArray()[0];
      const rule = this.mapDbRuleToRule(dbRule);

      return new Response(JSON.stringify({ data: rule }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // PUT /__internal/rules/:id - Update a rule
    const rulesUpdateMatch = path.match(/^\/__internal\/rules\/([^/]+)$/);
    if (rulesUpdateMatch && request.method === 'PUT') {
      const ruleId = rulesUpdateMatch[1];
      const body = await request.json() as UpdateMockRuleRequest;

      // Get current rule to get endpoint_id for cache invalidation
      const existingRule = this.sql
        .exec<DbMockRule>('SELECT * FROM mock_rules WHERE id = ?', ruleId)
        .toArray()[0];

      if (!existingRule) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const updates: string[] = [];
      const params: (string | number | null)[] = [];

      if (body.priority !== undefined) {
        updates.push('priority = ?');
        params.push(body.priority);
      }
      if (body.name !== undefined) {
        updates.push('name = ?');
        params.push(body.name);
      }
      if (body.matchMethod !== undefined) {
        updates.push('match_method = ?');
        params.push(body.matchMethod);
      }
      if (body.matchPath !== undefined) {
        updates.push('match_path = ?');
        params.push(body.matchPath);
      }
      if (body.matchHeaders !== undefined) {
        updates.push('match_headers = ?');
        params.push(body.matchHeaders ? JSON.stringify(body.matchHeaders) : null);
      }
      if (body.responseStatus !== undefined) {
        updates.push('response_status = ?');
        params.push(body.responseStatus);
      }
      if (body.responseHeaders !== undefined) {
        updates.push('response_headers = ?');
        params.push(body.responseHeaders ? JSON.stringify(body.responseHeaders) : null);
      }
      if (body.responseBody !== undefined) {
        updates.push('response_body = ?');
        params.push(body.responseBody);
      }
      if (body.responseDelayMs !== undefined) {
        updates.push('response_delay_ms = ?');
        params.push(body.responseDelayMs);
      }
      if (body.isActive !== undefined) {
        updates.push('is_active = ?');
        params.push(body.isActive ? 1 : 0);
      }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        params.push(ruleId);

        this.sql.exec(
          `UPDATE mock_rules SET ${updates.join(', ')} WHERE id = ?`,
          ...params
        );

        this.invalidateRulesCache(existingRule.endpoint_id);
      }

      const updatedRule = this.sql
        .exec<DbMockRule>('SELECT * FROM mock_rules WHERE id = ?', ruleId)
        .toArray()[0];
      const rule = this.mapDbRuleToRule(updatedRule);

      return new Response(JSON.stringify({ data: rule }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // DELETE /__internal/rules/:id - Delete a rule
    const rulesDeleteMatch = path.match(/^\/__internal\/rules\/([^/]+)$/);
    if (rulesDeleteMatch && request.method === 'DELETE') {
      const ruleId = rulesDeleteMatch[1];

      // Get rule to get endpoint_id for cache invalidation
      const existingRule = this.sql
        .exec<DbMockRule>('SELECT * FROM mock_rules WHERE id = ?', ruleId)
        .toArray()[0];

      if (!existingRule) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      this.sql.exec('DELETE FROM mock_rules WHERE id = ?', ruleId);
      this.invalidateRulesCache(existingRule.endpoint_id);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Check and increment rate limit counter for an endpoint.
   * Uses Durable Object transactional storage for atomic operations.
   */
  private async checkRateLimit(endpointId: string, limit: number): Promise<{
    allowed: boolean;
    count: number;
  }> {
    const key = getWindowKey(endpointId, RATE_LIMIT_WINDOW_MS);
    const count = (await this.state.storage.get<number>(key)) ?? 0;

    console.log('[RateLimit] Check:', {
      endpointId,
      key,
      currentCount: count,
      limit,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });

    if (count >= limit) {
      console.log('[RateLimit] BLOCKED:', {
        endpointId,
        count,
        limit,
        reason: 'count >= limit',
      });
      return { allowed: false, count };
    }

    // Increment counter with TTL (auto-expires after 2 windows)
    // Using type assertion because CF types may not include expirationTtl yet
    const ttlSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS * 2) / 1000);
    await this.state.storage.put(key, count + 1, {
      expirationTtl: ttlSeconds,
    } as DurableObjectPutOptions);

    console.log('[RateLimit] ALLOWED:', {
      endpointId,
      newCount: count + 1,
      limit,
      remaining: limit - (count + 1),
      ttlSeconds,
    });

    return { allowed: true, count: count + 1 };
  }

  private async handleMockRequest(request: Request): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(request.url);
    const method = request.method;
    const path = normalizePath(url.pathname);

    // Read request body
    const body = await request.text();

    // Build headers object for matching
    const headersObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    // Find matching endpoint (match on path only, not method)
    const endpoints = this.sql
      .exec<DbEndpoint>('SELECT * FROM endpoints ORDER BY created_at ASC')
      .toArray();

    // Sort endpoints by specificity (more specific paths first)
    const sortedEndpoints = [...endpoints].sort((a, b) =>
      calculatePathSpecificity(b.path) - calculatePathSpecificity(a.path)
    );

    let matchedEndpoint: DbEndpoint | undefined;
    let endpointPathParams: Record<string, string> = {};
    for (const endpoint of sortedEndpoints) {
      const match = matchPath(endpoint.path, path);
      if (match.matched) {
        matchedEndpoint = endpoint;
        endpointPathParams = match.params;
        break;
      }
    }

    if (!matchedEndpoint) {
      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit
    const rateLimit = matchedEndpoint.rate_limit ?? TIER_LIMITS.free.defaultEndpointRateLimit;

    console.log('[RateLimit] Request:', {
      requestPath: path,
      method,
      endpointId: matchedEndpoint.id,
      endpointPath: matchedEndpoint.path,
      configuredRateLimit: matchedEndpoint.rate_limit,
      effectiveRateLimit: rateLimit,
      rateLimitSource: matchedEndpoint.rate_limit !== null ? 'endpoint' : 'tier_default',
    });

    const { allowed, count } = await this.checkRateLimit(matchedEndpoint.id, rateLimit);

    if (!allowed) {
      console.log('[RateLimit] Returning 429:', {
        endpointId: matchedEndpoint.id,
        path,
        count,
        limit: rateLimit,
      });
      const rateLimitData = getRateLimitExceededData(rateLimit, RATE_LIMIT_WINDOW_MS);
      return new Response(rateLimitData.body, {
        status: rateLimitData.status,
        headers: rateLimitData.headers,
      });
    }

    // Get rules for this endpoint and try to match
    const rules = this.getRulesForEndpoint(matchedEndpoint.id);
    const requestContext: RequestContext = { method, path, headers: headersObj };
    const ruleMatch = matchRule(rules, requestContext, endpointPathParams);

    // Determine response config (from rule or endpoint defaults)
    let responseStatus: number;
    let responseBody: string;
    let responseDelayMs: number;
    let responseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    let matchedRuleId: string | null = null;
    let matchedRuleName: string | null = null;
    let pathParams: Record<string, string> = endpointPathParams;

    if (ruleMatch) {
      const { rule, pathParams: rulePathParams } = ruleMatch;
      matchedRuleId = rule.id;
      matchedRuleName = rule.name;
      responseStatus = rule.responseStatus;
      responseBody = interpolateParams(rule.responseBody, rulePathParams);
      responseDelayMs = rule.responseDelayMs;
      pathParams = rulePathParams;

      if (rule.responseHeaders) {
        responseHeaders = { ...responseHeaders, ...rule.responseHeaders };
      }
    } else {
      responseStatus = matchedEndpoint.status_code;
      responseBody = interpolateParams(matchedEndpoint.response_body, endpointPathParams);
      responseDelayMs = matchedEndpoint.delay_ms;
    }

    // Add rate limit headers to response
    const rateLimitHeaders = calculateRateLimitHeaders(rateLimit, count, RATE_LIMIT_WINDOW_MS);
    responseHeaders = { ...responseHeaders, ...rateLimitHeaders };

    // Calculate response time (processing time before any artificial delay)
    const responseTimeMs = Date.now() - startTime;

    // Log the request with rule info and response data
    const requestLog = await this.logRequest(
      matchedEndpoint.id,
      method,
      path,
      request.headers,
      body,
      matchedRuleId,
      matchedRuleName,
      pathParams,
      responseStatus,
      responseTimeMs
    );

    // Broadcast to connected WebSocket clients
    this.broadcastRequest(requestLog);

    // Apply delay if configured
    if (responseDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, responseDelayMs));
    }

    return new Response(responseBody, {
      status: responseStatus,
      headers: responseHeaders,
    });
  }

  private async logRequest(
    endpointId: string,
    method: string,
    path: string,
    headers: Headers,
    body: string | null,
    matchedRuleId: string | null = null,
    matchedRuleName: string | null = null,
    pathParams: Record<string, string> | null = null,
    responseStatus: number | null = null,
    responseTimeMs: number | null = null
  ): Promise<RequestLog> {
    const id = `req_${generateId()}`;
    const timestamp = new Date().toISOString();

    // Convert headers to JSON, filtering out Cloudflare infrastructure headers
    const headersObj: Record<string, string> = {};
    headers.forEach((value, key) => {
      if (!CLOUDFLARE_HEADERS.has(key.toLowerCase())) {
        headersObj[key] = value;
      }
    });
    const headersJson = JSON.stringify(headersObj);
    const pathParamsJson = pathParams && Object.keys(pathParams).length > 0
      ? JSON.stringify(pathParams)
      : null;

    // Insert into database
    this.sql.exec(
      `INSERT INTO request_logs (id, endpoint_id, method, path, headers, body, timestamp, matched_rule_id, matched_rule_name, path_params, response_status, response_time_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      endpointId,
      method,
      path,
      headersJson,
      body,
      timestamp,
      matchedRuleId,
      matchedRuleName,
      pathParamsJson,
      responseStatus,
      responseTimeMs
    );

    return {
      id,
      endpoint_id: endpointId,
      method,
      path,
      headers: headersJson,
      body,
      timestamp,
      matched_rule_id: matchedRuleId,
      matched_rule_name: matchedRuleName,
      path_params: pathParamsJson,
      response_status: responseStatus,
      response_time_ms: responseTimeMs,
    };
  }

  private broadcastRequest(requestLog: RequestLog): void {
    const message: ServerMessage = {
      type: 'request',
      data: requestLog,
    };

    const messageStr = JSON.stringify(message);

    // Broadcast to all connected WebSocket clients
    const sockets = this.state.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.send(messageStr);
      } catch (error) {
        console.error('Error broadcasting to WebSocket:', error);
      }
    }
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    try {
      // Only handle string messages
      if (typeof message !== 'string') {
        return;
      }

      const data = JSON.parse(message) as ClientMessage;

      switch (data.type) {
        case 'ping':
          this.handlePing(ws);
          break;

        case 'getHistory':
          this.handleGetHistory(ws, data.endpointId);
          break;

        case 'subscribe':
          this.handleSubscribe(ws, data.endpointId);
          break;

        default:
          console.warn('Unknown WebSocket message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.sessions.delete(ws);
  }

  private handlePing(ws: WebSocket): void {
    const response: ServerMessage = { type: 'pong' };
    ws.send(JSON.stringify(response));
  }

  private handleGetHistory(ws: WebSocket, endpointId?: string): void {
    let query = 'SELECT * FROM request_logs';
    const params: string[] = [];

    if (endpointId) {
      query += ' WHERE endpoint_id = ?';
      params.push(endpointId);
    }

    query += ' ORDER BY timestamp DESC LIMIT 100';

    const logs = this.sql.exec<RequestLog>(query, ...params).toArray();

    const response: ServerMessage = {
      type: 'history',
      data: logs,
    };

    ws.send(JSON.stringify(response));
  }

  private handleSubscribe(ws: WebSocket, endpointId?: string): void {
    // Update session with endpoint subscription
    const session = this.sessions.get(ws);
    if (session) {
      session.endpointId = endpointId;
    }
  }
}
