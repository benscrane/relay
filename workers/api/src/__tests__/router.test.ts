import { describe, it, expect, beforeEach } from 'vitest';
import { router } from '../router';
import { Hono } from 'hono';
import type { Env } from '../index';
import {
  createMockDataStore,
  createMockEnv,
  createTestUser,
  createTestSession,
  createTestProject,
  makeRequest,
  type MockDataStore,
  type JsonResponse,
} from './test-utils';

describe('API Router', () => {
  let store: MockDataStore;
  let env: Env;
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    store = createMockDataStore();
    env = createMockEnv(store);
    app = new Hono<{ Bindings: Env }>();
    app.route('/api', router);
  });

  describe('Projects CRUD', () => {
    describe('GET /api/projects', () => {
      it('should return empty array for unauthenticated users', async () => {
        const request = makeRequest('/api/projects');

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(200);
        expect(data.data).toEqual([]);
      });

      it('should return user projects when authenticated', async () => {
        const user = createTestUser(store, { id: 'user_123' });
        const session = createTestSession(store, user.id, { id: 'session_abc' });
        createTestProject(store, {
          id: 'proj_1',
          user_id: user.id,
          name: 'Project 1',
          subdomain: 'project-1',
        });
        createTestProject(store, {
          id: 'proj_2',
          user_id: user.id,
          name: 'Project 2',
          subdomain: 'project-2',
        });

        const request = makeRequest('/api/projects', {
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(200);
        expect(data.data).toHaveLength(2);
        expect((data.data as JsonResponse[])[0].name).toBeDefined();
      });

      it('should not return other users projects', async () => {
        const user1 = createTestUser(store, { id: 'user_1', email: 'user1@example.com' });
        const user2 = createTestUser(store, { id: 'user_2', email: 'user2@example.com' });
        const session = createTestSession(store, user1.id, { id: 'session_abc' });

        createTestProject(store, { id: 'proj_1', user_id: user1.id, subdomain: 'sub1' });
        createTestProject(store, { id: 'proj_2', user_id: user2.id, subdomain: 'sub2' });

        const request = makeRequest('/api/projects', {
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(200);
        expect(data.data).toHaveLength(1);
        expect((data.data as JsonResponse[])[0].id).toBe('proj_1');
      });
    });

    describe('POST /api/projects', () => {
      it('should create project when authenticated', async () => {
        const user = createTestUser(store, { id: 'user_123' });
        const session = createTestSession(store, user.id, { id: 'session_abc' });

        const request = makeRequest('/api/projects', {
          method: 'POST',
          body: {
            name: 'My Project',
            subdomain: 'my-project',
          },
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(201);
        expect((data.data as JsonResponse).name).toBe('My Project');
        expect((data.data as JsonResponse).subdomain).toBe('my-project');
        expect((data.data as JsonResponse).userId).toBe(user.id);
      });

      it('should return 401 when not authenticated', async () => {
        const request = makeRequest('/api/projects', {
          method: 'POST',
          body: {
            name: 'My Project',
            subdomain: 'my-project',
          },
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(401);
        expect(data.error).toBe('Authentication required');
      });

      it('should return 400 when name is missing', async () => {
        const user = createTestUser(store, { id: 'user_123' });
        const session = createTestSession(store, user.id, { id: 'session_abc' });

        const request = makeRequest('/api/projects', {
          method: 'POST',
          body: { subdomain: 'my-project' },
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(400);
        expect(data.error).toBe('name and subdomain are required');
      });

      it('should return 400 when subdomain is missing', async () => {
        const user = createTestUser(store, { id: 'user_123' });
        const session = createTestSession(store, user.id, { id: 'session_abc' });

        const request = makeRequest('/api/projects', {
          method: 'POST',
          body: { name: 'My Project' },
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(400);
        expect(data.error).toBe('name and subdomain are required');
      });

      it('should return 400 for invalid subdomain format', async () => {
        const user = createTestUser(store, { id: 'user_123' });
        const session = createTestSession(store, user.id, { id: 'session_abc' });

        const request = makeRequest('/api/projects', {
          method: 'POST',
          body: {
            name: 'My Project',
            subdomain: '-invalid',
          },
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(400);
        expect(data.error).toContain('Invalid subdomain format');
      });

      it('should return 400 for subdomain too short', async () => {
        const user = createTestUser(store, { id: 'user_123' });
        const session = createTestSession(store, user.id, { id: 'session_abc' });

        const request = makeRequest('/api/projects', {
          method: 'POST',
          body: {
            name: 'My Project',
            subdomain: 'ab',
          },
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(400);
        expect(data.error).toContain('Invalid subdomain format');
      });

      it('should return 409 when subdomain already exists', async () => {
        const user = createTestUser(store, { id: 'user_123' });
        const session = createTestSession(store, user.id, { id: 'session_abc' });
        createTestProject(store, { subdomain: 'taken-subdomain' });

        const request = makeRequest('/api/projects', {
          method: 'POST',
          body: {
            name: 'My Project',
            subdomain: 'taken-subdomain',
          },
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(409);
        expect(data.error).toBe('Subdomain already exists');
      });

      it('should normalize subdomain to lowercase', async () => {
        const user = createTestUser(store, { id: 'user_123' });
        const session = createTestSession(store, user.id, { id: 'session_abc' });

        const request = makeRequest('/api/projects', {
          method: 'POST',
          body: {
            name: 'My Project',
            subdomain: 'My-Project',
          },
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(201);
        expect((data.data as JsonResponse).subdomain).toBe('my-project');
      });

      it('should allow free tier user to create up to 3 projects', async () => {
        const user = createTestUser(store, { id: 'user_123', tier: 'free' });
        const session = createTestSession(store, user.id, { id: 'session_abc' });

        // Create 3 projects (the free tier limit)
        for (let i = 1; i <= 3; i++) {
          const request = makeRequest('/api/projects', {
            method: 'POST',
            body: {
              name: `Project ${i}`,
              subdomain: `project-${i}`,
            },
            cookie: `session=${session.id}`,
          });

          const response = await app.fetch(request, env);
          expect(response.status).toBe(201);
        }

        // Verify all 3 projects were created
        expect(store.projects.size).toBe(3);
      });

      it('should return 403 when free tier user exceeds project limit', async () => {
        const user = createTestUser(store, { id: 'user_123', tier: 'free' });
        const session = createTestSession(store, user.id, { id: 'session_abc' });

        // Pre-create 3 projects (at the limit)
        createTestProject(store, { id: 'proj_1', user_id: user.id, subdomain: 'existing-1' });
        createTestProject(store, { id: 'proj_2', user_id: user.id, subdomain: 'existing-2' });
        createTestProject(store, { id: 'proj_3', user_id: user.id, subdomain: 'existing-3' });

        // Try to create a 4th project
        const request = makeRequest('/api/projects', {
          method: 'POST',
          body: {
            name: 'Project 4',
            subdomain: 'project-four',
          },
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(403);
        expect(data.error).toContain('Project limit reached');
        expect(data.code).toBe('PROJECT_LIMIT_REACHED');
        expect(data.limit).toBe(3);
        expect(data.currentCount).toBe(3);
      });

      it('should allow pro tier user to create more than 3 projects', async () => {
        const user = createTestUser(store, { id: 'user_pro', tier: 'pro' });
        const session = createTestSession(store, user.id, { id: 'session_pro' });

        // Pre-create 3 projects
        createTestProject(store, { id: 'proj_1', user_id: user.id, subdomain: 'pro-1' });
        createTestProject(store, { id: 'proj_2', user_id: user.id, subdomain: 'pro-2' });
        createTestProject(store, { id: 'proj_3', user_id: user.id, subdomain: 'pro-3' });

        // Pro user should be able to create a 4th project
        const request = makeRequest('/api/projects', {
          method: 'POST',
          body: {
            name: 'Project 4',
            subdomain: 'pro-project-4',
          },
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(201);
        expect((data.data as JsonResponse).name).toBe('Project 4');
      });

      it('should not count other users projects towards limit', async () => {
        const user1 = createTestUser(store, { id: 'user_1', email: 'user1@example.com', tier: 'free' });
        const user2 = createTestUser(store, { id: 'user_2', email: 'user2@example.com', tier: 'free' });
        const session = createTestSession(store, user1.id, { id: 'session_1' });

        // Create 3 projects for user2 (should not affect user1's limit)
        createTestProject(store, { id: 'proj_u2_1', user_id: user2.id, subdomain: 'user2-1' });
        createTestProject(store, { id: 'proj_u2_2', user_id: user2.id, subdomain: 'user2-2' });
        createTestProject(store, { id: 'proj_u2_3', user_id: user2.id, subdomain: 'user2-3' });

        // User1 should still be able to create their projects
        const request = makeRequest('/api/projects', {
          method: 'POST',
          body: {
            name: 'User1 Project',
            subdomain: 'user1-project',
          },
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        expect(response.status).toBe(201);
      });
    });

    describe('POST /api/projects/anonymous', () => {
      it('should create anonymous project without authentication', async () => {
        const request = makeRequest('/api/projects/anonymous', {
          method: 'POST',
          body: { name: 'Anonymous Project' },
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(201);
        expect((data.data as JsonResponse).name).toBe('Anonymous Project');
        expect((data.data as JsonResponse).userId).toBeNull();
        expect(data.mockUrl).toContain('/m/');
      });

      it('should create anonymous project with default name', async () => {
        const request = makeRequest('/api/projects/anonymous', {
          method: 'POST',
          body: {},
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(201);
        expect((data.data as JsonResponse).name).toBe('Temporary Mock');
      });
    });

    describe('GET /api/projects/:id', () => {
      it('should return project by ID for owner', async () => {
        const user = createTestUser(store, { id: 'user_123' });
        const session = createTestSession(store, user.id, { id: 'session_abc' });
        const project = createTestProject(store, {
          id: 'proj_abc',
          user_id: user.id,
          name: 'My Project',
          subdomain: 'my-project',
        });

        const request = makeRequest(`/api/projects/${project.id}`, {
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(200);
        expect((data.data as JsonResponse).id).toBe(project.id);
        expect((data.data as JsonResponse).name).toBe('My Project');
      });

      it('should return anonymous project without authentication', async () => {
        const project = createTestProject(store, {
          id: 'proj_anon',
          user_id: null,
          name: 'Anonymous Project',
          subdomain: 'proj_anon',
        });

        const request = makeRequest(`/api/projects/${project.id}`);

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(200);
        expect((data.data as JsonResponse).id).toBe(project.id);
      });

      it('should return 404 for non-existent project', async () => {
        const request = makeRequest('/api/projects/nonexistent');

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(404);
        expect(data.error).toBe('Project not found');
      });

      it('should return 404 when accessing another users project', async () => {
        const user1 = createTestUser(store, { id: 'user_1', email: 'user1@example.com' });
        const user2 = createTestUser(store, { id: 'user_2', email: 'user2@example.com' });
        const session = createTestSession(store, user1.id, { id: 'session_abc' });
        const project = createTestProject(store, {
          id: 'proj_other',
          user_id: user2.id,
          subdomain: 'other-project',
        });

        const request = makeRequest(`/api/projects/${project.id}`, {
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(404);
        expect(data.error).toBe('Project not found');
      });
    });

    describe('DELETE /api/projects/:id', () => {
      it('should delete project for owner', async () => {
        const user = createTestUser(store, { id: 'user_123' });
        const session = createTestSession(store, user.id, { id: 'session_abc' });
        const project = createTestProject(store, {
          id: 'proj_to_delete',
          user_id: user.id,
          subdomain: 'to-delete',
        });

        const request = makeRequest(`/api/projects/${project.id}`, {
          method: 'DELETE',
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(store.projects.has(project.id)).toBe(false);
      });

      it('should delete anonymous project', async () => {
        const project = createTestProject(store, {
          id: 'proj_anon',
          user_id: null,
          subdomain: 'proj_anon',
        });

        const request = makeRequest(`/api/projects/${project.id}`, {
          method: 'DELETE',
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it('should return 404 for non-existent project', async () => {
        const request = makeRequest('/api/projects/nonexistent', {
          method: 'DELETE',
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(404);
        expect(data.error).toBe('Project not found');
      });

      it('should return 404 when deleting another users project', async () => {
        const user1 = createTestUser(store, { id: 'user_1', email: 'user1@example.com' });
        const user2 = createTestUser(store, { id: 'user_2', email: 'user2@example.com' });
        const session = createTestSession(store, user1.id, { id: 'session_abc' });
        const project = createTestProject(store, {
          id: 'proj_other',
          user_id: user2.id,
          subdomain: 'other-project',
        });

        const request = makeRequest(`/api/projects/${project.id}`, {
          method: 'DELETE',
          cookie: `session=${session.id}`,
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(404);
        expect(data.error).toBe('Project not found');
      });
    });
  });

  describe('Endpoints CRUD', () => {
    describe('GET /api/projects/:projectId/endpoints', () => {
      it('should return endpoints for a project', async () => {
        const project = createTestProject(store, {
          id: 'proj_123',
          user_id: null,
          subdomain: 'proj_123',
        });

        const request = makeRequest(`/api/projects/${project.id}/endpoints`);

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(200);
        expect(data.data).toBeInstanceOf(Array);
      });

      it('should return 404 for non-existent project', async () => {
        const request = makeRequest('/api/projects/nonexistent/endpoints');

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(404);
        expect(data.error).toBe('Project not found');
      });
    });

    describe('POST /api/projects/:projectId/endpoints', () => {
      it('should create endpoint for a project', async () => {
        const project = createTestProject(store, {
          id: 'proj_123',
          user_id: null,
          subdomain: 'proj_123',
        });

        const request = makeRequest(`/api/projects/${project.id}/endpoints`, {
          method: 'POST',
          body: {
            path: '/users',
            responseBody: '{"users": []}',
            statusCode: 200,
            delay: 0,
          },
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(201);
        expect((data.data as JsonResponse).path).toBe('/users');
      });

      it('should return 404 for non-existent project', async () => {
        const request = makeRequest('/api/projects/nonexistent/endpoints', {
          method: 'POST',
          body: {
            path: '/users',
            responseBody: '{}',
          },
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(404);
        expect(data.error).toBe('Project not found');
      });

      it('should allow free tier user to create up to 3 endpoints', async () => {
        const user = createTestUser(store, { id: 'user_123', tier: 'free' });
        const project = createTestProject(store, {
          id: 'proj_123',
          user_id: user.id,
          subdomain: 'test-project',
        });

        // Create 3 endpoints (the free tier limit)
        for (let i = 1; i <= 3; i++) {
          const request = makeRequest(`/api/projects/${project.id}/endpoints`, {
            method: 'POST',
            body: {
              path: `/endpoint-${i}`,
              responseBody: '{}',
            },
          });

          const response = await app.fetch(request, env);
          expect(response.status).toBe(201);
        }
      });

      it('should return 403 when free tier user exceeds endpoint limit', async () => {
        const user = createTestUser(store, { id: 'user_123', tier: 'free' });
        const project = createTestProject(store, {
          id: 'proj_123',
          user_id: user.id,
          subdomain: 'test-project',
        });

        // Create 3 endpoints (at the limit)
        for (let i = 1; i <= 3; i++) {
          const request = makeRequest(`/api/projects/${project.id}/endpoints`, {
            method: 'POST',
            body: {
              path: `/endpoint-${i}`,
              responseBody: '{}',
            },
          });
          const response = await app.fetch(request, env);
          expect(response.status).toBe(201);
        }

        // Verify 3 endpoints exist by fetching them
        const listRequest = makeRequest(`/api/projects/${project.id}/endpoints`);
        const listResponse = await app.fetch(listRequest, env);
        const listData = await listResponse.json() as JsonResponse;
        expect((listData.data as unknown[]).length).toBe(3);

        // Try to create a 4th endpoint
        const request = makeRequest(`/api/projects/${project.id}/endpoints`, {
          method: 'POST',
          body: {
            path: '/endpoint-4',
            responseBody: '{}',
          },
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(403);
        expect(data.error).toContain('Endpoint limit reached');
        expect(data.code).toBe('ENDPOINT_LIMIT_REACHED');
        expect(data.limit).toBe(3);
        expect(data.currentCount).toBe(3);
      });

      it('should allow pro tier user to create more than 3 endpoints', async () => {
        const user = createTestUser(store, { id: 'user_pro', tier: 'pro' });
        const project = createTestProject(store, {
          id: 'proj_pro',
          user_id: user.id,
          subdomain: 'pro-project',
        });

        // Create 4 endpoints (exceeds free tier limit but within pro limit)
        for (let i = 1; i <= 4; i++) {
          const request = makeRequest(`/api/projects/${project.id}/endpoints`, {
            method: 'POST',
            body: {
              path: `/endpoint-${i}`,
              responseBody: '{}',
            },
          });

          const response = await app.fetch(request, env);
          expect(response.status).toBe(201);
        }
      });

      it('should apply free tier limit to anonymous projects', async () => {
        const project = createTestProject(store, {
          id: 'proj_anon',
          user_id: null,
          subdomain: 'proj_anon',
        });

        // Create 3 endpoints (at the limit)
        for (let i = 1; i <= 3; i++) {
          const request = makeRequest(`/api/projects/${project.id}/endpoints`, {
            method: 'POST',
            body: {
              path: `/endpoint-${i}`,
              responseBody: '{}',
            },
          });
          const response = await app.fetch(request, env);
          expect(response.status).toBe(201);
        }

        // Try to create a 4th endpoint
        const request = makeRequest(`/api/projects/${project.id}/endpoints`, {
          method: 'POST',
          body: {
            path: '/endpoint-4',
            responseBody: '{}',
          },
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(403);
        expect(data.code).toBe('ENDPOINT_LIMIT_REACHED');
      });
    });

    describe('PUT /api/projects/:projectId/endpoints/:id', () => {
      it('should return 404 for non-existent project', async () => {
        const request = makeRequest('/api/projects/nonexistent/endpoints/ep_123', {
          method: 'PUT',
          body: {
            responseBody: '{"updated": true}',
          },
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(404);
        expect(data.error).toBe('Project not found');
      });
    });

    describe('DELETE /api/projects/:projectId/endpoints/:id', () => {
      it('should return 404 for non-existent project', async () => {
        const request = makeRequest('/api/projects/nonexistent/endpoints/ep_123', {
          method: 'DELETE',
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(404);
        expect(data.error).toBe('Project not found');
      });
    });
  });

  describe('Mock Rules CRUD', () => {
    describe('GET /api/projects/:projectId/endpoints/:endpointId/rules', () => {
      it('should return rules for an endpoint', async () => {
        const project = createTestProject(store, {
          id: 'proj_123',
          user_id: null,
          subdomain: 'proj_123',
        });

        const request = makeRequest(`/api/projects/${project.id}/endpoints/ep_123/rules`);

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(200);
        expect(data.data).toBeInstanceOf(Array);
      });

      it('should return 404 for non-existent project', async () => {
        const request = makeRequest('/api/projects/nonexistent/endpoints/ep_123/rules');

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(404);
        expect(data.error).toBe('Project not found');
      });
    });

    describe('POST /api/projects/:projectId/endpoints/:endpointId/rules', () => {
      it('should create rule for an endpoint', async () => {
        const project = createTestProject(store, {
          id: 'proj_123',
          user_id: null,
          subdomain: 'proj_123',
        });

        const request = makeRequest(`/api/projects/${project.id}/endpoints/ep_123/rules`, {
          method: 'POST',
          body: {
            condition: { header: 'X-Test', value: 'true' },
            responseBody: '{"test": true}',
            statusCode: 200,
          },
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(201);
        expect(data.data).toBeDefined();
        expect((data.data as JsonResponse).endpointId).toBe('ep_123');
      });

      it('should return 404 for non-existent project', async () => {
        const request = makeRequest('/api/projects/nonexistent/endpoints/ep_123/rules', {
          method: 'POST',
          body: {},
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(404);
        expect(data.error).toBe('Project not found');
      });
    });

    describe('PUT /api/projects/:projectId/endpoints/:endpointId/rules/:ruleId', () => {
      it('should return 404 for non-existent project', async () => {
        const request = makeRequest('/api/projects/nonexistent/endpoints/ep_123/rules/rule_123', {
          method: 'PUT',
          body: {},
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(404);
        expect(data.error).toBe('Project not found');
      });
    });

    describe('DELETE /api/projects/:projectId/endpoints/:endpointId/rules/:ruleId', () => {
      it('should return 404 for non-existent project', async () => {
        const request = makeRequest('/api/projects/nonexistent/endpoints/ep_123/rules/rule_123', {
          method: 'DELETE',
        });

        const response = await app.fetch(request, env);
        const data = await response.json() as JsonResponse;

        expect(response.status).toBe(404);
        expect(data.error).toBe('Project not found');
      });
    });
  });
});
