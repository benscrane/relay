import { describe, it, expect, beforeEach } from 'vitest';
import { authRouter } from '../auth';
import { Hono } from 'hono';
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

describe('Auth Router', () => {
  let store: MockDataStore;
  let env: Env;
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    store = createMockDataStore();
    env = createMockEnv(store);
    app = new Hono<{ Bindings: Env }>();
    app.route('/api/auth', authRouter);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const request = makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          email: 'newuser@example.com',
          password: 'password123',
        },
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(201);
      expect(data.user).toBeDefined();
      expect((data.user as JsonResponse).email).toBe('newuser@example.com');
      expect((data.user as JsonResponse).tier).toBe('free');

      // Check session cookie is set
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('session=');
    });

    it('should return 400 when email is missing', async () => {
      const request = makeRequest('/api/auth/register', {
        method: 'POST',
        body: { password: 'password123' },
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email and password are required');
    });

    it('should return 400 when password is missing', async () => {
      const request = makeRequest('/api/auth/register', {
        method: 'POST',
        body: { email: 'test@example.com' },
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email and password are required');
    });

    it('should return 400 for invalid email format', async () => {
      const request = makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          email: 'invalid-email',
          password: 'password123',
        },
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email format');
    });

    it('should return 400 when password is too short', async () => {
      const request = makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: '1234567',
        },
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(400);
      expect(data.error).toBe('Password must be at least 8 characters');
    });

    it('should return 409 when email is already registered', async () => {
      createTestUser(store, { email: 'existing@example.com' });

      const request = makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          email: 'existing@example.com',
          password: 'password123',
        },
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(409);
      expect(data.error).toBe('Email already registered');
    });

    it('should normalize email to lowercase', async () => {
      const request = makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          email: 'TestUser@Example.COM',
          password: 'password123',
        },
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(201);
      expect((data.user as JsonResponse).email).toBe('testuser@example.com');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 when email or password is missing', async () => {
      const request = makeRequest('/api/auth/login', {
        method: 'POST',
        body: { email: 'test@example.com' },
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email and password are required');
    });

    it('should return 401 for non-existent user', async () => {
      const request = makeRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid email or password');
    });

    it('should return 401 for user without password hash', async () => {
      createTestUser(store, {
        email: 'oauth@example.com',
        password_hash: null,
      });

      const request = makeRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'oauth@example.com',
          password: 'password123',
        },
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid email or password');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid session', async () => {
      const user = createTestUser(store, { id: 'user_123' });
      const session = createTestSession(store, user.id, { id: 'session_abc' });

      const request = makeRequest('/api/auth/logout', {
        method: 'POST',
        cookie: `session=${session.id}`,
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Session should be deleted
      expect(store.sessions.has(session.id)).toBe(false);
    });

    it('should return success even without session', async () => {
      const request = makeRequest('/api/auth/logout', {
        method: 'POST',
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      const user = createTestUser(store, {
        id: 'user_123',
        email: 'test@example.com',
        tier: 'pro',
      });
      const session = createTestSession(store, user.id, { id: 'session_abc' });

      const request = makeRequest('/api/auth/me', {
        method: 'GET',
        cookie: `session=${session.id}`,
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(200);
      expect(data.user).toMatchObject({
        id: user.id,
        email: user.email,
        tier: 'pro',
      });
    });

    it('should return 401 when not authenticated', async () => {
      const request = makeRequest('/api/auth/me', {
        method: 'GET',
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('should return 401 when session is invalid', async () => {
      const request = makeRequest('/api/auth/me', {
        method: 'GET',
        cookie: 'session=invalid_session',
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('should return 401 when session is expired', async () => {
      const user = createTestUser(store, { id: 'user_123' });
      const session = createTestSession(store, user.id, {
        id: 'session_abc',
        expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      const request = makeRequest('/api/auth/me', {
        method: 'GET',
        cookie: `session=${session.id}`,
      });

      const response = await app.fetch(request, env);
      const data = await response.json() as JsonResponse;

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });
  });
});
