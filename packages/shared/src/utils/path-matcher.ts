export interface PathMatch {
  matched: boolean;
  params: Record<string, string>;
}

export function matchPath(pattern: string, path: string): PathMatch {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return { matched: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(':')) {
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
    } else if (patternPart !== pathPart) {
      return { matched: false, params: {} };
    }
  }

  return { matched: true, params };
}

export function normalizePath(path: string): string {
  let normalized = path.startsWith('/') ? path : `/${path}`;
  normalized = normalized.replace(/\/+/g, '/');
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function calculatePathSpecificity(pattern: string): number {
  const parts = pattern.split('/').filter(Boolean);
  let score = 0;
  for (const part of parts) {
    score += part.startsWith(':') ? 1 : 2;
  }
  return score;
}
