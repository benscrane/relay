import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { generateUserId } from '@relay/shared/utils';
import type { DbUser, DbOAuthState, DbOAuthConnection } from '@relay/shared/types';
import type { Env } from './index';
import { mapDbUserToUser } from './auth';

export const oauthRouter = new Hono<{ Bindings: Env }>();

// State expiry: 5 minutes
const STATE_EXPIRY_MS = 5 * 60 * 1000;
// Session duration: 30 days
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Generate random state/verifier
function generateRandomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Generate PKCE code challenge from verifier
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  // Base64url encode the hash
  const hashArray = new Uint8Array(hashBuffer);
  const base64 = btoa(String.fromCharCode(...hashArray));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Generate session ID
function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// GitHub OAuth: initiate
oauthRouter.get('/github', async (c) => {
  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(32);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const id = generateUserId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + STATE_EXPIRY_MS).toISOString();

  // Store state and code verifier
  await c.env.DB.prepare(
    'INSERT INTO oauth_states (id, state, provider, code_verifier, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, state, 'github', codeVerifier, expiresAt, now).run();

  // Build GitHub OAuth URL
  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: `${c.env.API_URL}/api/auth/github/callback`,
    scope: 'user:email',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// GitHub OAuth: callback
oauthRouter.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`${c.env.APP_URL}/login?error=oauth_denied`);
  }

  if (!code || !state) {
    return c.redirect(`${c.env.APP_URL}/login?error=invalid_callback`);
  }

  // Validate state
  const oauthState = await c.env.DB.prepare(
    'SELECT * FROM oauth_states WHERE state = ?'
  ).bind(state).first<DbOAuthState>();

  if (!oauthState) {
    return c.redirect(`${c.env.APP_URL}/login?error=invalid_state`);
  }

  // Check if state expired
  if (new Date(oauthState.expires_at) < new Date()) {
    await c.env.DB.prepare('DELETE FROM oauth_states WHERE id = ?').bind(oauthState.id).run();
    return c.redirect(`${c.env.APP_URL}/login?error=state_expired`);
  }

  // Delete used state
  await c.env.DB.prepare('DELETE FROM oauth_states WHERE id = ?').bind(oauthState.id).run();

  // Exchange code for access token
  const tokenParams = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    client_secret: c.env.GITHUB_CLIENT_SECRET,
    code: code,
    redirect_uri: `${c.env.API_URL}/api/auth/github/callback`,
  });

  // Add code_verifier if PKCE was used
  if (oauthState.code_verifier) {
    tokenParams.append('code_verifier', oauthState.code_verifier);
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  });

  const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

  if (!tokenData.access_token) {
    console.error('GitHub token exchange failed:', tokenData);
    return c.redirect(`${c.env.APP_URL}/login?error=token_exchange_failed`);
  }

  // Fetch user info from GitHub
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Relay-App',
    },
  });

  const githubUser = await userResponse.json() as { id: number; email?: string; login: string };

  // Fetch user emails if primary email is not public
  let email = githubUser.email;
  if (!email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Relay-App',
      },
    });

    const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
    const primaryEmail = emails.find(e => e.primary && e.verified);
    email = primaryEmail?.email;
  }

  if (!email) {
    return c.redirect(`${c.env.APP_URL}/login?error=no_email`);
  }

  const now = new Date().toISOString();

  // Check if OAuth connection exists
  let connection = await c.env.DB.prepare(
    'SELECT * FROM oauth_connections WHERE provider = ? AND provider_user_id = ?'
  ).bind('github', String(githubUser.id)).first<DbOAuthConnection>();

  let user: DbUser | null = null;

  if (connection) {
    // Get user from existing connection
    user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(connection.user_id).first<DbUser>();

    // Update connection email if changed
    if (connection.provider_email !== email) {
      await c.env.DB.prepare(
        'UPDATE oauth_connections SET provider_email = ?, updated_at = ? WHERE id = ?'
      ).bind(email, now, connection.id).run();
    }
  } else {
    // Check if user exists by email
    user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<DbUser>();

    if (!user) {
      // Create new user
      const userId = generateUserId();
      await c.env.DB.prepare(
        'INSERT INTO users (id, email, password_hash, tier, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?)'
      ).bind(userId, email.toLowerCase(), 'free', now, now).run();

      user = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(userId).first<DbUser>();
    }

    // Create OAuth connection
    const connectionId = generateUserId();
    await c.env.DB.prepare(
      'INSERT INTO oauth_connections (id, user_id, provider, provider_user_id, provider_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(connectionId, user!.id, 'github', String(githubUser.id), email, now, now).run();
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
