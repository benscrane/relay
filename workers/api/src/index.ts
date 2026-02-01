import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { router } from './router';
import { authRouter } from './auth';
import { magicLinkRouter } from './magic-link';
import { oauthRouter } from './oauth';

export interface Env {
  DB: D1Database;
  ENDPOINT_DO: DurableObjectNamespace;
  ENVIRONMENT: string;
  RESEND_API_KEY: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  APP_URL: string;
  API_URL: string;
  COOKIE_DOMAIN?: string;
  CORS_ORIGINS?: string; // Comma-separated list of allowed origins (defaults to APP_URL)
  INTERNAL_API_SECRET: string; // Shared secret for authenticating internal DO requests
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const allowedOrigins = c.env.CORS_ORIGINS
    ? c.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [c.env.APP_URL];

  const corsMiddleware = cors({
    origin: (origin) => {
      if (!origin) return null;
      return allowedOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
  });

  return corsMiddleware(c, next);
});

app.route('/api/auth', authRouter);
app.route('/api/auth/magic-link', magicLinkRouter);
app.route('/api/auth', oauthRouter);
app.route('/api', router);

app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
