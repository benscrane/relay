import { EndpointDO } from './EndpointDO';

export { EndpointDO };

export interface Env {
  ENDPOINT_DO: DurableObjectNamespace;
  ENVIRONMENT: string;
  INTERNAL_API_SECRET: string; // Shared secret for authenticating internal DO requests
}

// Reserved subdomains that can't be used for projects
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'app', 'admin', 'mock', 'mockd']);

function extractSubdomain(request: Request, env: Env): { subdomain: string; pathPrefix: string } | null {
  const url = new URL(request.url);

  // Path-based routing: /m/{projectId}/...
  const pathMatch = url.pathname.match(/^\/m\/([^/]+)(\/.*)?$/);
  if (pathMatch) {
    return {
      subdomain: pathMatch[1],  // projectId becomes DO name
      pathPrefix: `/m/${pathMatch[1]}`  // strip this from forwarded request
    };
  }

  // Local development: use X-Subdomain header or ?_subdomain query param
  if (env.ENVIRONMENT === 'development' || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    const headerSubdomain = request.headers.get('X-Subdomain');
    if (headerSubdomain) return { subdomain: headerSubdomain, pathPrefix: '' };

    const querySubdomain = url.searchParams.get('_subdomain');
    if (querySubdomain) return { subdomain: querySubdomain, pathPrefix: '' };
  }

  // Production: extract from Host header
  // Supports: my-app.mockd.sh, my-app.mock.mockd.sh
  const host = url.hostname;
  const parts = host.split('.');

  // Need at least subdomain.domain.tld
  if (parts.length < 3) return null;

  const subdomain = parts[0];
  return { subdomain, pathPrefix: '' };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Block external access to internal endpoints
    // These should only be accessed via the API worker with proper authentication
    if (url.pathname.startsWith('/__internal/')) {
      return Response.json(
        { error: 'Not found' },
        { status: 404 }
      );
    }

    const result = extractSubdomain(request, env);

    if (!result) {
      return Response.json(
        { error: 'Missing subdomain or project ID. Use /m/{projectId}/path, X-Subdomain header, or ?_subdomain param.' },
        { status: 400 }
      );
    }

    const { subdomain, pathPrefix } = result;

    if (RESERVED_SUBDOMAINS.has(subdomain.toLowerCase())) {
      return Response.json(
        { error: `'${subdomain}' is reserved` },
        { status: 400 }
      );
    }

    const id = env.ENDPOINT_DO.idFromName(subdomain);
    const stub = env.ENDPOINT_DO.get(id);

    // Strip path prefix for /m/ routes so DO sees clean paths
    if (pathPrefix) {
      const strippedPath = url.pathname.slice(pathPrefix.length) || '/';

      // Also block internal endpoints via /m/{id}/__internal/ path
      if (strippedPath.startsWith('/__internal/')) {
        return Response.json(
          { error: 'Not found' },
          { status: 404 }
        );
      }

      url.pathname = strippedPath;
      return stub.fetch(new Request(url.toString(), request));
    }

    return stub.fetch(request);
  },
};
