# Feature Specifications

This directory contains detailed product specifications for the top 5 missing features identified for mockd.

## Overview

mockd is a mock API server platform built on Cloudflare Workers. After a comprehensive product review, the following features were identified as critical gaps for a B2C SaaS product.

## Feature Priority Matrix

| # | Feature | Acquisition | Retention | Monetization | Effort | Priority |
|---|---------|-------------|-----------|--------------|--------|----------|
| 1 | [OpenAPI Import/Export](./01-openapi-import-export.md) | High | Medium | Low | Medium | **P0** |
| 2 | [Dynamic Response Generation](./02-dynamic-response-generation.md) | Medium | High | Medium | Medium | **P0** |
| 3 | [Usage Analytics Dashboard](./03-usage-analytics-dashboard.md) | Low | High | High | Medium | **P1** |
| 4 | [Team Collaboration](./04-team-collaboration.md) | High | High | High | High | **P1** |
| 5 | [API Documentation Generation](./05-api-documentation-generation.md) | High | Medium | Low | Medium | **P2** |

## Recommended Implementation Order

### Phase 1: Reduce Onboarding Friction
1. **OpenAPI Import** - Let developers import existing specs instantly
2. **Dynamic Responses (MVP)** - Basic faker functions and path interpolation

### Phase 2: Increase Retention & Stickiness
3. **Analytics Dashboard** - Show usage insights and drive upgrades
4. **Dynamic Responses (Full)** - Conditional logic, arrays, advanced functions

### Phase 3: Enable Growth
5. **Team Collaboration** - Unlock B2B revenue and viral growth
6. **API Documentation** - Create shareable artifacts that drive signups

## Specifications

### 1. OpenAPI/Swagger Import & Export
**File:** [01-openapi-import-export.md](./01-openapi-import-export.md)

Import existing OpenAPI 3.0/Swagger 2.0 specifications to auto-generate mock endpoints. Export projects as OpenAPI specs.

**Key Features:**
- File upload and URL import
- Postman collection import
- Preview and selective import
- Schema-to-example generation
- JSON/YAML export

---

### 2. Dynamic Response Generation
**File:** [02-dynamic-response-generation.md](./02-dynamic-response-generation.md)

Generate realistic, dynamic mock responses using template expressions, fake data generators, and conditional logic.

**Key Features:**
- 50+ faker functions (names, emails, addresses, etc.)
- Request context interpolation (path, query, body, headers)
- Array generation with `repeat()`
- Conditional responses with `if/else`
- Random failure simulation

---

### 3. Usage Analytics Dashboard
**File:** [03-usage-analytics-dashboard.md](./03-usage-analytics-dashboard.md)

Aggregated insights into mock API usage with visual dashboards showing request volumes, error rates, and response times.

**Key Features:**
- Request volume over time charts
- Quota usage visualization
- Error rate tracking
- Response time percentiles
- Usage alerts at thresholds

---

### 4. Team Collaboration & Sharing
**File:** [04-team-collaboration.md](./04-team-collaboration.md)

Enable multiple users to collaborate on mock API projects through team workspaces with role-based access control.

**Key Features:**
- Team workspaces
- Role-based permissions (admin, editor, viewer)
- Email invitations
- Project transfer between personal/team
- Activity feed and audit log
- External share links

---

### 5. API Documentation Generation
**File:** [05-api-documentation-generation.md](./05-api-documentation-generation.md)

Automatically generate beautiful, shareable API documentation from mock endpoints with interactive testing.

**Key Features:**
- Auto-generated docs pages
- Public shareable URLs
- Interactive "Try It" testing
- Code snippet generation (cURL, JS, Python)
- Custom branding
- Markdown support

---

## Database Changes Summary

### D1 (Central Database)

| Feature | New Tables |
|---------|------------|
| OpenAPI Import | `import_history` (optional) |
| Analytics | `analytics_hourly`, `analytics_daily`, `alert_settings`, `alert_history` |
| Teams | `teams`, `team_members`, `team_invitations`, `share_links`, `activity_log` |
| Documentation | `docs_settings`, `docs_customization` |

### Durable Objects (Per-Project)

| Feature | Schema Changes |
|---------|----------------|
| Dynamic Responses | `response_type`, `dynamic_seed`, `fail_rate`, `fail_status`, `fail_body` |
| Documentation | `docs_title`, `docs_description`, `docs_tags`, `docs_deprecated`, etc. |

## Tier Impact

| Feature | Free | Pro ($12/mo) | Team |
|---------|------|--------------|------|
| OpenAPI Import | 1/day | Unlimited | Unlimited |
| Dynamic Responses | Basic | Full | Full |
| Analytics Retention | 7 days | 30 days | 90 days |
| Teams | 0 | 1 team, 5 members | 5 teams, 25 members |
| Public Docs | 1 project | Unlimited | Unlimited + custom domain |

## Success Metrics

| Feature | Primary Metric | Target |
|---------|---------------|--------|
| OpenAPI Import | Time to first endpoint | < 2 minutes |
| Dynamic Responses | % endpoints using templates | 40% |
| Analytics | Weekly dashboard visits | 50% of active users |
| Teams | Avg team size | 3+ members |
| Documentation | External referral signups | 5% of signups |

## Next Steps

1. Review specs with engineering team for feasibility
2. Refine effort estimates
3. Create detailed technical designs for Phase 1
4. Build prototypes for user testing
5. Prioritize based on customer feedback
