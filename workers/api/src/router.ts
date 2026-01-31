import { Hono } from 'hono';
import { generateProjectId, validateEndpointInput } from '@mockd/shared/utils';
import type { DbProject, Project, CreateProjectRequest, CreateEndpointRequest, UpdateEndpointRequest } from '@mockd/shared/types';
import { TIER_LIMITS, type Tier } from '@mockd/shared/constants';
import type { Env } from './index';
import { authMiddleware, requireAuth } from './middleware';

export const router = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes (populates user context but doesn't require auth)
router.use('*', authMiddleware);

// Subdomain validation: lowercase alphanumeric with hyphens, 3-63 chars, can't start/end with hyphen
const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

// Helper: Get project by ID from D1
async function getProjectById(db: D1Database, projectId: string): Promise<DbProject | null> {
  return db.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first<DbProject>();
}

// Helper: Get DO name for a project
// For anonymous projects (no user), use the project ID
// For user-owned projects, use the subdomain
async function getProjectDOName(db: D1Database, projectId: string): Promise<string | null> {
  const project = await getProjectById(db, projectId);
  if (!project) return null;
  // Anonymous projects use their ID as the DO name (accessed via /m/{id}/...)
  // User-owned projects use their subdomain (accessed via {subdomain}.mockd.sh)
  return project.user_id ? project.subdomain : project.id;
}

// Helper: Get Durable Object stub by DO name (subdomain or project ID)
function getDOStub(env: Env, doName: string): DurableObjectStub {
  const doId = env.ENDPOINT_DO.idFromName(doName);
  return env.ENDPOINT_DO.get(doId);
}

// Helper: Transform DB row to API response
function mapDbProjectToProject(dbProject: DbProject): Project {
  return {
    id: dbProject.id,
    userId: dbProject.user_id,
    name: dbProject.name,
    subdomain: dbProject.subdomain,
    createdAt: dbProject.created_at,
    updatedAt: dbProject.updated_at,
  };
}

// Projects CRUD

router.get('/projects', async (c) => {
  const userId = c.get('userId');

  // Only show user's authenticated projects
  // Anonymous projects are private and fetched individually by ID (stored in browser localStorage)
  let result;
  if (userId) {
    result = await c.env.DB.prepare(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all<DbProject>();
  } else {
    // Unauthenticated users don't see any projects in the listing
    // They can still access their anonymous projects by ID
    return c.json({ data: [] });
  }

  const projects = (result.results ?? []).map(mapDbProjectToProject);
  return c.json({ data: projects });
});

// Create project (requires authentication)
router.post('/projects', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const user = c.get('user')!;
  const body = await c.req.json<CreateProjectRequest>();

  if (!body.name || !body.subdomain) {
    return c.json({ error: 'name and subdomain are required' }, 400);
  }

  // Check project limit based on user tier
  const userTier = (user.tier || 'free') as Tier;
  const tierLimit = TIER_LIMITS[userTier].projects;

  const projectCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM projects WHERE user_id = ?'
  ).bind(userId).first<{ count: number }>();

  if ((projectCount?.count ?? 0) >= tierLimit) {
    return c.json({
      error: `Project limit reached. ${userTier === 'free' ? 'Free tier' : `Your ${userTier} plan`} is limited to ${tierLimit} projects. Upgrade your plan to create more.`,
      code: 'PROJECT_LIMIT_REACHED',
      limit: tierLimit,
      currentCount: projectCount?.count ?? 0,
    }, 403);
  }

  const subdomain = body.subdomain.toLowerCase();

  if (!SUBDOMAIN_REGEX.test(subdomain)) {
    return c.json({ error: 'Invalid subdomain format. Must be 3-63 lowercase alphanumeric characters with hyphens, cannot start or end with hyphen.' }, 400);
  }

  const id = generateProjectId();
  const now = new Date().toISOString();

  try {
    await c.env.DB.prepare(
      'INSERT INTO projects (id, user_id, name, subdomain, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, userId, body.name, subdomain, now, now).run();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Subdomain already exists' }, 409);
    }
    throw error;
  }

  const project = await getProjectById(c.env.DB, id);
  if (!project) {
    return c.json({ error: 'Failed to create project' }, 500);
  }

  return c.json({ data: mapDbProjectToProject(project) }, 201);
});

// Create anonymous project (no auth required)
router.post('/projects/anonymous', async (c) => {
  const body = await c.req.json<{ name?: string }>();
  const id = generateProjectId();
  const now = new Date().toISOString();
  const name = body.name || 'Temporary Mock';

  // Anonymous projects use their ID as the subdomain (for uniqueness constraint)
  // They're accessed via /m/{id}/... path-based routing
  await c.env.DB.prepare(
    'INSERT INTO projects (id, user_id, name, subdomain, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?)'
  ).bind(id, name, id, now, now).run();

  const project = await getProjectById(c.env.DB, id);
  if (!project) {
    return c.json({ error: 'Failed to create project' }, 500);
  }

  return c.json({
    data: mapDbProjectToProject(project),
    mockUrl: `/m/${id}`,  // Base URL for path-based access
  }, 201);
});

router.get('/projects/:id', async (c) => {
  const projectId = c.req.param('id');
  const userId = c.get('userId');
  const project = await getProjectById(c.env.DB, projectId);

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Check access: allow if anonymous project or owned by user
  if (project.user_id && project.user_id !== userId) {
    return c.json({ error: 'Project not found' }, 404);
  }

  return c.json({ data: mapDbProjectToProject(project) });
});

router.put('/projects/:id', async (c) => {
  const projectId = c.req.param('id');
  const userId = c.get('userId');
  const project = await getProjectById(c.env.DB, projectId);

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Check ownership: only owner can update user-owned projects
  // Anonymous projects can be updated by anyone (they're ephemeral)
  if (project.user_id && project.user_id !== userId) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const body = await c.req.json<{ name?: string }>();
  const now = new Date().toISOString();

  if (body.name !== undefined) {
    await c.env.DB.prepare(
      'UPDATE projects SET name = ?, updated_at = ? WHERE id = ?'
    ).bind(body.name, now, projectId).run();
  }

  const updatedProject = await getProjectById(c.env.DB, projectId);
  if (!updatedProject) {
    return c.json({ error: 'Failed to update project' }, 500);
  }

  return c.json({ data: mapDbProjectToProject(updatedProject) });
});

router.delete('/projects/:id', async (c) => {
  const projectId = c.req.param('id');
  const userId = c.get('userId');
  const project = await getProjectById(c.env.DB, projectId);

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Check ownership: only owner can delete user-owned projects
  // Anonymous projects can be deleted by anyone (or we could restrict this)
  if (project.user_id && project.user_id !== userId) {
    return c.json({ error: 'Project not found' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run();

  return c.json({ success: true });
});

// Endpoints CRUD

router.get('/projects/:projectId/endpoints', async (c) => {
  const projectId = c.req.param('projectId');
  const subdomain = await getProjectDOName(c.env.DB, projectId);

  if (!subdomain) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const stub = getDOStub(c.env, subdomain);
  const response = await stub.fetch(
    new Request('http://internal/__internal/endpoints')
  );
  const data = await response.json();

  return c.json(data, response.status as 200);
});

router.post('/projects/:projectId/endpoints', async (c) => {
  const projectId = c.req.param('projectId');
  const project = await getProjectById(c.env.DB, projectId);

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const subdomain = project.user_id ? project.subdomain : project.id;

  // Determine user tier for endpoint limit
  let userTier: Tier = 'free';
  if (project.user_id) {
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(project.user_id)
      .first<{ tier: string }>();
    userTier = (user?.tier || 'free') as Tier;
  }

  const stub = getDOStub(c.env, subdomain);

  // Check endpoint limit before creating
  const endpointsResponse = await stub.fetch(
    new Request('http://internal/__internal/endpoints')
  );
  const endpointsData = await endpointsResponse.json() as { data: unknown[] };
  const currentEndpointCount = endpointsData.data?.length ?? 0;
  const endpointLimit = TIER_LIMITS[userTier].endpointsPerProject;

  if (currentEndpointCount >= endpointLimit) {
    return c.json({
      error: `Endpoint limit reached. ${userTier === 'free' ? 'Free tier' : `Your ${userTier} plan`} is limited to ${endpointLimit} endpoints per project. Upgrade your plan to create more.`,
      code: 'ENDPOINT_LIMIT_REACHED',
      limit: endpointLimit,
      currentCount: currentEndpointCount,
    }, 403);
  }

  const body = await c.req.json<CreateEndpointRequest>();

  // Validate input against tier limits
  const validation = validateEndpointInput(body, userTier, { requirePath: true });
  if (!validation.valid) {
    return c.json({
      error: validation.errors[0].error,
      code: validation.errors[0].code,
      field: validation.errors[0].field,
      ...(validation.errors[0].limit !== undefined && { limit: validation.errors[0].limit }),
      ...(validation.errors[0].actual !== undefined && { actual: validation.errors[0].actual }),
    }, 400);
  }

  const response = await stub.fetch(
    new Request('http://internal/__internal/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: body.path,
        response_body: body.responseBody,
        status_code: body.statusCode ?? 200,
        delay_ms: body.delay ?? 0,
      }),
    })
  );
  const data = await response.json();

  return c.json(data, response.status as 201);
});

router.put('/projects/:projectId/endpoints/:id', async (c) => {
  const projectId = c.req.param('projectId');
  const endpointId = c.req.param('id');
  const project = await getProjectById(c.env.DB, projectId);

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const subdomain = project.user_id ? project.subdomain : project.id;

  // Determine user tier for validation
  let userTier: Tier = 'free';
  if (project.user_id) {
    const user = await c.env.DB.prepare('SELECT tier FROM users WHERE id = ?')
      .bind(project.user_id)
      .first<{ tier: string }>();
    userTier = (user?.tier || 'free') as Tier;
  }

  const body = await c.req.json<UpdateEndpointRequest>();

  // Validate input against tier limits
  const validation = validateEndpointInput(body, userTier);
  if (!validation.valid) {
    return c.json({
      error: validation.errors[0].error,
      code: validation.errors[0].code,
      field: validation.errors[0].field,
      ...(validation.errors[0].limit !== undefined && { limit: validation.errors[0].limit }),
      ...(validation.errors[0].actual !== undefined && { actual: validation.errors[0].actual }),
    }, 400);
  }

  const stub = getDOStub(c.env, subdomain);
  const response = await stub.fetch(
    new Request(`http://internal/__internal/endpoints/${endpointId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_body: body.responseBody,
        status_code: body.statusCode,
        delay_ms: body.delay,
      }),
    })
  );
  const data = await response.json();

  return c.json(data, response.status as 200);
});

router.delete('/projects/:projectId/endpoints/:id', async (c) => {
  const projectId = c.req.param('projectId');
  const endpointId = c.req.param('id');
  const subdomain = await getProjectDOName(c.env.DB, projectId);

  if (!subdomain) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const stub = getDOStub(c.env, subdomain);
  const response = await stub.fetch(
    new Request(`http://internal/__internal/endpoints/${endpointId}`, {
      method: 'DELETE',
    })
  );
  const data = await response.json();

  return c.json(data, response.status as 200);
});

// Mock Rules

router.get('/projects/:projectId/endpoints/:endpointId/rules', async (c) => {
  const projectId = c.req.param('projectId');
  const endpointId = c.req.param('endpointId');
  const subdomain = await getProjectDOName(c.env.DB, projectId);

  if (!subdomain) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const stub = getDOStub(c.env, subdomain);
  const response = await stub.fetch(
    new Request(`http://internal/__internal/rules?endpointId=${endpointId}`)
  );
  const data = await response.json();

  return c.json(data, response.status as 200);
});

router.post('/projects/:projectId/endpoints/:endpointId/rules', async (c) => {
  const projectId = c.req.param('projectId');
  const endpointId = c.req.param('endpointId');
  const subdomain = await getProjectDOName(c.env.DB, projectId);

  if (!subdomain) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const body = await c.req.json();
  const stub = getDOStub(c.env, subdomain);
  const response = await stub.fetch(
    new Request('http://internal/__internal/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, endpointId }),
    })
  );
  const data = await response.json();

  return c.json(data, response.status as 201);
});

router.put('/projects/:projectId/endpoints/:endpointId/rules/:ruleId', async (c) => {
  const projectId = c.req.param('projectId');
  const ruleId = c.req.param('ruleId');
  const subdomain = await getProjectDOName(c.env.DB, projectId);

  if (!subdomain) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const body = await c.req.json();
  const stub = getDOStub(c.env, subdomain);
  const response = await stub.fetch(
    new Request(`http://internal/__internal/rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  const data = await response.json();

  return c.json(data, response.status as 200);
});

router.delete('/projects/:projectId/endpoints/:endpointId/rules/:ruleId', async (c) => {
  const projectId = c.req.param('projectId');
  const ruleId = c.req.param('ruleId');
  const subdomain = await getProjectDOName(c.env.DB, projectId);

  if (!subdomain) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const stub = getDOStub(c.env, subdomain);
  const response = await stub.fetch(
    new Request(`http://internal/__internal/rules/${ruleId}`, {
      method: 'DELETE',
    })
  );
  const data = await response.json();

  return c.json(data, response.status as 200);
});

// Request Logs

router.delete('/projects/:projectId/endpoints/:endpointId/logs', async (c) => {
  const projectId = c.req.param('projectId');
  const endpointId = c.req.param('endpointId');
  const subdomain = await getProjectDOName(c.env.DB, projectId);

  if (!subdomain) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const stub = getDOStub(c.env, subdomain);
  const response = await stub.fetch(
    new Request(`http://internal/__internal/logs?endpointId=${endpointId}`, {
      method: 'DELETE',
    })
  );
  const data = await response.json();

  return c.json(data, response.status as 200);
});
