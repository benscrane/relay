import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { generateUserId } from '@relay/shared/utils';
import type { DbUser, DbMagicLinkToken, SendMagicLinkRequest } from '@relay/shared/types';
import type { Env } from './index';
import { mapDbUserToUser } from './auth';
import { createEmailService } from './email';

export const magicLinkRouter = new Hono<{ Bindings: Env }>();

// Token expiry: 15 minutes
const TOKEN_EXPIRY_MS = 15 * 60 * 1000;
// Session duration: 30 days
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
// Rate limit: 3 magic links per email per hour
const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

// Generate random token (32 bytes as hex)
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Hash token with SHA-256
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('');
}

// Generate session ID
function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Send magic link
magicLinkRouter.post('/send', async (c) => {
  const body = await c.req.json<SendMagicLinkRequest>();

  if (!body.email) {
    return c.json({ error: 'Email is required' }, 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return c.json({ error: 'Invalid email format' }, 400);
  }

  const email = body.email.toLowerCase().trim();

  // Rate limiting: check how many magic links sent in the last hour
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const recentTokens = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM magic_link_tokens WHERE email = ? AND created_at > ?'
  ).bind(email, oneHourAgo).first<{ count: number }>();

  if (recentTokens && recentTokens.count >= RATE_LIMIT_COUNT) {
    return c.json({ error: 'Too many requests. Please try again later.' }, 429);
  }

  // Generate token and hash
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const id = generateUserId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();

  // Store hashed token
  await c.env.DB.prepare(
    'INSERT INTO magic_link_tokens (id, email, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, email, tokenHash, expiresAt, now).run();

  // Send email with unhashed token
  try {
    const emailService = createEmailService(c.env);
    await emailService.sendMagicLink(email, token, c.env.APP_URL);
  } catch (err) {
    console.error('Failed to send magic link email:', err);
    return c.json({ error: 'Failed to send email. Please try again.' }, 500);
  }

  return c.json({ message: 'Magic link sent. Check your email.' });
});

// Verify magic link
magicLinkRouter.get('/verify', async (c) => {
  const token = c.req.query('token');

  if (!token) {
    return c.redirect(`${c.env.APP_URL}/login?error=invalid_token`);
  }

  // Hash the token to look up
  const tokenHash = await hashToken(token);

  // Find token in database
  const magicToken = await c.env.DB.prepare(
    'SELECT * FROM magic_link_tokens WHERE token_hash = ?'
  ).bind(tokenHash).first<DbMagicLinkToken>();

  if (!magicToken) {
    return c.redirect(`${c.env.APP_URL}/login?error=invalid_token`);
  }

  // Check if already used
  if (magicToken.used_at) {
    return c.redirect(`${c.env.APP_URL}/login?error=token_used`);
  }

  // Check if expired
  if (new Date(magicToken.expires_at) < new Date()) {
    return c.redirect(`${c.env.APP_URL}/login?error=token_expired`);
  }

  // Mark token as used
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'UPDATE magic_link_tokens SET used_at = ? WHERE id = ?'
  ).bind(now, magicToken.id).run();

  // Find or create user
  let user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(magicToken.email).first<DbUser>();

  if (!user) {
    // Create new user
    const userId = generateUserId();
    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, tier, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?)'
    ).bind(userId, magicToken.email, 'free', now, now).run();

    user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(userId).first<DbUser>();
  }

  // Create session
  const sessionId = generateSessionId();
  const sessionExpiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, user!.id, sessionExpiresAt, now).run();

  // Set session cookie
  setCookie(c, 'session', sessionId, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== 'development',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
    ...(c.env.COOKIE_DOMAIN && { domain: c.env.COOKIE_DOMAIN }),
  });

  // Redirect to app
  return c.redirect(c.env.APP_URL);
});
