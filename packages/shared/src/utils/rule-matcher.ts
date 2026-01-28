import type { MockRule } from '../types/mock-rule';
import { matchPath, type PathMatch } from './path-matcher';

export interface RequestContext {
  method: string;
  path: string;
  headers: Record<string, string>;
}

export interface RuleMatchResult {
  rule: MockRule;
  pathParams: Record<string, string>;
}

/**
 * Match a request against a list of rules, returning the highest priority matching rule
 */
export function matchRule(
  rules: MockRule[],
  context: RequestContext,
  fallbackPathParams?: Record<string, string>
): RuleMatchResult | null {
  // Filter to active rules and sort by priority (higher priority first)
  const activeRules = rules
    .filter(rule => rule.isActive)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of activeRules) {
    const match = matchRuleAgainstContext(rule, context, fallbackPathParams);
    if (match) {
      return match;
    }
  }

  return null;
}

function matchRuleAgainstContext(
  rule: MockRule,
  context: RequestContext,
  fallbackPathParams?: Record<string, string>
): RuleMatchResult | null {
  // Check method match (null means match any)
  if (rule.matchMethod !== null && rule.matchMethod !== context.method) {
    return null;
  }

  // Check path match
  let pathParams: Record<string, string> = {};
  if (rule.matchPath !== null) {
    const pathMatch = matchPath(rule.matchPath, context.path);
    if (!pathMatch.matched) {
      return null;
    }
    pathParams = pathMatch.params;
  } else if (fallbackPathParams) {
    pathParams = fallbackPathParams;
  }

  // Check headers match
  if (rule.matchHeaders !== null) {
    if (!matchHeaders(rule.matchHeaders, context.headers)) {
      return null;
    }
  }

  return { rule, pathParams };
}

/**
 * Check if all required headers are present (case-insensitive matching)
 */
export function matchHeaders(
  required: Record<string, string>,
  actual: Record<string, string>
): boolean {
  // Normalize actual headers to lowercase keys
  const normalizedActual: Record<string, string> = {};
  for (const [key, value] of Object.entries(actual)) {
    normalizedActual[key.toLowerCase()] = value;
  }

  // Check each required header
  for (const [key, value] of Object.entries(required)) {
    const actualValue = normalizedActual[key.toLowerCase()];
    if (actualValue === undefined || actualValue !== value) {
      return false;
    }
  }

  return true;
}

/**
 * Interpolate path parameters into a response body
 * Replaces {{paramName}} with the corresponding param value
 */
export function interpolateParams(
  body: string,
  params: Record<string, string>
): string {
  let result = body;
  for (const [key, value] of Object.entries(params)) {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value);
  }
  return result;
}
