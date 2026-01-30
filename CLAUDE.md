# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Project Overview

**mockd** is a mock API server platform built on Cloudflare Workers. It enables developers to create, manage, and test mock endpoints with real-time request logging and WebSocket-based live updates.

## Tech Stack

- **Runtime**: Cloudflare Workers, Durable Objects
- **Backend**: Hono (TypeScript)
- **Frontend**: React 18, Vite, Tailwind CSS, daisyUI
- **Database**: Cloudflare D1 (SQLite), Durable Objects SQLite
- **Build**: pnpm, Turborepo
- **Testing**: Vitest
- **Auth**: Magic links (Resend), GitHub OAuth

## Repository Structure

```
/
├── packages/
│   ├── shared/          # Shared types, constants, utilities
│   └── web/             # React frontend dashboard
├── workers/
│   ├── api/             # Main API worker (Hono)
│   └── endpoint/        # Endpoint worker + Durable Objects
├── migrations/          # D1 database migrations
└── scripts/             # Development scripts
```

## Common Commands

```bash
# Install dependencies
pnpm install

# Start all dev servers (API, endpoint worker, frontend)
pnpm dev

# Type check all packages
pnpm typecheck

# Run tests
pnpm --filter @mockd/api test

# Build all packages
pnpm build

# Run database migrations locally
pnpm db:migrate
```

## Development Workflow

1. **API Worker** runs on `localhost:8787`
2. **Endpoint Worker** runs on `localhost:8788`
3. **Frontend** runs on `localhost:3000` (proxies `/api` to API worker)

## Key Files

- `workers/api/src/router.ts` - API routes for projects/endpoints CRUD
- `workers/api/src/auth.ts` - Authentication routes
- `workers/endpoint/src/EndpointDO.ts` - Durable Object handling mock requests
- `packages/shared/src/types/` - TypeScript interfaces
- `packages/web/src/hooks/` - React hooks for data fetching

## Testing

Tests are in `workers/api/src/__tests__/`. Run with:
```bash
pnpm --filter @mockd/api test
pnpm --filter @mockd/api test:watch  # Watch mode
```

## Database

- D1 migrations are in `/migrations/`
- Durable Objects use SQLite for per-project data (endpoints, request_logs, mock_rules)

## Deployment

Deployment is automated via GitHub Actions (`.github/workflows/deploy.yml`):
- PRs trigger type checking, tests, and builds
- Merges to main deploy to Cloudflare

## Issue Tracking with Beads

This project uses **Beads** for issue tracking - an AI-native tool that stores issues directly in the repo.

### Common Commands

```bash
# List all issues
bd list

# Show issue details
bd show <issue-id>

# Create a new issue
bd create "Description of the issue"

# Update issue status
bd update <issue-id> --status in_progress
bd update <issue-id> --status done

# Sync issues with git remote
bd sync
```

### Workflow

- Check `bd list` before starting work to see open issues
- Use `bd update <id> --status in_progress` when starting on an issue
- Use `bd update <id> --status done` when completing an issue
- Run `bd sync` to sync issues with the remote repository
