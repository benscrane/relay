import { describe, it, expect, beforeEach } from 'vitest';
import app from '../index';
import type { Env } from '../index';
import {
  createMockDataStore,
  createMockEnv,
  makeRequest,
  type MockDataStore,
  type JsonResponse,
} from './test-utils';

describe('API Worker App', () => {
  let store: MockDataStore;
  let env: Env;

  beforeEach(() => {
    store = createMockDataStore();
    env = createMockEnv(store);
  });

  describe('Health Endpoint', () => {
    it('should return status ok from /health', async () => {
      const request = makeRequest('/health');

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
    });
  });

  describe('CORS', () => {
    it('should include CORS headers in response', async () => {
      const request = new Request('http://localhost/health', {
        headers: {
          Origin: 'http://localhost:5173',
        },
      });

      const response = await app.fetch(request, env);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should handle preflight OPTIONS requests', async () => {
      const request = new Request('http://localhost/api/projects', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      });

      const response = await app.fetch(request, env);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    });
  });

  describe('Route Registration', () => {
    it('should have auth routes mounted at /api/auth', async () => {
      const request = makeRequest('/api/auth/me');

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      // Should return 401 (not 404) indicating route exists
      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('should have api routes mounted at /api', async () => {
      const request = makeRequest('/api/projects');

      const response = await app.fetch(request, env);

      // Should return 200 (not 404) indicating route exists
      expect(response.status).toBe(200);
    });
  });
});
