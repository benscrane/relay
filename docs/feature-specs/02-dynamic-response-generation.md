# Feature Specification: Dynamic Response Generation

## Overview

Enable users to generate realistic, dynamic mock responses using template expressions, fake data generators, and conditional logic. This transforms static JSON responses into intelligent, context-aware mocks that behave more like real APIs.

## Problem Statement

Current mockd responses are static JSON blobs. This creates several limitations:
- Testing pagination requires manually creating multiple endpoints
- Realistic user data requires manually typing fake names, emails, etc.
- Cannot simulate different responses based on request parameters
- Cannot test scenarios like "user not found" vs "user found"
- Lists always return the same items

## User Stories

### Fake Data Generation

1. **As a developer**, I want to use template variables like `{{faker.name}}` so that I get realistic fake data in responses.

2. **As a developer**, I want to generate arrays of fake items so that I can test list/pagination scenarios.

3. **As a developer**, I want fake data to be deterministic based on a seed so that I get consistent results for testing.

### Dynamic Templates

4. **As a developer**, I want to echo back request body fields in responses so that I can simulate create/update operations.

5. **As a developer**, I want to use path parameters in response bodies so that `/users/123` returns `{"id": 123}`.

6. **As a developer**, I want to use query parameters in responses so that `?page=2` affects the response.

7. **As a developer**, I want to generate timestamps relative to "now" so that my mock data always looks fresh.

### Conditional Logic

8. **As a developer**, I want to return different responses based on request headers so that I can test authentication scenarios.

9. **As a developer**, I want to return 404 for certain IDs so that I can test error handling.

10. **As a developer**, I want to randomly fail some percentage of requests so that I can test retry logic.

## Functional Requirements

### FR-1: Faker Data Functions

| Function | Example Output | Description |
|----------|---------------|-------------|
| `{{faker.uuid}}` | `"f47ac10b-58cc..."` | Random UUID v4 |
| `{{faker.firstName}}` | `"John"` | Random first name |
| `{{faker.lastName}}` | `"Smith"` | Random last name |
| `{{faker.fullName}}` | `"John Smith"` | Random full name |
| `{{faker.email}}` | `"john@example.com"` | Random email |
| `{{faker.username}}` | `"johnsmith42"` | Random username |
| `{{faker.phone}}` | `"+1-555-123-4567"` | Random phone |
| `{{faker.avatar}}` | `"https://..."` | Random avatar URL |
| `{{faker.streetAddress}}` | `"123 Main St"` | Random address |
| `{{faker.city}}` | `"New York"` | Random city |
| `{{faker.country}}` | `"United States"` | Random country |
| `{{faker.zipCode}}` | `"10001"` | Random zip/postal |
| `{{faker.latitude}}` | `40.7128` | Random latitude |
| `{{faker.longitude}}` | `-74.0060` | Random longitude |
| `{{faker.companyName}}` | `"Acme Corp"` | Random company |
| `{{faker.jobTitle}}` | `"Software Engineer"` | Random job title |
| `{{faker.sentence}}` | `"Lorem ipsum..."` | Random sentence |
| `{{faker.paragraph}}` | `"Lorem ipsum..."` | Random paragraph |
| `{{faker.number(1,100)}}` | `42` | Random integer in range |
| `{{faker.float(0,1,2)}}` | `0.75` | Random float (min,max,decimals) |
| `{{faker.boolean}}` | `true` | Random boolean |
| `{{faker.date}}` | `"2024-01-15"` | Random past date |
| `{{faker.futureDate}}` | `"2025-06-20"` | Random future date |
| `{{faker.timestamp}}` | `1705334400` | Random Unix timestamp |
| `{{faker.imageUrl(200,200)}}` | `"https://..."` | Placeholder image URL |
| `{{faker.color}}` | `"#3498db"` | Random hex color |
| `{{faker.word}}` | `"synergy"` | Random word |
| `{{faker.slug}}` | `"hello-world"` | Random URL slug |

### FR-2: Request Context Variables

| Variable | Description |
|----------|-------------|
| `{{path.paramName}}` | URL path parameter |
| `{{query.paramName}}` | Query string parameter |
| `{{header.headerName}}` | Request header value |
| `{{body.fieldName}}` | Request body field (dot notation for nested) |
| `{{body}}` | Entire request body |
| `{{method}}` | HTTP method |
| `{{url}}` | Full request URL |

### FR-3: Utility Functions

| Function | Example Output | Description |
|----------|---------------|-------------|
| `{{now}}` | `"2024-01-15T10:30:00Z"` | Current ISO timestamp |
| `{{nowUnix}}` | `1705315800` | Current Unix timestamp |
| `{{dateAdd(days=7)}}` | `"2024-01-22T..."` | Date relative to now |
| `{{dateSub(hours=2)}}` | `"2024-01-15T08:..."` | Date relative to now |
| `{{randomItem(["a","b","c"])}}` | `"b"` | Random array item |
| `{{randomInt(1,10)}}` | `7` | Random integer |
| `{{hash(path.id)}}` | `"a1b2c3..."` | Deterministic hash |
| `{{lowercase(value)}}` | `"hello"` | Lowercase string |
| `{{uppercase(value)}}` | `"HELLO"` | Uppercase string |
| `{{default(value, "fallback")}}` | value or "fallback" | Default if empty |

### FR-4: Array Generation

```json
{
  "users": "{{repeat(5, {
    \"id\": \"{{faker.uuid}}\",
    \"name\": \"{{faker.fullName}}\",
    \"email\": \"{{faker.email}}\"
  })}}"
}
```

Output:
```json
{
  "users": [
    { "id": "f47ac10b-...", "name": "John Smith", "email": "john@..." },
    { "id": "a23bc45d-...", "name": "Jane Doe", "email": "jane@..." },
    // ... 3 more items
  ]
}
```

| Function | Description |
|----------|-------------|
| `{{repeat(count, template)}}` | Generate array with count items |
| `{{repeat(min, max, template)}}` | Generate array with random count |
| `{{repeatQuery(query.limit, template)}}` | Generate array with count from query param |
| `{{index}}` | Current index in repeat (0-based) |
| `{{index1}}` | Current index in repeat (1-based) |

### FR-5: Conditional Logic

```json
{
  "{{#if header.Authorization}}": {
    "authenticated": true,
    "user": {
      "name": "{{faker.fullName}}"
    }
  },
  "{{else}}": {
    "authenticated": false,
    "error": "Unauthorized"
  }
}
```

| Syntax | Description |
|--------|-------------|
| `{{#if condition}}...{{/if}}` | Conditional block |
| `{{#if condition}}...{{else}}...{{/if}}` | If/else block |
| `{{#unless condition}}...{{/unless}}` | Negated conditional |
| `{{eq(a, b)}}` | Equality check |
| `{{ne(a, b)}}` | Not equal check |
| `{{gt(a, b)}}` | Greater than |
| `{{lt(a, b)}}` | Less than |
| `{{contains(str, substr)}}` | String contains |
| `{{exists(value)}}` | Value exists/truthy |

### FR-6: Response Behavior Modifiers

Configure at endpoint or rule level:

| Setting | Description |
|---------|-------------|
| `seed` | Deterministic randomness seed |
| `failRate` | Percentage of requests to fail (0-100) |
| `failStatus` | Status code for failures (default 500) |
| `failBody` | Response body for failures |

### FR-7: Special Responses

```json
{
  "{{#status 404 if eq(path.id, '0')}}": true,
  "id": "{{path.id}}",
  "name": "{{faker.fullName}}"
}
```

| Directive | Description |
|-----------|-------------|
| `{{#status code if condition}}` | Override status conditionally |
| `{{#delay ms if condition}}` | Add delay conditionally |
| `{{#header name value}}` | Set response header |

## API Design

### Endpoint Schema Extension

```typescript
interface Endpoint {
  // ... existing fields
  responseTemplate: string;        // Template with expressions
  responseType: 'static' | 'dynamic';
  dynamicSettings?: {
    seed?: string;                 // For deterministic output
    failRate?: number;             // 0-100
    failStatus?: number;           // Status on failure
    failBody?: string;             // Body on failure
  };
}
```

### Template Validation Endpoint

```
POST /api/templates/validate
Content-Type: application/json

{
  "template": "{\"name\": \"{{faker.fullName}}\"}",
  "sampleContext": {
    "path": { "id": "123" },
    "query": { "page": "1" },
    "body": { "name": "test" }
  }
}

Response 200:
{
  "valid": true,
  "preview": {
    "name": "John Smith"
  },
  "warnings": []
}

Response 200 (with errors):
{
  "valid": false,
  "errors": [
    {
      "expression": "{{faker.invalid}}",
      "message": "Unknown faker function: invalid",
      "line": 1,
      "column": 12
    }
  ]
}
```

## Database Schema Changes

Update endpoints table in Durable Object:

```sql
ALTER TABLE endpoints ADD COLUMN response_type TEXT DEFAULT 'static';
ALTER TABLE endpoints ADD COLUMN dynamic_seed TEXT;
ALTER TABLE endpoints ADD COLUMN fail_rate INTEGER DEFAULT 0;
ALTER TABLE endpoints ADD COLUMN fail_status INTEGER DEFAULT 500;
ALTER TABLE endpoints ADD COLUMN fail_body TEXT;
```

## UI/UX Design

### Response Editor Enhancement

```
┌─────────────────────────────────────────────────────────────────┐
│  Response Body                                                  │
├─────────────────────────────────────────────────────────────────┤
│  ○ Static JSON    ● Dynamic Template                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1  {                                                    │    │
│  │ 2    "id": "{{path.id}}",                               │    │
│  │ 3    "name": "{{faker.fullName}}",                      │    │
│  │ 4    "email": "{{faker.email}}",                        │    │
│  │ 5    "createdAt": "{{now}}"                             │    │
│  │ 6  }                                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─ Insert ──────────────────────────────────────────────────┐  │
│  │ 👤 Person  📍 Address  🏢 Company  📅 Date  🔢 Number  📝 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Preview ─────────────────────────────────────────────────┐  │
│  │ {                                                         │  │
│  │   "id": "123",                                            │  │
│  │   "name": "Emily Johnson",                                │  │
│  │   "email": "emily.johnson@example.com",                   │  │
│  │   "createdAt": "2024-01-15T10:30:00Z"                     │  │
│  │ }                                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ⟳ Regenerate Preview    Context: path.id = "123"              │
└─────────────────────────────────────────────────────────────────┘
```

### Insert Menu (Dropdown)

```
┌─ 👤 Person ─────────────┐
│ {{faker.fullName}}      │
│ {{faker.firstName}}     │
│ {{faker.lastName}}      │
│ {{faker.email}}         │
│ {{faker.username}}      │
│ {{faker.phone}}         │
│ {{faker.avatar}}        │
└─────────────────────────┘
```

### Advanced Settings Panel

```
┌─ Dynamic Settings ──────────────────────────────────────────────┐
│                                                                 │
│  Seed (optional)         ┌────────────────────────────────┐    │
│  For consistent output   │ my-seed-123                    │    │
│                          └────────────────────────────────┘    │
│                                                                 │
│  Random Failure Rate     ┌────────┐                            │
│  Simulate errors         │ 10     │ % of requests              │
│                          └────────┘                            │
│                                                                 │
│  Failure Status          ┌────────┐                            │
│                          │ 500    │ ▼                          │
│                          └────────┘                            │
│                                                                 │
│  Failure Response Body                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ {"error": "Internal server error", "code": "ERR_500"}    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Considerations

### Template Engine

Use a custom lightweight template engine (not Handlebars/Mustache to avoid XSS vectors):

```typescript
class TemplateEngine {
  private faker: FakerInstance;
  private context: RequestContext;

  evaluate(template: string): unknown {
    // Parse template into AST
    const ast = this.parse(template);
    // Evaluate with sandbox (no eval/Function)
    return this.evaluateNode(ast);
  }
}
```

### Security Considerations

1. **No arbitrary code execution** - Only whitelisted functions
2. **No file system access** - Templates are pure functions
3. **No network access** - Cannot make external requests
4. **Recursion limits** - Max 10 levels of nesting
5. **Output size limits** - Max 5MB response
6. **Iteration limits** - Max 1000 items in repeat()

### Performance

1. **Parse once, execute many** - Cache parsed AST
2. **Lazy faker generation** - Only generate used fields
3. **Streaming for large arrays** - Don't buffer entire response

### Deterministic Mode

When seed is provided:
- Use seeded PRNG (e.g., seedrandom)
- Same seed + same template = same output
- Useful for snapshot testing

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dynamic template adoption | 40% of endpoints | % endpoints with response_type='dynamic' |
| Faker function usage | 5 avg per template | Count of faker expressions |
| Template validation errors | < 10% | Failed validations / total |
| Response generation time | < 50ms p95 | Timing metrics |

## Out of Scope (Future)

- Custom faker locale (non-English names)
- User-defined functions
- External data sources (databases, files)
- Stateful mocks (counters, sequences)
- GraphQL response generation
- Response streaming

## Implementation Phases

### Phase 1 (MVP)
- Basic faker functions (name, email, uuid, number)
- Path parameter interpolation
- Query parameter interpolation
- Live preview in editor

### Phase 2
- Full faker function library
- Request body interpolation
- repeat() for arrays
- Conditional blocks (if/else)
- Insert menu UI

### Phase 3
- Advanced functions (dateAdd, hash)
- Failure rate simulation
- Deterministic seeds
- Status code overrides
- Template validation API
