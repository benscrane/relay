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
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: (origin) => origin || '*',
  credentials: true,
}));

app.route('/api/auth', authRouter);
app.route('/api/auth/magic-link', magicLinkRouter);
app.route('/api/auth', oauthRouter);
app.route('/api', router);

app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
