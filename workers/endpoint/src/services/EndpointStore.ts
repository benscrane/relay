import { generateId } from '@mockd/shared/utils';
import { TIER_LIMITS } from '@mockd/shared/constants';

export interface DbEndpoint {
  [key: string]: string | number | null;
  id: string;
  path: string;
  content_type: string;
  response_body: string;
  status_code: number;
  delay_ms: number;
  rate_limit: number;
  created_at: string;
  updated_at: string;
}

export interface ApiEndpoint {
  id: string;
  projectId: string;
  path: string;
  contentType: string;
  responseBody: string;
  statusCode: number;
  delay: number;
  rateLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEndpointInput {
  path: string;
  content_type?: string;
  response_body?: string;
  status_code?: number;
  delay_ms?: number;
  rate_limit?: number;
}

export interface UpdateEndpointInput {
  content_type?: string;
  response_body?: string;
  status_code?: number;
  delay_ms?: number;
  rate_limit?: number;
}

export class EndpointStore {
  constructor(private sql: SqlStorage) {}

  list(projectId?: string): ApiEndpoint[] {
    const dbEndpoints = this.sql
      .exec<DbEndpoint>('SELECT * FROM endpoints ORDER BY created_at DESC')
      .toArray();

    return dbEndpoints.map(e => this.mapDbEndpointToEndpoint(e, projectId));
  }

  listForMatching(): DbEndpoint[] {
    return this.sql
      .exec<DbEndpoint>('SELECT * FROM endpoints ORDER BY created_at ASC')
      .toArray();
  }

  findById(id: string, projectId?: string): ApiEndpoint | null {
    const dbEndpoint = this.sql
      .exec<DbEndpoint>('SELECT * FROM endpoints WHERE id = ?', id)
      .toArray()[0];

    if (!dbEndpoint) {
      return null;
    }

    return this.mapDbEndpointToEndpoint(dbEndpoint, projectId);
  }

  findByPath(path: string): DbEndpoint | null {
    const dbEndpoint = this.sql
      .exec<DbEndpoint>('SELECT * FROM endpoints WHERE path = ?', path)
      .toArray()[0];

    return dbEndpoint ?? null;
  }

  create(input: CreateEndpointInput, projectId?: string): ApiEndpoint | null {
    // Check for duplicate path
    const existing = this.findByPath(input.path);
    if (existing) {
      return null;
    }

    const id = `ep_${generateId()}`;
    const now = new Date().toISOString();

    this.sql.exec(
      `INSERT INTO endpoints (id, path, content_type, response_body, status_code, delay_ms, rate_limit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.path,
      input.content_type ?? 'application/json',
      input.response_body ?? '{}',
      input.status_code ?? 200,
      input.delay_ms ?? 0,
      input.rate_limit ?? TIER_LIMITS.free.defaultEndpointRateLimit,
      now,
      now
    );

    return this.findById(id, projectId);
  }

  update(id: string, input: UpdateEndpointInput, projectId?: string): ApiEndpoint | null {
    // Check if endpoint exists
    const existing = this.sql
      .exec<DbEndpoint>('SELECT * FROM endpoints WHERE id = ?', id)
      .toArray()[0];

    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (input.content_type !== undefined) {
      updates.push('content_type = ?');
      params.push(input.content_type);
    }
    if (input.response_body !== undefined) {
      updates.push('response_body = ?');
      params.push(input.response_body);
    }
    if (input.status_code !== undefined) {
      updates.push('status_code = ?');
      params.push(input.status_code);
    }
    if (input.delay_ms !== undefined) {
      updates.push('delay_ms = ?');
      params.push(input.delay_ms);
    }
    if (input.rate_limit !== undefined) {
      updates.push('rate_limit = ?');
      params.push(input.rate_limit);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(id);

      this.sql.exec(
        `UPDATE endpoints SET ${updates.join(', ')} WHERE id = ?`,
        ...params
      );
    }

    return this.findById(id, projectId);
  }

  delete(id: string): void {
    this.sql.exec('DELETE FROM endpoints WHERE id = ?', id);
  }

  private mapDbEndpointToEndpoint(dbEndpoint: DbEndpoint, projectId: string = ''): ApiEndpoint {
    return {
      id: dbEndpoint.id,
      projectId,
      path: dbEndpoint.path,
      contentType: dbEndpoint.content_type ?? 'application/json',
      responseBody: dbEndpoint.response_body,
      statusCode: dbEndpoint.status_code,
      delay: dbEndpoint.delay_ms,
      rateLimit: dbEndpoint.rate_limit ?? TIER_LIMITS.free.defaultEndpointRateLimit,
      createdAt: dbEndpoint.created_at,
      updatedAt: dbEndpoint.updated_at,
    };
  }
}
