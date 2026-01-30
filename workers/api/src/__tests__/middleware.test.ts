import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware, requireAuth } from '../middleware';
import type { Env } from '../index';
import {
  createMockDataStore,
  createMockEnv,
  createTestUser,
  createTestSession,
  makeRequest,
  type MockDataStore,
  type JsonResponse,
} from './test-utils';

describe('Middleware', () => {
  let store: MockDataStore;
  let env: Env;
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    store = createMockDataStore();
    env = createMockEnv(store);
  });

  describe('authMiddleware', () => {
    beforeEach(() => {
      app = new Hono<{ Bindings: Env }>();
      app.use('*', authMiddleware);
      app.get('/test', (c) => {
        const user = c.get('user');
        const userId = c.get('userId');
        return c.json({ user, userId });
      });
    });

    it('should set user and userId when valid session cookie is provided', async () => {
      const user = createTestUser(store, { id: 'user_123', email: 'test@example.com' });
      const session = createTestSession(store, user.id, { id: 'session_abc' });

      const request = makeRequest('/test', {
        cookie: `session=${session.id}`,
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(200);
      expect(data.userId).toBe(user.id);
      expect(data.user).toMatchObject({
        id: user.id,
        email: user.email,
        tier: user.tier,
      });
    });

    it('should set user and userId to null when no session cookie is provided', async () => {
      const request = makeRequest('/test');

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(200);
      expect(data.userId).toBeNull();
      expect(data.user).toBeNull();
    });

    it('should set user and userId to null when session is expired', async () => {
      const user = createTestUser(store, { id: 'user_123' });
      const session = createTestSession(store, user.id, {
        id: 'session_abc',
        expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
      });

      const request = makeRequest('/test', {
        cookie: `session=${session.id}`,
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(200);
      expect(data.userId).toBeNull();
      expect(data.user).toBeNull();
    });

    it('should set user and userId to null when session does not exist', async () => {
      const request = makeRequest('/test', {
        cookie: 'session=nonexistent_session',
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(200);
      expect(data.userId).toBeNull();
      expect(data.user).toBeNull();
    });
  });

  describe('requireAuth', () => {
    beforeEach(() => {
      app = new Hono<{ Bindings: Env }>();
      app.use('*', requireAuth);
      app.get('/protected', (c) => {
        const user = c.get('user');
        const userId = c.get('userId');
        return c.json({ user, userId });
      });
    });

    it('should allow access with valid session', async () => {
      const user = createTestUser(store, { id: 'user_123', email: 'test@example.com' });
      const session = createTestSession(store, user.id, { id: 'session_abc' });

      const request = makeRequest('/protected', {
        cookie: `session=${session.id}`,
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(200);
      expect(data.userId).toBe(user.id);
      expect(data.user).toMatchObject({
        id: user.id,
        email: user.email,
      });
    });

    it('should return 401 when no session cookie is provided', async () => {
      const request = makeRequest('/protected');

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 401 when session is invalid', async () => {
      const request = makeRequest('/protected', {
        cookie: 'session=invalid_session',
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid session');
    });

    it('should return 401 when session is expired', async () => {
      const user = createTestUser(store, { id: 'user_123' });
      const session = createTestSession(store, user.id, {
        id: 'session_abc',
        expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      const request = makeRequest('/protected', {
        cookie: `session=${session.id}`,
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid session');
    });
  });
});
