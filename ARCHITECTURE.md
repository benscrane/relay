# mockd Architecture

mockd is a mock API server built on Cloudflare Workers, allowing developers to create and manage mock endpoints with real-time request logging.

## Stack

- **Runtime**: Cloudflare Workers
- **Database**: D1 (SQLite) for user/project metadata, Durable Object SQLite for endpoint data
- **Frontend**: React + Vite + Tailwind CSS
- **Build**: pnpm workspaces + Turborepo

## Project Structure

```
mockd/
├── packages/
│   ├── shared/          # Shared types, constants, utilities
│   └── web/             # React frontend
├── workers/
│   ├── api/             # Main API worker (Hono)
│   └── endpoint/        # Mock endpoint worker + Durable Object
├── migrations/          # D1 database migrations
├── scripts/             # Development scripts
└── .github/workflows/   # CI/CD
```

## Architecture Overview

### Two-Worker Design

1. **API Worker** (`workers/api/`)
   - Handles dashboard API requests (`/api/*`)
   - CRUD operations for projects and endpoints
   - User authentication and authorization
   - Communicates with D1 for metadata, forwards to Durable Objects for endpoint data

2. **Endpoint Worker** (`workers/endpoint/`)
   - Handles mock endpoint requests (`{subdomain}.mockd.sh/*`)
   - Routes requests to project-specific Durable Objects
   - Each project gets its own `EndpointDO` instance

### Durable Object: EndpointDO

Each project's endpoints live in a dedicated Durable Object with:
- **SQLite storage** for endpoints and request logs
- **WebSocket support** for real-time request streaming
- **Path matching** with parameter support (`:id` patterns)
- **Configurable delays** for latency simulation

### Data Flow

```
User Request → Endpoint Worker → EndpointDO (by subdomain)
                                      ↓
                               Match endpoint
                                      ↓
                               Log request + broadcast via WebSocket
                                      ↓
                               Return mock response
```

### Database Schema

**D1 (Global metadata):**
- `users` - Account info, tier (free/pro/team)
- `projects` - Project metadata, subdomain mapping
- `api_keys` - Programmatic access tokens
- `usage_daily` - Request count aggregates

**Durable Object SQLite (Per-project):**
- `endpoints` - Method, path, response body, status code, delay
- `request_logs` - Incoming request history

## Tier Limits

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Projects | 3 | 25 | 100 |
| Endpoints/project | 10 | 100 | 500 |
| Requests/day | 1,000 | 100,000 | 1,000,000 |
| Log retention | 1 day | 7 days | 30 days |
| Max response size | 64KB | 1MB | 5MB |

## Development

```bash
# Setup
./scripts/setup.sh

# Run all services
pnpm dev

# Type check
pnpm typecheck

# Deploy
pnpm -F @mockd/api deploy
pnpm -F @mockd/endpoint deploy
```
