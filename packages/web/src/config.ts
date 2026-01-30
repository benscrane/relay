// Centralized configuration for URLs

/** Strip trailing slashes from URLs */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Get the base URL for the API worker
 */
export function getApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return 'http://localhost:8787';
  }
  return stripTrailingSlash(import.meta.env.VITE_API_URL || '');
}

/**
 * Get the base URL for the endpoint worker (mock API server)
 * In dev: http://localhost:8788
 * In prod: configured via VITE_ENDPOINT_URL (e.g., https://mockd-endpoint-production.ben-crane.workers.dev)
 */
export function getEndpointBaseUrl(): string {
  if (import.meta.env.DEV) {
    return 'http://localhost:8788';
  }
  return stripTrailingSlash(import.meta.env.VITE_ENDPOINT_URL || '');
}

/**
 * Get the WebSocket URL for the endpoint worker
 */
export function getEndpointWebSocketUrl(): string {
  if (import.meta.env.DEV) {
    return 'ws://localhost:8788';
  }
  // Convert http(s) to ws(s)
  const httpUrl = stripTrailingSlash(import.meta.env.VITE_ENDPOINT_URL || '');
  return httpUrl.replace(/^http/, 'ws');
}

/**
 * Get the full mock API URL for a project
 * @param doName - The Durable Object name (project ID for anonymous, subdomain for user-owned)
 */
export function getMockApiUrl(doName: string): string {
  return `${getEndpointBaseUrl()}/m/${doName}`;
}

/**
 * Get the subdomain-style mock API URL for display
 * @param subdomain - The project subdomain
 */
export function getMockApiSubdomainUrl(subdomain: string): string {
  if (import.meta.env.DEV) {
    return `http://localhost:8788/m/${subdomain}`;
  }
  return `https://${subdomain}.mockd.sh`;
}

/**
 * Get the DO name for a project (used in URL paths)
 * Anonymous projects use their ID, user-owned projects use their subdomain
 */
export function getProjectDoName(project: { id: string; userId: string | null; subdomain: string }): string {
  return project.userId ? project.subdomain : project.id;
}
