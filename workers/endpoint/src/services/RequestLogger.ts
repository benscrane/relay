import { generateId } from '@mockd/shared/utils';
import type { RequestLog } from '@mockd/shared/types/websocket';

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

export interface LogInput {
  endpointId: string;
  method: string;
  path: string;
  headers: Headers; // Web API Headers object, not plain object
  body: string | null;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  pathParams: Record<string, string> | null;
  responseStatus: number | null;
  responseTimeMs: number | null;
}

export class RequestLogger {
  constructor(private sql: SqlStorage) {}

  log(input: LogInput): RequestLog {
    const id = `req_${generateId()}`;
    const timestamp = new Date().toISOString();

    // Convert headers to JSON, filtering out Cloudflare infrastructure headers
    const headersObj: Record<string, string> = {};
    input.headers.forEach((value, key) => {
      if (!CLOUDFLARE_HEADERS.has(key.toLowerCase())) {
        headersObj[key] = value;
      }
    });
    const headersJson = JSON.stringify(headersObj);
    const pathParamsJson =
      input.pathParams && Object.keys(input.pathParams).length > 0
        ? JSON.stringify(input.pathParams)
        : null;

    // Insert into database
    this.sql.exec(
      `INSERT INTO request_logs (id, endpoint_id, method, path, headers, body, timestamp, matched_rule_id, matched_rule_name, path_params, response_status, response_time_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.endpointId,
      input.method,
      input.path,
      headersJson,
      input.body,
      timestamp,
      input.matchedRuleId,
      input.matchedRuleName,
      pathParamsJson,
      input.responseStatus,
      input.responseTimeMs
    );

    return {
      id,
      endpoint_id: input.endpointId,
      method: input.method,
      path: input.path,
      headers: headersJson,
      body: input.body,
      timestamp,
      matched_rule_id: input.matchedRuleId,
      matched_rule_name: input.matchedRuleName,
      path_params: pathParamsJson,
      response_status: input.responseStatus,
      response_time_ms: input.responseTimeMs,
    };
  }

  query(opts?: { endpointId?: string; limit?: number }): RequestLog[] {
    const limit = opts?.limit ?? 100;
    const endpointId = opts?.endpointId;

    let queryStr = 'SELECT * FROM request_logs';
    const params: (string | number)[] = [];

    if (endpointId) {
      queryStr += ' WHERE endpoint_id = ?';
      params.push(endpointId);
    }

    queryStr += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    return this.sql.exec<RequestLog>(queryStr, ...params).toArray();
  }

  clear(endpointId?: string): void {
    if (endpointId) {
      this.sql.exec('DELETE FROM request_logs WHERE endpoint_id = ?', endpointId);
    } else {
      this.sql.exec('DELETE FROM request_logs');
    }
  }
}
