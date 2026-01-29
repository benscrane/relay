# Cloudflare Deployment Checklist

This document outlines everything needed before deploying mockd to Cloudflare.

## Blocking Issues

### 1. Configuration Placeholders

The following placeholders must be replaced in wrangler.toml files:

| Placeholder | File | Description |
|-------------|------|-------------|
| `YOUR_DATABASE_ID` | `wrangler.toml` (root) | D1 database ID |
| `YOUR_DATABASE_ID` | `workers/api/wrangler.toml` | D1 database ID (dev) |
| `YOUR_PRODUCTION_DATABASE_ID` | `workers/api/wrangler.toml` | D1 database ID (prod) |
| `YOUR_DOMAIN` | `workers/api/wrangler.toml` | Production domain (routes, URLs) |
| `YOUR_DOMAIN` | `workers/endpoint/wrangler.toml` | Production domain (routes) |

### 2. Required Cloudflare Secrets

Set these via `wrangler secret put <NAME>`:

| Secret | Purpose | Required |
|--------|---------|----------|
| `RESEND_API_KEY` | Email service for magic links | Yes (throws if missing) |
| `GITHUB_CLIENT_ID` | GitHub OAuth login | Yes (if using OAuth) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth login | Yes (if using OAuth) |

### 3. GitHub Actions Configuration

**Secrets** (Settings > Secrets and variables > Actions):
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - API token with Workers permissions

**Variables**:
- `VITE_API_URL` - Production API URL (e.g., `https://api.yourdomain.com`)
- `VITE_ENDPOINT_DOMAIN` - Endpoint domain (e.g., `yourdomain.com`)

### 4. D1 Database Setup

```bash
# Create the database
wrangler d1 create mockd-db

# Note the database ID from output and update wrangler.toml files

# Run migrations (development)
pnpm db:migrate

# Run migrations (production)
pnpm db:migrate:prod
```

### 5. DNS Configuration

Required DNS records:

| Type | Name | Target |
|------|------|--------|
| CNAME | `api` | Workers route |
| CNAME | `*` | Workers route (wildcard for project subdomains) |

---

## Code Issues

### High Severity

#### Internal endpoints have no authentication
- **Location**: `workers/endpoint/src/EndpointDO.ts`
- **Issue**: `/__internal/*` endpoints are accessible without auth
- **Risk**: Anyone knowing a subdomain can manipulate endpoints
- **Fix**: Add authentication middleware or token validation

#### Email service throws on missing API key
- **Location**: `workers/api/src/email/index.ts`
- **Issue**: Production code throws if `RESEND_API_KEY` is not set
- **Fix**: Add graceful error handling or fallback

### Medium Severity

#### Tier limits not enforced
- **Location**: `packages/shared/src/constants/limits.ts`
- **Issue**: `TIER_LIMITS` constants defined but never checked
- **Impact**: Users can exceed free tier limits

#### No rate limiting on mock endpoints
- **Location**: `workers/endpoint/src/EndpointDO.ts`
- **Issue**: Mock endpoints have no request rate limiting
- **Impact**: Potential abuse or resource exhaustion

### Low Severity

#### Duplicate function definition
- **Location**: `workers/api/src/auth/auth.ts` and `workers/api/src/middleware.ts`
- **Issue**: `mapDbUserToUser()` defined in both files
- **Fix**: Export from one location and import in the other

#### WebSocket session cleanup
- **Location**: `workers/endpoint/src/EndpointDO.ts`
- **Issue**: Sessions map only cleaned on close, not on errors
- **Impact**: Potential memory accumulation

---

## Deployment Steps

### First-Time Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Create D1 database
wrangler d1 create mockd-db
# Copy the database_id from output

# 3. Update configuration files with real values
# - Replace YOUR_DATABASE_ID in all wrangler.toml files
# - Replace YOUR_DOMAIN with your actual domain

# 4. Set Cloudflare secrets
wrangler secret put RESEND_API_KEY
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET

# 5. Run database migrations
pnpm db:migrate:prod

# 6. Deploy workers
pnpm deploy
```

### Verification Checklist

```
[ ] D1 database created and ID updated in configs
[ ] All YOUR_DOMAIN placeholders replaced
[ ] DNS records configured (including wildcard)
[ ] Cloudflare secrets set (RESEND_API_KEY, GITHUB_CLIENT_*)
[ ] GitHub Actions secrets configured
[ ] GitHub Actions variables configured
[ ] Database migrations applied to production
[ ] API worker responding at api.yourdomain.com
[ ] Endpoint worker responding at *.yourdomain.com
[ ] Frontend deployed and accessible
[ ] Authentication flow working (magic link + OAuth)
[ ] WebSocket connections working for live updates
```

---

## Security Recommendations

Before production use:

1. **Add authentication to internal endpoints** - Validate requests to `/__internal/*`
2. **Implement rate limiting** - Protect against abuse
3. **Enforce tier limits** - Check limits on project/endpoint creation
4. **Add request body sanitization** - Prevent stored XSS in request logs
5. **Validate WebSocket origins** - Prevent cross-origin connections

---

## Architecture Reference

- **API Worker** (`workers/api/`) - Dashboard API, authentication, D1 metadata
- **Endpoint Worker** (`workers/endpoint/`) - Mock endpoint routing via Durable Objects
- **Frontend** (`packages/web/`) - React + Vite + Tailwind
- **Shared** (`packages/shared/`) - Common types and utilities

See `ARCHITECTURE.md` for detailed system design.
