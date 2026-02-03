# Feature Specification: API Documentation Generation

## Overview

Automatically generate beautiful, shareable API documentation from mock endpoints. Users can publish documentation pages that external developers, stakeholders, or team members can access to understand and interact with the mock API.

## Problem Statement

Developers using mockd often need to share API information with others:
- Frontend developers need to know available endpoints
- QA teams need request/response formats
- Stakeholders want to review API designs
- External partners need integration documentation

Currently, users must maintain separate documentation, which:
- Gets out of sync with actual endpoints
- Requires extra effort to create and maintain
- Has no interactive testing capability

## User Stories

### Documentation Generation

1. **As a developer**, I want to automatically generate API docs from my endpoints so that I don't have to write documentation manually.

2. **As a developer**, I want to add descriptions to my endpoints so that the generated docs are informative.

3. **As a developer**, I want to customize the documentation appearance so that it matches my brand.

### Sharing & Access

4. **As a developer**, I want to publish docs at a public URL so that others can access them without an account.

5. **As a developer**, I want to password-protect my docs so that only authorized people can view them.

6. **As a developer**, I want to embed docs in my own site so that they appear integrated with my developer portal.

### Interactive Features

7. **As a documentation reader**, I want to see example requests and responses so that I understand the API format.

8. **As a documentation reader**, I want to try API calls directly from the docs so that I can test without writing code.

9. **As a documentation reader**, I want to copy code snippets so that I can quickly integrate the API.

### Organization

10. **As a developer**, I want to group endpoints into sections so that the docs are well-organized.

11. **As a developer**, I want to add markdown content between endpoint docs so that I can provide context and guides.

## Functional Requirements

### FR-1: Documentation Page

| Requirement | Description |
|-------------|-------------|
| FR-1.1 | Auto-generate docs page for each project |
| FR-1.2 | List all endpoints with method, path, description |
| FR-1.3 | Show request parameters (path, query, headers) |
| FR-1.4 | Show request body schema/example |
| FR-1.5 | Show response body example |
| FR-1.6 | Show response status codes |
| FR-1.7 | Real-time sync with endpoint changes |

### FR-2: Endpoint Metadata

| Requirement | Description |
|-------------|-------------|
| FR-2.1 | Endpoint title (auto-generated from path if empty) |
| FR-2.2 | Endpoint description (markdown supported) |
| FR-2.3 | Parameter descriptions (path params, query params) |
| FR-2.4 | Request body description |
| FR-2.5 | Response description |
| FR-2.6 | Tags/categories for grouping |
| FR-2.7 | Deprecation flag |

### FR-3: Publishing & Access

| Requirement | Description |
|-------------|-------------|
| FR-3.1 | Enable/disable public docs |
| FR-3.2 | Custom docs URL slug (e.g., `/docs/my-api`) |
| FR-3.3 | Optional password protection |
| FR-3.4 | Custom domain support (Pro+ tier) |
| FR-3.5 | SEO meta tags (title, description) |
| FR-3.6 | Embeddable iframe snippet |

### FR-4: Customization

| Requirement | Description |
|-------------|-------------|
| FR-4.1 | Custom logo |
| FR-4.2 | Custom primary color |
| FR-4.3 | Light/dark mode toggle |
| FR-4.4 | Custom header/footer content |
| FR-4.5 | Hide/show specific endpoints |
| FR-4.6 | Custom CSS (Team tier) |

### FR-5: Interactive Features

| Requirement | Description |
|-------------|-------------|
| FR-5.1 | "Try it" button to make live requests |
| FR-5.2 | Edit request parameters before sending |
| FR-5.3 | Display response with syntax highlighting |
| FR-5.4 | Show response time and status |
| FR-5.5 | Copy request as cURL |
| FR-5.6 | Copy request as JavaScript fetch |
| FR-5.7 | Copy request as Python requests |
| FR-5.8 | Copy response body |

### FR-6: Organization

| Requirement | Description |
|-------------|-------------|
| FR-6.1 | Group endpoints by tag |
| FR-6.2 | Custom section ordering |
| FR-6.3 | Collapsible endpoint groups |
| FR-6.4 | Sidebar navigation |
| FR-6.5 | Search endpoints |
| FR-6.6 | Introduction section (markdown) |

## API Design

### Documentation Settings

```
GET /api/projects/:projectId/docs/settings
Authorization: Bearer <token>

Response 200:
{
  "enabled": true,
  "slug": "my-api",
  "url": "https://docs.mockd.sh/my-api",
  "password": null,
  "customization": {
    "logo": "https://...",
    "primaryColor": "#3B82F6",
    "darkMode": true
  },
  "seo": {
    "title": "My API Documentation",
    "description": "API reference for My API"
  },
  "introduction": "# Welcome\n\nThis is the API documentation...",
  "sections": [
    { "id": "sec_1", "name": "Users", "order": 0 },
    { "id": "sec_2", "name": "Orders", "order": 1 }
  ]
}
```

```
PUT /api/projects/:projectId/docs/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": true,
  "slug": "my-api",
  "password": "secret123",
  "customization": {
    "primaryColor": "#10B981"
  }
}

Response 200: <updated settings>
```

### Endpoint Documentation Metadata

```
PUT /api/projects/:projectId/endpoints/:endpointId/docs
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "List Users",
  "description": "Returns a paginated list of all users in the system.",
  "tags": ["Users"],
  "deprecated": false,
  "hidden": false,
  "parameters": [
    {
      "name": "page",
      "in": "query",
      "description": "Page number for pagination",
      "required": false,
      "example": "1"
    },
    {
      "name": "limit",
      "in": "query",
      "description": "Number of items per page",
      "required": false,
      "example": "20"
    }
  ],
  "requestBody": {
    "description": "User object to create",
    "example": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "responses": [
    {
      "status": 200,
      "description": "Successful response with user list"
    },
    {
      "status": 401,
      "description": "Unauthorized - invalid or missing API key"
    }
  ]
}

Response 200: <updated endpoint with docs>
```

### Public Documentation Page

```
GET /docs/:slug
(No auth required unless password protected)

Response 200: HTML documentation page
```

```
GET /api/public/docs/:slug
(Returns JSON for custom rendering)

Response 200:
{
  "project": {
    "name": "My API",
    "baseUrl": "https://my-api.mockd.sh"
  },
  "customization": { ... },
  "introduction": "# Welcome...",
  "sections": [
    {
      "name": "Users",
      "endpoints": [
        {
          "id": "ep_abc",
          "method": "GET",
          "path": "/users",
          "title": "List Users",
          "description": "Returns a paginated list...",
          "parameters": [...],
          "requestBody": {...},
          "responseExample": {...},
          "responses": [...]
        }
      ]
    }
  ]
}
```

## Database Schema Changes

### New Tables (D1)

```sql
-- Documentation settings per project
CREATE TABLE docs_settings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 0,
  slug TEXT UNIQUE,
  password_hash TEXT,
  introduction TEXT,
  section_order TEXT, -- JSON array of section names
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_docs_settings_slug ON docs_settings(slug);

-- Customization settings
CREATE TABLE docs_customization (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  dark_mode INTEGER DEFAULT 1,
  header_content TEXT,
  footer_content TEXT,
  custom_css TEXT,
  seo_title TEXT,
  seo_description TEXT
);
```

### Durable Object Schema (per endpoint)

```sql
-- Add docs fields to endpoints table
ALTER TABLE endpoints ADD COLUMN docs_title TEXT;
ALTER TABLE endpoints ADD COLUMN docs_description TEXT;
ALTER TABLE endpoints ADD COLUMN docs_tags TEXT; -- JSON array
ALTER TABLE endpoints ADD COLUMN docs_deprecated INTEGER DEFAULT 0;
ALTER TABLE endpoints ADD COLUMN docs_hidden INTEGER DEFAULT 0;
ALTER TABLE endpoints ADD COLUMN docs_parameters TEXT; -- JSON array
ALTER TABLE endpoints ADD COLUMN docs_request_body TEXT; -- JSON object
ALTER TABLE endpoints ADD COLUMN docs_responses TEXT; -- JSON array
```

## UI/UX Design

### Documentation Settings Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  My API › Documentation Settings                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ Publishing ───────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Public Documentation    [====○] Enabled                               │ │
│  │                                                                        │ │
│  │  Documentation URL                                                     │ │
│  │  https://docs.mockd.sh/ ┌────────────────────────────┐                │ │
│  │                         │ my-api                     │  [Check]        │ │
│  │                         └────────────────────────────┘                │ │
│  │                                                                        │ │
│  │  🔗 https://docs.mockd.sh/my-api                          [Copy] [↗]  │ │
│  │                                                                        │ │
│  │  Password Protection     ☐ Require password to view                    │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Appearance ───────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Logo                    ┌──────────┐                                  │ │
│  │                          │  [img]   │  [Upload]  [Remove]              │ │
│  │                          └──────────┘                                  │ │
│  │                                                                        │ │
│  │  Primary Color           [■] #3B82F6     [Color Picker]                │ │
│  │                                                                        │ │
│  │  Default Theme           ○ Light   ● Dark                              │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Introduction ─────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │ # Welcome to My API                                              │ │ │
│  │  │                                                                  │ │ │
│  │  │ This API provides access to user and order data.                 │ │ │
│  │  │                                                                  │ │ │
│  │  │ ## Authentication                                                │ │ │
│  │  │                                                                  │ │ │
│  │  │ Include your API key in the `Authorization` header...            │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │  Supports Markdown                                      [Preview]     │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                                         [Save Changes]      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Endpoint Documentation Editor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GET /users                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Response]  [Rules]  [Logs]  [Documentation]                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Title                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ List Users                                                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Description                                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Returns a paginated list of all users in the system.                 │  │
│  │                                                                      │  │
│  │ Results are sorted by creation date in descending order.             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Tags                                                                       │
│  ┌────────────────────────────────────────────────────────┐                │
│  │ [Users ×]  [Admin ×]                            [+ Add]│                │
│  └────────────────────────────────────────────────────────┘                │
│                                                                             │
│  ☐ Mark as deprecated    ☐ Hide from documentation                         │
│                                                                             │
│  ┌─ Query Parameters ─────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Name        Description                    Required    Example        │ │
│  │  ─────────────────────────────────────────────────────────────────── │ │
│  │  page        Page number for pagination     ☐           1              │ │
│  │  limit       Items per page (max 100)       ☐           20             │ │
│  │                                                                        │ │
│  │  [+ Add Parameter]                                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Response Codes ───────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  200    Successful response with user list                             │ │
│  │  401    Unauthorized - invalid API key                                 │ │
│  │  429    Rate limit exceeded                                            │ │
│  │                                                                        │ │
│  │  [+ Add Response]                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                                           [Save]            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Generated Documentation Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Logo] My API                                        [☀/🌙]  [Try It]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────────────────────────────────────────────┐  │
│  │             │  │                                                     │  │
│  │ Introduction│  │  # Welcome to My API                                │  │
│  │             │  │                                                     │  │
│  │ ─────────── │  │  This API provides access to user and order data.   │  │
│  │             │  │                                                     │  │
│  │ Users       │  │  Base URL: `https://my-api.mockd.sh`                │  │
│  │  GET /users │  │                                                     │  │
│  │  POST /users│  │  ## Authentication                                  │  │
│  │  GET /:id   │  │                                                     │  │
│  │             │  │  Include your API key in the header:                │  │
│  │ ─────────── │  │  ```                                                │  │
│  │             │  │  Authorization: Bearer YOUR_API_KEY                 │  │
│  │ Orders      │  │  ```                                                │  │
│  │  GET /orders│  │                                                     │  │
│  │  POST /order│  └─────────────────────────────────────────────────────┘  │
│  │             │                                                           │
│  │             │  ┌─ Users ─────────────────────────────────────────────┐  │
│  │ ─────────── │  │                                                     │  │
│  │             │  │  GET  /users                                        │  │
│  │ 🔍 Search   │  │  ─────────────────────────────────────────────────  │  │
│  │             │  │  List Users                                         │  │
│  └─────────────┘  │                                                     │  │
│                   │  Returns a paginated list of all users in the       │  │
│                   │  system. Results are sorted by creation date.       │  │
│                   │                                                     │  │
│                   │  Query Parameters                                   │  │
│                   │  ┌───────────────────────────────────────────────┐  │  │
│                   │  │ page     integer   Page number (default: 1)  │  │  │
│                   │  │ limit    integer   Items per page (max: 100) │  │  │
│                   │  └───────────────────────────────────────────────┘  │  │
│                   │                                                     │  │
│                   │  Response 200                                       │  │
│                   │  ┌───────────────────────────────────────────────┐  │  │
│                   │  │ {                                             │  │  │
│                   │  │   "users": [                                  │  │  │
│                   │  │     {                                         │  │  │
│                   │  │       "id": "usr_123",                        │  │  │
│                   │  │       "name": "John Doe",                     │  │  │
│                   │  │       "email": "john@example.com"             │  │  │
│                   │  │     }                                         │  │  │
│                   │  │   ],                                          │  │  │
│                   │  │   "total": 100,                               │  │  │
│                   │  │   "page": 1                                   │  │  │
│                   │  │ }                                             │  │  │
│                   │  └───────────────────────────────────────────────┘  │  │
│                   │                                                     │  │
│                   │  [Try It]  [cURL]  [JavaScript]  [Python]          │  │
│                   │                                                     │  │
│                   └─────────────────────────────────────────────────────┘  │
│                                                                             │
│                   ┌─ POST /users ───────────────────────────────────────┐  │
│                   │  ...                                                │  │
│                   └─────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Try It Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Try It - GET /users                                                     X  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Request URL                                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ https://my-api.mockd.sh/users                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Query Parameters                                                           │
│  ┌─────────────────────────┬────────────────────────────────────────────┐  │
│  │ page                    │ 1                                          │  │
│  ├─────────────────────────┼────────────────────────────────────────────┤  │
│  │ limit                   │ 20                                         │  │
│  └─────────────────────────┴────────────────────────────────────────────┘  │
│                                                                             │
│  Headers                                                                    │
│  ┌─────────────────────────┬────────────────────────────────────────────┐  │
│  │ Authorization           │ Bearer YOUR_API_KEY                        │  │
│  └─────────────────────────┴────────────────────────────────────────────┘  │
│  [+ Add Header]                                                             │
│                                                                             │
│                                                    [Send Request]           │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Response                                    200 OK · 45ms                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ {                                                                    │  │
│  │   "users": [                                                         │  │
│  │     {                                                                │  │
│  │       "id": "usr_123",                                               │  │
│  │       "name": "John Doe",                                            │  │
│  │       "email": "john@example.com"                                    │  │
│  │     }                                                                │  │
│  │   ],                                                                 │  │
│  │   "total": 100,                                                      │  │
│  │   "page": 1                                                          │  │
│  │ }                                                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                  [Copy]     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technical Considerations

### Documentation Rendering

1. **Server-side rendering** for SEO and fast initial load
2. **Client-side hydration** for interactive features
3. **Markdown processing** with sanitization (DOMPurify)
4. **Syntax highlighting** with Prism.js or Shiki

### Code Snippet Generation

```typescript
function generateCurlSnippet(endpoint: Endpoint, params: RequestParams): string {
  let curl = `curl -X ${endpoint.method} "${endpoint.baseUrl}${endpoint.path}"`;

  for (const [key, value] of Object.entries(params.headers)) {
    curl += ` \\\n  -H "${key}: ${value}"`;
  }

  if (params.body) {
    curl += ` \\\n  -d '${JSON.stringify(params.body)}'`;
  }

  return curl;
}

function generateFetchSnippet(endpoint: Endpoint, params: RequestParams): string {
  return `fetch("${endpoint.baseUrl}${endpoint.path}", {
  method: "${endpoint.method}",
  headers: ${JSON.stringify(params.headers, null, 2)},
  ${params.body ? `body: JSON.stringify(${JSON.stringify(params.body, null, 2)})` : ''}
})
  .then(res => res.json())
  .then(data => console.log(data));`;
}
```

### Search Implementation

- Client-side search for small docs (< 100 endpoints)
- Use Fuse.js for fuzzy matching
- Index endpoint titles, descriptions, paths, tags

### Caching Strategy

- Cache generated HTML for 5 minutes
- Invalidate on endpoint/settings changes
- Use stale-while-revalidate for fast loads

## Tier Restrictions

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Public docs | 1 project | Unlimited | Unlimited |
| Custom slug | ❌ | ✅ | ✅ |
| Custom domain | ❌ | ❌ | ✅ |
| Custom branding | ❌ | ✅ | ✅ |
| Custom CSS | ❌ | ❌ | ✅ |
| Password protection | ❌ | ✅ | ✅ |
| Remove "Powered by mockd" | ❌ | ❌ | ✅ |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Docs enabled | 30% of projects | Projects with enabled docs |
| Public doc views | 5x project count | Monthly page views |
| Try It usage | 20% of doc visits | Sessions with Try It used |
| Snippet copies | 1000/month | Copy button clicks |
| External referrals | 5% of signups | Signups from doc pages |

## Out of Scope (Future)

- Versioned documentation
- Changelog generation
- API SDK generation
- Multiple language support
- Comments/feedback on docs
- Analytics for doc pages
- Webhook on doc changes

## Implementation Phases

### Phase 1 (MVP)
- Basic auto-generated docs page
- Endpoint title and description fields
- Public URL with slug
- Response example display
- Copy response button

### Phase 2
- Try It interactive panel
- Code snippet generation (cURL, JS, Python)
- Query/path parameter documentation
- Tags and grouping
- Sidebar navigation

### Phase 3
- Custom branding (logo, colors)
- Introduction markdown section
- Password protection
- Search functionality
- Dark/light mode

### Phase 4
- Custom domains
- Custom CSS
- Embeddable widgets
- SEO optimization
