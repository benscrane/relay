# Top 5 Product Improvements for mockd

*Analysis date: 2026-02-06*
*Perspective: B2C SaaS product management*

After a thorough review of the mockd application — its frontend UX, API layer, data model, test coverage, and competitive positioning — these are the five highest-impact improvements, each scoped to a single pull request.

---

## 1. Guided Onboarding with Quick-Start Templates

**Problem:** New users land on an empty project list with no guidance. The only options are "Create Project" (requires auth) or "Temp Mock" (creates a blank project). There is no explanation of what mockd does, no tutorial, and no way to see the product's value before investing effort. This is a critical activation gap — users who don't create their first working endpoint within minutes will churn.

**What to build:**

- **Welcome modal** for first-time visitors (keyed off localStorage) with a 3-step value prop: "Create an endpoint → Send a request → See it live"
- **"Start from Template" button** on the Home page and empty project state, offering 3-4 pre-built API templates:
  - **REST CRUD API** — `/users` with GET (list), POST (create), GET `/:id`, PUT `/:id`, DELETE `/:id`
  - **Webhook Receiver** — single POST endpoint that logs payloads
  - **Error Simulation** — endpoints returning 200, 400, 404, 500 for testing error handling
- Each template creates a project with pre-configured endpoints, response bodies, and a mock rule demonstrating conditional logic
- **Post-creation guidance**: after template creation, show a toast or inline banner with a ready-to-copy `curl` command so users immediately see a request appear in the live stream

**Why this is #1:** Activation rate is the most important metric for a B2C SaaS at this stage. Every other improvement is irrelevant if users don't understand the product in their first session. Templates reduce time-to-value from minutes to seconds.

**Scope:** Frontend changes in `packages/web/` (new `TemplateSelector` component, modifications to `Home.tsx` and `ProjectDetail.tsx` empty states) plus a shared `templates.ts` file defining template configurations. Backend uses existing CRUD endpoints — no API changes needed.

---

## 2. Dynamic Response Templating

**Problem:** Mock responses are static JSON. Users must manually update response bodies to test different scenarios. Competitors like Mockoon, WireMock, and Prism all support dynamic responses with faker data, request context interpolation, and conditional logic. This is the single largest feature gap in mockd's core product.

**What to build:**

- **Request context interpolation** — `{{request.method}}`, `{{request.path}}`, `{{request.headers.Authorization}}`, `{{request.body.name}}` resolved at response time
- **Built-in helper functions** — `{{$randomInt 1 100}}`, `{{$randomUUID}}`, `{{$timestamp}}`, `{{$randomEmail}}`, `{{$randomName}}`, `{{$randomBoolean}}`
- **Template engine** in the endpoint worker that processes response bodies before returning them, replacing template expressions with computed values
- **UI hint** in the response body editor showing available template variables with a collapsible reference panel

**Example:**
```json
{
  "id": "{{$randomUUID}}",
  "name": "{{request.body.name}}",
  "email": "{{$randomEmail}}",
  "createdAt": "{{$timestamp}}",
  "requestedBy": "{{request.headers.X-User-Id}}"
}
```

**Why this is #2:** Dynamic responses transform mockd from a "static stub server" into a realistic API simulator. This is the feature that makes users choose mockd over a simple `json-server` or hand-rolled Express mock. It directly drives retention — users who build dynamic mocks have a reason to keep using the platform.

**Scope:** New `templateEngine.ts` in `packages/shared/` for parsing and evaluating templates. Modifications to `EndpointDO.ts` to run response bodies through the engine before returning. Frontend changes to add a template variable reference panel to the response editor. Includes unit tests for the template engine.

---

## 3. Endpoint Analytics Dashboard

**Problem:** Users have zero visibility into how their mock endpoints are being used. There are no request counts, no status code breakdowns, no activity trends, and no way to see which endpoints are active vs. dormant. This means:
- Users can't tell if their mocks are working correctly
- There's no "aha moment" when they see real traffic flowing
- There's no data to justify upgrading to a paid tier

**What to build:**

- **Project-level stats card** on the Home page showing total requests in the last 24h per project
- **Endpoint-level stats panel** on the EndpointDetail page:
  - Request count (today, last 7 days, last 30 days)
  - Status code distribution (pie/donut chart: 2xx, 3xx, 4xx, 5xx)
  - Requests over time (simple bar chart, hourly for today, daily for week/month)
  - Average response time
  - Top matched rules
- **New API endpoint**: `GET /api/projects/:projectId/endpoints/:endpointId/stats` returning aggregated metrics from the request_logs table
- **Lightweight charting** using a small library (e.g., recharts or a custom SVG component) to avoid bundle bloat

**Why this is #3:** Analytics serve three purposes simultaneously: (a) they demonstrate value to users ("your mock handled 1,200 requests today"), (b) they create upgrade pressure when users approach tier limits ("you've used 850 of 1,000 daily requests"), and (c) they surface problems ("your endpoint returned 500 for 15% of requests — check your mock rules"). This is the primary conversion lever from free to paid.

**Scope:** New stats aggregation queries in `EndpointDO.ts` via a new `/__internal/stats` route. New `GET /api/projects/:projectId/endpoints/:endpointId/stats` route in `router.ts`. New `useEndpointStats` hook and `StatsPanel` component in the frontend. The `usage_daily` table already exists in D1 but is unused — wire it up for project-level tracking.

---

## 4. API Key Management

**Problem:** The `api_keys` table exists in the D1 schema (migration 0003) with proper columns (`id`, `user_id`, `name`, `key_hash`, `last_used_at`, `expires_at`), but there are zero API endpoints and zero UI for managing keys. This means:
- Users cannot integrate mockd into CI/CD pipelines
- There is no programmatic access to the management API
- The team tier's value proposition (automation, integration) is undeliverable

**What to build:**

- **API routes** for key lifecycle:
  - `POST /api/keys` — generate a new API key (returns plaintext key exactly once)
  - `GET /api/keys` — list keys (name, created, last used, expiry — never the key itself)
  - `DELETE /api/keys/:id` — revoke a key
- **Auth middleware update** to accept `Authorization: Bearer <api_key>` as an alternative to session cookies, resolving the user from `api_keys.user_id`
- **Settings page** in the frontend (`/settings/api-keys`) with:
  - "Generate New Key" button with name input
  - One-time display of the generated key with copy button and warning
  - Table of existing keys with revoke action
  - Last-used timestamp for each key
- **Navigation update** to add "Settings" to the navbar for authenticated users

**Why this is #4:** API keys unlock the entire "developer tool" use case. Without them, mockd is dashboard-only — you must be logged into the web UI to manage mocks. With keys, users can script endpoint creation, integrate with CI/CD, and build workflows around mockd. This is also a prerequisite for team adoption, where individual API keys enable audit trails.

**Scope:** New routes in `router.ts` and `auth.ts` middleware update. New `Settings` page and `ApiKeyManager` component in the frontend. New `useApiKeys` hook. Tests for key generation, authentication, and revocation.

---

## 5. Request Log REST API with Filtering and Pagination

**Problem:** Request logs are currently only accessible via WebSocket, limited to the 100 most recent entries, and lost if the user wasn't connected when requests arrived. There is no REST endpoint to retrieve logs (only `DELETE` to clear them). This means:
- Users cannot review historical requests after closing their browser
- Debugging is limited to what's currently on screen
- There's no way to search for a specific request from hours ago
- CI/CD pipelines cannot verify that expected requests were received

**What to build:**

- **New API endpoint**: `GET /api/projects/:projectId/endpoints/:endpointId/logs`
  - Query parameters: `?method=POST&status=400&from=2024-01-01T00:00:00Z&to=2024-01-02T00:00:00Z&search=userId&page=1&limit=50`
  - Filters: HTTP method, status code range, date range, full-text search on path/body
  - Pagination: cursor-based or offset-based with total count
  - Sorting: by timestamp (default desc), by response time
- **New internal DO route**: `GET /__internal/logs` updated to accept filter/pagination params (currently returns all logs up to 100)
- **Frontend updates** to `RequestList.tsx`:
  - "Load More" / infinite scroll for paginated results
  - Persistent filter controls (already partially built — method filter, status filter, date range, text search exist in the UI but only filter the in-memory WebSocket buffer)
  - Wire existing filter UI to the new REST endpoint for historical queries
  - "Export filtered results" button (JSON/CSV export already exists but only for in-memory data)

**Why this is #5:** Request logging is mockd's observability story — it's what makes mockd better than a local mock server. But the current implementation is ephemeral: if you miss it live, it's gone. Making logs queryable and persistent transforms the request log from a "nice to watch" feature into a reliable debugging and verification tool. This is particularly important for the CI/CD use case (improvement #4) where pipelines need to verify that the right requests were made.

**Scope:** New query logic in `EndpointDO.ts` with parameterized SQL queries. New route in `router.ts`. Frontend modifications to `RequestList.tsx` and `useWebSocket.ts` (or a new `useRequestLogs` hook for REST-based fetching). Tests for filtering, pagination, and edge cases.

---

## Summary

| # | Improvement | Primary Metric | Effort | Risk |
|---|-------------|---------------|--------|------|
| 1 | Onboarding + Templates | Activation rate | Medium | Low |
| 2 | Dynamic Response Templating | Retention / feature parity | Medium-High | Low |
| 3 | Endpoint Analytics Dashboard | Conversion (free → paid) | Medium | Low |
| 4 | API Key Management | Developer adoption / CI-CD | Medium | Low |
| 5 | Request Log REST API | Debugging utility / CI-CD | Medium | Low |

These five improvements address the full funnel: **#1** gets users activated, **#2** keeps them using the product, **#3** makes the value visible and drives upgrades, **#4** unlocks programmatic/team adoption, and **#5** completes the observability story that makes mockd indispensable for API development workflows.
