# Feature Specification: OpenAPI/Swagger Import & Export

## Overview

Enable users to import existing OpenAPI 3.0/Swagger 2.0 specifications to auto-generate mock endpoints, and export their mockd projects as OpenAPI specs. This dramatically reduces onboarding friction and integrates mockd into existing developer workflows.

## Problem Statement

Developers already have API specifications for their projects. Requiring them to manually recreate each endpoint in mockd is:
- Time-consuming (10+ minutes for a typical API)
- Error-prone (typos, missed endpoints)
- A significant barrier to adoption

## User Stories

### Import Stories

1. **As a developer**, I want to upload an OpenAPI spec file so that I can instantly create mock endpoints for my entire API.

2. **As a developer**, I want to import from a URL so that I can use specs hosted on GitHub, Swagger Hub, or my own servers.

3. **As a developer**, I want to import a Postman collection so that I can migrate my existing mocks to mockd.

4. **As a developer**, I want to preview what will be created before importing so that I can verify the import is correct.

5. **As a developer**, I want to choose which endpoints to import so that I can selectively mock only what I need.

6. **As a developer**, I want imported endpoints to include example responses from the spec so that I don't have to manually configure responses.

### Export Stories

7. **As a developer**, I want to export my project as an OpenAPI spec so that I can share it with my team or use it in other tools.

8. **As a developer**, I want to export individual endpoints so that I can document specific parts of my mock API.

## Functional Requirements

### FR-1: File Upload Import

| Requirement | Description |
|-------------|-------------|
| FR-1.1 | Accept OpenAPI 3.0.x JSON files |
| FR-1.2 | Accept OpenAPI 3.0.x YAML files |
| FR-1.3 | Accept Swagger 2.0 JSON files |
| FR-1.4 | Accept Swagger 2.0 YAML files |
| FR-1.5 | Maximum file size: 5MB |
| FR-1.6 | Validate spec structure before processing |
| FR-1.7 | Display validation errors with line numbers |

### FR-2: URL Import

| Requirement | Description |
|-------------|-------------|
| FR-2.1 | Accept HTTPS URLs to spec files |
| FR-2.2 | Support GitHub raw file URLs |
| FR-2.3 | Support Swagger Hub URLs |
| FR-2.4 | Timeout after 30 seconds |
| FR-2.5 | Handle redirects (max 3) |
| FR-2.6 | Validate Content-Type header |

### FR-3: Postman Collection Import

| Requirement | Description |
|-------------|-------------|
| FR-3.1 | Accept Postman Collection v2.1 format |
| FR-3.2 | Extract endpoints from requests |
| FR-3.3 | Map Postman examples to mock responses |
| FR-3.4 | Preserve folder structure as endpoint tags |

### FR-4: Import Preview & Selection

| Requirement | Description |
|-------------|-------------|
| FR-4.1 | Show list of all endpoints to be created |
| FR-4.2 | Display method, path, and description for each |
| FR-4.3 | Allow select/deselect individual endpoints |
| FR-4.4 | "Select All" / "Deselect All" buttons |
| FR-4.5 | Show count of selected endpoints |
| FR-4.6 | Warn if endpoint count exceeds tier limit |

### FR-5: Endpoint Generation

| Requirement | Description |
|-------------|-------------|
| FR-5.1 | Create endpoint for each selected operation |
| FR-5.2 | Set path from spec path template |
| FR-5.3 | Set method from spec operation |
| FR-5.4 | Set response body from first example or schema |
| FR-5.5 | Set status code from first response (default 200) |
| FR-5.6 | Generate sample response from JSON Schema if no example |
| FR-5.7 | Preserve operation description as endpoint notes |

### FR-6: Export to OpenAPI

| Requirement | Description |
|-------------|-------------|
| FR-6.1 | Export as OpenAPI 3.0.3 JSON |
| FR-6.2 | Export as OpenAPI 3.0.3 YAML |
| FR-6.3 | Include all endpoints as paths |
| FR-6.4 | Include response body as example |
| FR-6.5 | Include status code in responses |
| FR-6.6 | Set info.title from project name |
| FR-6.7 | Set servers[0].url to project mock URL |

## API Design

### Import Endpoints

```
POST /api/projects/:projectId/import/openapi
Content-Type: multipart/form-data

Body:
- file: <spec file>
- format: "openapi3" | "swagger2" | "postman"

Response 200:
{
  "preview": {
    "endpoints": [
      {
        "id": "temp-1",
        "method": "GET",
        "path": "/users",
        "description": "List all users",
        "hasExample": true,
        "selected": true
      },
      {
        "id": "temp-2",
        "method": "GET",
        "path": "/users/:id",
        "description": "Get user by ID",
        "hasExample": false,
        "selected": true
      }
    ],
    "totalCount": 15,
    "withinQuota": true,
    "quotaRemaining": 10
  }
}
```

```
POST /api/projects/:projectId/import/openapi/url
Content-Type: application/json

Body:
{
  "url": "https://api.example.com/openapi.json",
  "format": "auto" | "openapi3" | "swagger2"
}

Response 200: <same as above>
```

```
POST /api/projects/:projectId/import/confirm
Content-Type: application/json

Body:
{
  "selectedEndpoints": ["temp-1", "temp-2", "temp-5"]
}

Response 201:
{
  "created": 3,
  "endpoints": [
    { "id": "ep_abc123", "method": "GET", "path": "/users" },
    { "id": "ep_def456", "method": "GET", "path": "/users/:id" },
    { "id": "ep_ghi789", "method": "POST", "path": "/users" }
  ]
}
```

### Export Endpoints

```
GET /api/projects/:projectId/export/openapi?format=json|yaml

Response 200:
{
  "openapi": "3.0.3",
  "info": {
    "title": "My Project",
    "version": "1.0.0"
  },
  "servers": [
    { "url": "https://myproject.mockd.sh" }
  ],
  "paths": {
    "/users": {
      "get": {
        "summary": "List users",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "example": { "users": [] }
              }
            }
          }
        }
      }
    }
  }
}
```

## Database Schema Changes

No new tables required. Import is processed in-memory and creates standard endpoints.

Optional: Track import history for analytics.

```sql
CREATE TABLE import_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  source_type TEXT NOT NULL, -- 'openapi3', 'swagger2', 'postman'
  source_name TEXT, -- filename or URL
  endpoints_created INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## UI/UX Design

### Import Flow

1. **Entry Point**: "Import API" button on project page (next to "New Endpoint")

2. **Import Modal - Step 1: Source Selection**
   ```
   ┌─────────────────────────────────────────────────┐
   │  Import API Specification                    X  │
   ├─────────────────────────────────────────────────┤
   │                                                 │
   │  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
   │  │   Upload    │  │  From URL   │  │ Postman │ │
   │  │    File     │  │             │  │         │ │
   │  └─────────────┘  └─────────────┘  └─────────┘ │
   │                                                 │
   │  Supported: OpenAPI 3.0, Swagger 2.0           │
   │                                                 │
   │  ┌─────────────────────────────────────────┐   │
   │  │                                         │   │
   │  │     Drag & drop your spec file here     │   │
   │  │          or click to browse             │   │
   │  │                                         │   │
   │  └─────────────────────────────────────────┘   │
   │                                                 │
   └─────────────────────────────────────────────────┘
   ```

3. **Import Modal - Step 2: Preview & Select**
   ```
   ┌─────────────────────────────────────────────────┐
   │  Import API Specification                    X  │
   ├─────────────────────────────────────────────────┤
   │  Found 15 endpoints in "petstore.yaml"          │
   │                                                 │
   │  ☑ Select All                    12/15 selected │
   │  ─────────────────────────────────────────────  │
   │  ☑  GET    /pets          List all pets         │
   │  ☑  POST   /pets          Create a pet          │
   │  ☑  GET    /pets/:id      Get pet by ID         │
   │  ☐  DELETE /pets/:id      Delete a pet          │
   │  ☑  GET    /stores        List stores           │
   │  ...                                            │
   │                                                 │
   │  ⚠️ 3 endpoints exceed your plan limit (10 max) │
   │                                                 │
   │  ┌─────────┐                    ┌────────────┐  │
   │  │  Back   │                    │  Import 12 │  │
   │  └─────────┘                    └────────────┘  │
   └─────────────────────────────────────────────────┘
   ```

4. **Success State**
   ```
   ┌─────────────────────────────────────────────────┐
   │  Import Complete!                            X  │
   ├─────────────────────────────────────────────────┤
   │                                                 │
   │                    ✓                            │
   │                                                 │
   │         12 endpoints created successfully       │
   │                                                 │
   │  Your mock API is ready at:                     │
   │  https://myproject.mockd.sh                     │
   │                                                 │
   │              ┌────────────────────┐             │
   │              │  View Endpoints    │             │
   │              └────────────────────┘             │
   └─────────────────────────────────────────────────┘
   ```

### Export Button

Add "Export" dropdown to project page header:
- Export as OpenAPI (JSON)
- Export as OpenAPI (YAML)

## Technical Considerations

### Parsing Libraries

- **OpenAPI/Swagger**: Use `@apidevtools/swagger-parser` for validation and dereferencing
- **YAML**: Use `yaml` package for YAML parsing
- **Postman**: Use `postman-collection` package

### Schema-to-Example Generation

When no example exists, generate sample data from JSON Schema:
- `string` → `"string"`
- `integer` → `0`
- `boolean` → `true`
- `array` → `[]` with one item if items schema exists
- `object` → `{}` with properties filled

### Error Handling

| Error | User Message |
|-------|--------------|
| Invalid JSON/YAML | "Unable to parse file. Please check the syntax." |
| Invalid spec | "This doesn't appear to be a valid OpenAPI/Swagger spec." |
| URL fetch failed | "Couldn't fetch the spec from that URL. Please check it's accessible." |
| File too large | "File exceeds 5MB limit. Please use a smaller spec." |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Import adoption | 30% of new projects | % projects with import_history |
| Time to first endpoint | < 2 minutes | Analytics event tracking |
| Import success rate | > 95% | Successful imports / attempts |
| Endpoints per import | > 5 average | Sum endpoints / import count |

## Out of Scope (Future)

- Git repository sync (auto-import on push)
- Bi-directional sync (spec changes update endpoints)
- GraphQL schema import
- gRPC protobuf import
- Import scheduling (periodic refresh from URL)

## Implementation Phases

### Phase 1 (MVP)
- File upload for OpenAPI 3.0 JSON
- Basic preview with select/deselect
- Simple example extraction
- JSON export

### Phase 2
- YAML support
- Swagger 2.0 support
- URL import
- Schema-to-example generation
- YAML export

### Phase 3
- Postman collection import
- Import history tracking
- Improved error messages
