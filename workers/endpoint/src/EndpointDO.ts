import {
  matchPath,
  normalizePath,
  matchRule,
  processTemplate,
  processHeaders,
  calculatePathSpecificity,
  getWindowKey,
  calculateRateLimitHeaders,
  getRateLimitExceededData,
  RATE_LIMIT_WINDOW_MS,
} from '@mockd/shared/utils';
import { TIER_LIMITS, type Tier } from '@mockd/shared/constants';
import type { RequestContext, TemplateContext } from '@mockd/shared/utils';
import type {
  ClientMessage,
  ServerMessage,
  RequestLog,
} from '@mockd/shared/types/websocket';
import type {
  CreateMockRuleRequest,
  UpdateMockRuleRequest,
} from '@mockd/shared/types/mock-rule';
import { EndpointStore } from './services/EndpointStore';
import type { CreateEndpointInput, UpdateEndpointInput } from './services/EndpointStore';
import { RuleStore } from './services/RuleStore';
import { RequestLogger } from './services/RequestLogger';
import { AnalyticsService } from './services/AnalyticsService';

interface DOEnv {
  INTERNAL_API_SECRET: string;
}

export class EndpointDO implements DurableObject {
  private sql: SqlStorage;
  private sessions: Map<WebSocket, { endpointId?: string }> = new Map();
  private endpointStore: EndpointStore;
  private ruleStore: RuleStore;
  private requestLogger: RequestLogger;
  private analyticsService: AnalyticsService;

  constructor(private state: DurableObjectState, private env: DOEnv) {
    this.sql = state.storage.sql;
    this.initializeSchema();
    this.endpointStore = new EndpointStore(this.sql);
    this.ruleStore = new RuleStore(this.sql);
    this.requestLogger = new RequestLogger(this.sql);
    this.analyticsService = new AnalyticsService(this.sql);
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
        FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
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

    if (!endpointColumns.some(c => c.name === 'content_type')) {
      this.sql.exec(`ALTER TABLE endpoints ADD COLUMN content_type TEXT NOT NULL DEFAULT 'application/json'`);
    }
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

    // Handle CORS preflight for mock endpoints
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: this.getCorsHeaders(request),
      });
    }

    // Handle mock endpoint requests
    const response = await this.handleMockRequest(request);
    const corsHeaders = this.getCorsHeaders(request);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  }

  private getCorsHeaders(request: Request): Record<string, string> {
    const origin = request.headers.get('Origin') || '*';
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
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
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // GET /__internal/endpoints - List all endpoints
    if (path === '/__internal/endpoints' && request.method === 'GET') {
      return Response.json({ data: this.endpointStore.list() });
    }

    // POST /__internal/endpoints - Create a new endpoint
    if (path === '/__internal/endpoints' && request.method === 'POST') {
      const body = await request.json() as CreateEndpointInput;

      if (!body.path) {
        return Response.json({ error: 'path is required' }, { status: 400 });
      }

      const endpoint = this.endpointStore.create(body);
      if (!endpoint) {
        return Response.json(
          { error: 'An endpoint with this path already exists' },
          { status: 409 }
        );
      }

      return Response.json({ data: endpoint }, { status: 201 });
    }

    // PUT /__internal/endpoints/:id - Update an endpoint
    const endpointUpdateMatch = path.match(/^\/__internal\/endpoints\/([^/]+)$/);
    if (endpointUpdateMatch && request.method === 'PUT') {
      const endpointId = endpointUpdateMatch[1];
      const body = await request.json() as UpdateEndpointInput;

      const endpoint = this.endpointStore.update(endpointId, body);
      if (!endpoint) {
        return Response.json({ error: 'Endpoint not found' }, { status: 404 });
      }

      return Response.json({ data: endpoint });
    }

    // DELETE /__internal/endpoints/:id - Delete an endpoint
    const endpointDeleteMatch = path.match(/^\/__internal\/endpoints\/([^/]+)$/);
    if (endpointDeleteMatch && request.method === 'DELETE') {
      const endpointId = endpointDeleteMatch[1];
      this.endpointStore.delete(endpointId);
      this.ruleStore.invalidateCache(endpointId);
      return Response.json({ success: true });
    }

    // GET /__internal/logs - Get request history
    if (path === '/__internal/logs' && request.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);
      const endpointId = url.searchParams.get('endpointId') || undefined;
      const logs = this.requestLogger.query({ endpointId, limit });
      return Response.json({ data: logs });
    }

    // GET /__internal/analytics - Get aggregated analytics for an endpoint
    if (path === '/__internal/analytics' && request.method === 'GET') {
      const endpointId = url.searchParams.get('endpointId');

      if (!endpointId) {
        return Response.json({ error: 'endpointId is required' }, { status: 400 });
      }

      const analytics = this.analyticsService.getAnalytics(endpointId);
      return Response.json({ data: analytics });
    }

    // DELETE /__internal/logs - Clear request history
    if (path === '/__internal/logs' && request.method === 'DELETE') {
      const endpointId = url.searchParams.get('endpointId') || undefined;
      this.requestLogger.clear(endpointId);
      return Response.json({ success: true });
    }

    // GET /__internal/rules - List rules for an endpoint
    if (path === '/__internal/rules' && request.method === 'GET') {
      const endpointId = url.searchParams.get('endpointId');

      if (!endpointId) {
        return Response.json({ error: 'endpointId is required' }, { status: 400 });
      }

      const rules = this.ruleStore.listForEndpoint(endpointId);
      return Response.json({ data: rules });
    }

    // POST /__internal/rules - Create a new rule
    if (path === '/__internal/rules' && request.method === 'POST') {
      const body = await request.json() as CreateMockRuleRequest;

      if (!body.endpointId) {
        return Response.json({ error: 'endpointId is required' }, { status: 400 });
      }

      const rule = this.ruleStore.create(body);
      return Response.json({ data: rule }, { status: 201 });
    }

    // PUT /__internal/rules/:id - Update a rule
    const rulesUpdateMatch = path.match(/^\/__internal\/rules\/([^/]+)$/);
    if (rulesUpdateMatch && request.method === 'PUT') {
      const ruleId = rulesUpdateMatch[1];
      const body = await request.json() as UpdateMockRuleRequest;

      const rule = this.ruleStore.update(ruleId, body);
      if (!rule) {
        return Response.json({ error: 'Rule not found' }, { status: 404 });
      }

      return Response.json({ data: rule });
    }

    // DELETE /__internal/rules/:id - Delete a rule
    const rulesDeleteMatch = path.match(/^\/__internal\/rules\/([^/]+)$/);
    if (rulesDeleteMatch && request.method === 'DELETE') {
      const ruleId = rulesDeleteMatch[1];

      const endpointId = this.ruleStore.delete(ruleId);
      if (endpointId === null) {
        return Response.json({ error: 'Rule not found' }, { status: 404 });
      }

      return Response.json({ success: true });
    }

    // PUT /__internal/config - Update project config (e.g., max request size based on tier)
    if (path === '/__internal/config' && request.method === 'PUT') {
      const body = await request.json() as { tier?: Tier; maxRequestSize?: number };

      if (body.tier) {
        const tierLimits = TIER_LIMITS[body.tier];
        if (tierLimits) {
          await this.state.storage.put('config:maxRequestSize', tierLimits.maxRequestSize);
        }
      } else if (body.maxRequestSize !== undefined) {
        await this.state.storage.put('config:maxRequestSize', body.maxRequestSize);
      }

      return Response.json({ success: true });
    }

    // GET /__internal/config - Get project config
    if (path === '/__internal/config' && request.method === 'GET') {
      const maxRequestSize = await this.state.storage.get<number>('config:maxRequestSize');

      return Response.json({
        data: {
          maxRequestSize: maxRequestSize ?? TIER_LIMITS.free.maxRequestSize,
        },
      });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
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

    if (count >= limit) {
      return { allowed: false, count };
    }

    // Increment counter with TTL (auto-expires after 2 windows)
    // Using type assertion because CF types may not include expirationTtl yet
    const ttlSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS * 2) / 1000);
    await this.state.storage.put(key, count + 1, {
      expirationTtl: ttlSeconds,
    } as DurableObjectPutOptions);

    return { allowed: true, count: count + 1 };
  }

  private async handleMockRequest(request: Request): Promise<Response> {
    const startTime = performance.now();
    const url = new URL(request.url);
    const method = request.method;
    const path = normalizePath(url.pathname);

    // Check Content-Length header early to reject obviously oversized requests
    const maxRequestSize = (await this.state.storage.get<number>('config:maxRequestSize'))
      ?? TIER_LIMITS.free.maxRequestSize;
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > maxRequestSize) {
      return new Response(JSON.stringify({
        error: 'Request body too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize: maxRequestSize,
        size: contentLength,
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Read request body
    const body = await request.text();

    // Check actual body size (Content-Length may be absent or inaccurate)
    if (body.length > maxRequestSize) {
      return new Response(JSON.stringify({
        error: 'Request body too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize: maxRequestSize,
        size: body.length,
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build headers object for matching
    const headersObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    // Find matching endpoint (match on path only, not method)
    const endpoints = this.endpointStore.listForMatching();

    // Sort endpoints by specificity (more specific paths first)
    const sortedEndpoints = [...endpoints].sort((a, b) =>
      calculatePathSpecificity(b.path) - calculatePathSpecificity(a.path)
    );

    let matchedEndpoint: typeof endpoints[0] | undefined;
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

    const { allowed, count } = await this.checkRateLimit(matchedEndpoint.id, rateLimit);

    if (!allowed) {
      const rateLimitData = getRateLimitExceededData(rateLimit, RATE_LIMIT_WINDOW_MS);
      return new Response(rateLimitData.body, {
        status: rateLimitData.status,
        headers: rateLimitData.headers,
      });
    }

    // Build query params from URL
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // Get rules for this endpoint and try to match
    const rules = this.ruleStore.listForEndpoint(matchedEndpoint.id);
    const requestContext: RequestContext = { method, path, headers: headersObj };
    const ruleMatch = matchRule(rules, requestContext, endpointPathParams);

    // Determine response config (from rule or endpoint defaults)
    const endpointContentType = matchedEndpoint.content_type ?? 'application/json';
    let responseStatus: number;
    let responseBody: string;
    let responseDelayMs: number;
    let responseHeaders: Record<string, string> = { 'Content-Type': endpointContentType };
    let matchedRuleId: string | null = null;
    let matchedRuleName: string | null = null;
    let pathParams: Record<string, string> = endpointPathParams;

    // Build template context for dynamic response templating
    const buildTemplateContext = (params: Record<string, string>): TemplateContext => ({
      pathParams: params,
      request: {
        method,
        path,
        headers: headersObj,
        query: queryParams,
        body: body || null,
      },
    });

    if (ruleMatch) {
      const { rule, pathParams: rulePathParams } = ruleMatch;
      matchedRuleId = rule.id;
      matchedRuleName = rule.name;
      responseStatus = rule.responseStatus;
      responseBody = processTemplate(rule.responseBody, buildTemplateContext(rulePathParams));
      responseDelayMs = rule.responseDelayMs;
      pathParams = rulePathParams;

      if (rule.responseHeaders) {
        // Process template variables in response header values
        const templatedHeaders = processHeaders(rule.responseHeaders, buildTemplateContext(rulePathParams));
        responseHeaders = { ...responseHeaders, ...templatedHeaders };
      }
    } else {
      responseStatus = matchedEndpoint.status_code;
      responseBody = processTemplate(matchedEndpoint.response_body, buildTemplateContext(endpointPathParams));
      responseDelayMs = matchedEndpoint.delay_ms;
    }

    // Add rate limit headers to response
    const rateLimitHeaders = calculateRateLimitHeaders(rateLimit, count, RATE_LIMIT_WINDOW_MS);
    responseHeaders = { ...responseHeaders, ...rateLimitHeaders };

    // Calculate response time (processing time before any artificial delay)
    const responseTimeMs = Math.round(performance.now() - startTime);

    // Log the request with rule info and response data
    const requestLog = this.requestLogger.log({
      endpointId: matchedEndpoint.id,
      method,
      path,
      headers: request.headers,
      body,
      matchedRuleId,
      matchedRuleName,
      pathParams,
      responseStatus,
      responseTimeMs,
    });

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
    const logs = this.requestLogger.query({ endpointId, limit: 100 });

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
