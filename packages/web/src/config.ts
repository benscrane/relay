// Centralized configuration for URLs

/**
 * Get the base URL for the API worker
 */
export function getApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return 'http://localhost:8787';
  }
  return import.meta.env.VITE_API_URL || '';
}

/**
 * Get the base URL for the endpoint worker (mock API server)
 * In dev: http://localhost:8788
 * In prod: configured via VITE_ENDPOINT_URL (e.g., https://relay-endpoint-production.ben-crane.workers.dev)
 */
export function getEndpointBaseUrl(): string {
  if (import.meta.env.DEV) {
    return 'http://localhost:8788';
  }
  return import.meta.env.VITE_ENDPOINT_URL || '';
}

/**
 * Get the WebSocket URL for the endpoint worker
 */
export function getEndpointWebSocketUrl(): string {
  if (import.meta.env.DEV) {
    return 'ws://localhost:8788';
  }
  // Convert http(s) to ws(s)
  const httpUrl = import.meta.env.VITE_ENDPOINT_URL || '';
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
 * Get the DO name for a project (used in URL paths)
 * Anonymous projects use their ID, user-owned projects use their subdomain
 */
export function getProjectDoName(project: { id: string; userId: string | null; subdomain: string }): string {
  return project.userId ? project.subdomain : project.id;
}
