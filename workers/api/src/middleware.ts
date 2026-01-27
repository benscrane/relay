import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import type { DbUser, DbSession, User } from '@relay/shared/types';
import type { Env } from './index';

// Extend Hono's Variables type
declare module 'hono' {
  interface ContextVariableMap {
    user: User | null;
    userId: string | null;
  }
}

// Transform DbUser to API User type
function mapDbUserToUser(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    tier: dbUser.tier,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
  };
}

// Get user by session ID
async function getUserBySession(db: D1Database, sessionId: string): Promise<DbUser | null> {
  const session = await db.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<DbSession>();

  if (!session) return null;

  return db.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<DbUser>();
}

/**
 * Auth middleware that validates session and attaches user to context.
 * Does NOT block unauthenticated requests - use requireAuth for that.
 */
export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const sessionId = getCookie(c, 'session');

  if (sessionId) {
    const dbUser = await getUserBySession(c.env.DB, sessionId);
    if (dbUser) {
      c.set('user', mapDbUserToUser(dbUser));
      c.set('userId', dbUser.id);
    } else {
      c.set('user', null);
      c.set('userId', null);
    }
  } else {
    c.set('user', null);
    c.set('userId', null);
  }

  await next();
});

/**
 * Middleware that requires authentication.
 * Returns 401 if no valid session exists.
 */
export const requireAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const sessionId = getCookie(c, 'session');

  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const dbUser = await getUserBySession(c.env.DB, sessionId);
  if (!dbUser) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  c.set('user', mapDbUserToUser(dbUser));
  c.set('userId', dbUser.id);

  await next();
});
