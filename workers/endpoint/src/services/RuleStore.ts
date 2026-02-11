import { generateRuleId } from '@mockd/shared/utils';
import type {
  MockRule,
  DbMockRule,
  CreateMockRuleRequest,
  UpdateMockRuleRequest,
} from '@mockd/shared/types/mock-rule';

interface RulesCache {
  rules: MockRule[];
  timestamp: number;
}

const RULES_CACHE_TTL_MS = 60000; // 60 seconds

export class RuleStore {
  private cache: Map<string, RulesCache> = new Map();

  constructor(private sql: SqlStorage) {}

  listForEndpoint(endpointId: string): MockRule[] {
    const cached = this.cache.get(endpointId);
    const now = Date.now();

    if (cached && now - cached.timestamp < RULES_CACHE_TTL_MS) {
      return cached.rules;
    }

    const dbRules = this.sql
      .exec<DbMockRule>('SELECT * FROM mock_rules WHERE endpoint_id = ?', endpointId)
      .toArray();

    const rules = dbRules.map(this.mapDbRuleToRule);

    this.cache.set(endpointId, { rules, timestamp: now });

    return rules;
  }

  findById(id: string): MockRule | null {
    const dbRule = this.sql
      .exec<DbMockRule>('SELECT * FROM mock_rules WHERE id = ?', id)
      .toArray()[0];

    if (!dbRule) {
      return null;
    }

    return this.mapDbRuleToRule(dbRule);
  }

  create(input: CreateMockRuleRequest): MockRule {
    const id = generateRuleId();
    const now = new Date().toISOString();

    this.sql.exec(
      `INSERT INTO mock_rules (
        id, endpoint_id, priority, name, match_method, match_path, match_headers,
        response_status, response_headers, response_body, response_delay_ms, is_active,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.endpointId,
      input.priority ?? 0,
      input.name ?? null,
      input.matchMethod ?? null,
      input.matchPath ?? null,
      input.matchHeaders ? JSON.stringify(input.matchHeaders) : null,
      input.responseStatus ?? 200,
      input.responseHeaders ? JSON.stringify(input.responseHeaders) : null,
      input.responseBody,
      input.responseDelayMs ?? 0,
      input.isActive !== false ? 1 : 0,
      now,
      now
    );

    this.invalidateCache(input.endpointId);

    const dbRule = this.sql
      .exec<DbMockRule>('SELECT * FROM mock_rules WHERE id = ?', id)
      .toArray()[0];

    return this.mapDbRuleToRule(dbRule);
  }

  update(id: string, input: UpdateMockRuleRequest): MockRule | null {
    // Get current rule to get endpoint_id for cache invalidation
    const existingRule = this.sql
      .exec<DbMockRule>('SELECT * FROM mock_rules WHERE id = ?', id)
      .toArray()[0];

    if (!existingRule) {
      return null;
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.priority !== undefined) {
      updates.push('priority = ?');
      params.push(input.priority);
    }
    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
    }
    if (input.matchMethod !== undefined) {
      updates.push('match_method = ?');
      params.push(input.matchMethod);
    }
    if (input.matchPath !== undefined) {
      updates.push('match_path = ?');
      params.push(input.matchPath);
    }
    if (input.matchHeaders !== undefined) {
      updates.push('match_headers = ?');
      params.push(input.matchHeaders ? JSON.stringify(input.matchHeaders) : null);
    }
    if (input.responseStatus !== undefined) {
      updates.push('response_status = ?');
      params.push(input.responseStatus);
    }
    if (input.responseHeaders !== undefined) {
      updates.push('response_headers = ?');
      params.push(input.responseHeaders ? JSON.stringify(input.responseHeaders) : null);
    }
    if (input.responseBody !== undefined) {
      updates.push('response_body = ?');
      params.push(input.responseBody);
    }
    if (input.responseDelayMs !== undefined) {
      updates.push('response_delay_ms = ?');
      params.push(input.responseDelayMs);
    }
    if (input.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(input.isActive ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(id);

      this.sql.exec(
        `UPDATE mock_rules SET ${updates.join(', ')} WHERE id = ?`,
        ...params
      );

      this.invalidateCache(existingRule.endpoint_id);
    }

    const updatedRule = this.sql
      .exec<DbMockRule>('SELECT * FROM mock_rules WHERE id = ?', id)
      .toArray()[0];

    return this.mapDbRuleToRule(updatedRule);
  }

  delete(id: string): string | null {
    // Get rule to get endpoint_id for cache invalidation
    const existingRule = this.sql
      .exec<DbMockRule>('SELECT * FROM mock_rules WHERE id = ?', id)
      .toArray()[0];

    if (!existingRule) {
      return null;
    }

    this.sql.exec('DELETE FROM mock_rules WHERE id = ?', id);
    this.invalidateCache(existingRule.endpoint_id);

    return existingRule.endpoint_id;
  }

  invalidateCache(endpointId: string): void {
    this.cache.delete(endpointId);
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
}
