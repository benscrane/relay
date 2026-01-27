import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { generateUserId } from '@relay/shared/utils';
import type { DbUser, DbSession, LoginRequest, RegisterRequest, User } from '@relay/shared/types';
import type { Env } from './index';

export const authRouter = new Hono<{ Bindings: Env }>();

// Session duration: 30 days
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Password hashing using Web Crypto API (PBKDF2)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  // Store as salt:hash in base64
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `${saltB64}:${hashB64}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltB64, hashB64] = storedHash.split(':');
  if (!saltB64 || !hashB64) return false;

  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const storedHashBytes = Uint8Array.from(atob(hashB64), c => c.charCodeAt(0));

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashBytes = new Uint8Array(hash);
  if (hashBytes.length !== storedHashBytes.length) return false;

  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < hashBytes.length; i++) {
    result |= hashBytes[i] ^ storedHashBytes[i];
  }
  return result === 0;
}

// Generate session ID
function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
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

// Register new user
authRouter.post('/register', async (c) => {
  const body = await c.req.json<RegisterRequest>();

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return c.json({ error: 'Invalid email format' }, 400);
  }

  // Validate password length
  if (body.password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  const email = body.email.toLowerCase().trim();

  // Check if user already exists
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  if (existingUser) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const userId = generateUserId();
  const passwordHash = await hashPassword(body.password);
  const now = new Date().toISOString();

  // Create user
  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, email, passwordHash, 'free', now, now).run();

  // Create session
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, userId, expiresAt, now).run();

  // Set session cookie
  setCookie(c, 'session', sessionId, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== 'development',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
    ...(c.env.COOKIE_DOMAIN && { domain: c.env.COOKIE_DOMAIN }),
  });

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<DbUser>();

  return c.json({ user: mapDbUserToUser(user!) }, 201);
});

// Login
authRouter.post('/login', async (c) => {
  const body = await c.req.json<LoginRequest>();

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const email = body.email.toLowerCase().trim();

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first<DbUser>();

  if (!user || !user.password_hash) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const validPassword = await verifyPassword(body.password, user.password_hash);
  if (!validPassword) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Create session
  const sessionId = generateSessionId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, user.id, expiresAt, now).run();

  // Set session cookie
  setCookie(c, 'session', sessionId, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== 'development',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
    ...(c.env.COOKIE_DOMAIN && { domain: c.env.COOKIE_DOMAIN }),
  });

  return c.json({ user: mapDbUserToUser(user) });
});

// Logout
authRouter.post('/logout', async (c) => {
  const sessionId = getCookie(c, 'session');

  if (sessionId) {
    // Delete session from database
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();

    // Clear cookie
    deleteCookie(c, 'session', {
      path: '/',
      ...(c.env.COOKIE_DOMAIN && { domain: c.env.COOKIE_DOMAIN }),
    });
  }

  return c.json({ success: true });
});

// Get current user
authRouter.get('/me', async (c) => {
  const sessionId = getCookie(c, 'session');

  if (!sessionId) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const user = await getUserBySession(c.env.DB, sessionId);

  if (!user) {
    // Clear invalid session cookie
    deleteCookie(c, 'session', {
      path: '/',
      ...(c.env.COOKIE_DOMAIN && { domain: c.env.COOKIE_DOMAIN }),
    });
    return c.json({ error: 'Not authenticated' }, 401);
  }

  return c.json({ user: mapDbUserToUser(user) });
});

// Export helper for middleware
export { getUserBySession, mapDbUserToUser };
