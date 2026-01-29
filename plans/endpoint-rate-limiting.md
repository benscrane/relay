# Endpoint-Level Rate Limiting Implementation Plan

## Overview

Implement configurable rate limiting at the endpoint level with a default of 120 requests per minute per endpoint. Rate limits will be configurable per endpoint and constrained by the subscription tier of the endpoint owner.

## Current State

- **No rate limiting exists** - requests are unlimited
- **Tier limits defined but not enforced** in `packages/shared/src/constants/limits.ts`
- **Request handling** occurs in `EndpointDO.handleMockRequest()` at `workers/endpoint/src/EndpointDO.ts:509-602`
- **Durable Object storage** available for real-time counters (`this.ctx.storage`)
- **Usage tracking table** exists in D1 (`usage_daily`) but unused

## Requirements

1. Default rate limit: 120 requests/minute/endpoint
2. Rate limit configurable per endpoint
3. Maximum rate limit constrained by owner's subscription tier
4. Return 429 status with standard rate limit headers when exceeded
5. Minimal latency impact on request handling

---

## Implementation Tasks

### Task 1: Database Schema Updates

**File**: `migrations/0008_add_endpoint_rate_limit.sql` (new)

Add `rate_limit` column to the endpoints table in Durable Object SQLite schema.

```sql
-- This will be applied in EndpointDO.ts initializeDatabase()
ALTER TABLE endpoints ADD COLUMN rate_limit INTEGER DEFAULT 120;
```

**File**: `workers/endpoint/src/EndpointDO.ts`

Update the `initializeDatabase()` method to add the column if it doesn't exist:

```typescript
// Add after existing table creation
this.db.exec(`
  ALTER TABLE endpoints ADD COLUMN rate_limit INTEGER DEFAULT 120;
`).catch(() => {
  // Column already exists, ignore error
});
```

Update the `Endpoint` interface and all queries that select/insert/update endpoints.

---

### Task 2: Update Tier Limits Configuration

**File**: `packages/shared/src/constants/limits.ts`

Add rate limiting configuration to tier limits:

```typescript
export const TIER_LIMITS = {
  free: {
    // ... existing limits
    defaultEndpointRateLimit: 60,   // requests per minute
    maxEndpointRateLimit: 120,      // max configurable
  },
  pro: {
    // ... existing limits
    defaultEndpointRateLimit: 120,
    maxEndpointRateLimit: 600,
  },
  team: {
    // ... existing limits
    defaultEndpointRateLimit: 300,
    maxEndpointRateLimit: 3000,
  },
};

export type Tier = keyof typeof TIER_LIMITS;
```

---

### Task 3: Create Rate Limiter Utility

**File**: `packages/shared/src/utils/rate-limiter.ts` (new)

```typescript
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp in seconds
}

export interface RateLimitConfig {
  limit: number;        // requests per window
  windowMs: number;     // window size in milliseconds (60000 for 1 minute)
}

/**
 * Fixed window rate limiter using Durable Object storage
 */
export function getWindowKey(endpointId: string, windowMs: number): string {
  const windowStart = Math.floor(Date.now() / windowMs);
  return `rate:${endpointId}:${windowStart}`;
}

export function calculateRateLimitHeaders(
  limit: number,
  count: number,
  windowMs: number
): Record<string, string> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = Math.ceil((windowStart + windowMs) / 1000);
  const remaining = Math.max(0, limit - count);

  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetAt),
  };
}

export function rateLimitExceededResponse(
  limit: number,
  windowMs: number
): Response {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = Math.ceil((windowStart + windowMs) / 1000);
  const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      limit,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(resetAt),
        'Retry-After': String(retryAfter),
      },
    }
  );
}
```

---

### Task 4: Implement Rate Limiting in EndpointDO

**File**: `workers/endpoint/src/EndpointDO.ts`

Update `handleMockRequest()` to check and enforce rate limits:

```typescript
import {
  getWindowKey,
  calculateRateLimitHeaders,
  rateLimitExceededResponse,
} from '@mockd/shared/utils/rate-limiter';

// Inside handleMockRequest(), after endpoint is matched but before response:

private async checkRateLimit(endpointId: string, limit: number): Promise<{
  allowed: boolean;
  count: number;
}> {
  const windowMs = 60000; // 1 minute
  const key = getWindowKey(endpointId, windowMs);

  const count = (await this.ctx.storage.get<number>(key)) ?? 0;

  if (count >= limit) {
    return { allowed: false, count };
  }

  // Increment counter with TTL (auto-expires after 2 windows)
  await this.ctx.storage.put(key, count + 1, {
    expirationTtl: Math.ceil(windowMs * 2 / 1000)
  });

  return { allowed: true, count: count + 1 };
}

// In handleMockRequest(), after finding the matched endpoint:
const rateLimit = endpoint.rate_limit ?? 120;
const { allowed, count } = await this.checkRateLimit(endpoint.id, rateLimit);

if (!allowed) {
  return rateLimitExceededResponse(rateLimit, 60000);
}

// Add rate limit headers to successful responses
const rateLimitHeaders = calculateRateLimitHeaders(rateLimit, count, 60000);
// Merge these headers into the response
```

---

### Task 5: Validate Rate Limits in API Routes

**File**: `workers/api/src/router.ts`

When creating or updating endpoints, validate that the requested rate limit doesn't exceed the user's tier maximum:

```typescript
import { TIER_LIMITS } from '@mockd/shared/constants/limits';

// In POST /projects/:projectId/endpoints
// In PUT /projects/:projectId/endpoints/:id

const user = c.get('user');
const tier = user?.tier ?? 'free';
const tierLimits = TIER_LIMITS[tier];

if (requestedRateLimit && requestedRateLimit > tierLimits.maxEndpointRateLimit) {
  return c.json({
    error: `Rate limit exceeds maximum for ${tier} tier (${tierLimits.maxEndpointRateLimit}/min)`,
    code: 'RATE_LIMIT_EXCEEDS_TIER',
  }, 400);
}

// Use default if not specified
const rateLimit = requestedRateLimit ?? tierLimits.defaultEndpointRateLimit;
```

---

### Task 6: Store Project Owner Tier in Durable Object

The `EndpointDO` needs to know the owner's tier to enforce maximum rate limits. Options:

**Option A: Cache tier in DO storage** (Recommended)

When project is created or tier changes, update DO storage:

```typescript
// In EndpointDO
private async getOwnerTier(): Promise<Tier> {
  return (await this.ctx.storage.get<Tier>('ownerTier')) ?? 'free';
}

// Called when project is created or tier updated
async setOwnerTier(tier: Tier): Promise<void> {
  await this.ctx.storage.put('ownerTier', tier);
}
```

Add an internal endpoint to update tier:

```typescript
// In EndpointDO.fetch()
if (path === '/__internal/set-tier' && request.method === 'POST') {
  const { tier } = await request.json();
  await this.setOwnerTier(tier);
  return new Response('OK');
}
```

**Option B: Pass tier in request header**

Less efficient (requires lookup on every request), but simpler:

```typescript
// In workers/endpoint/src/index.ts, before calling DO
const project = await getProjectFromD1(subdomain);
const tier = project?.user?.tier ?? 'free';

// Add header to request
const modifiedRequest = new Request(request, {
  headers: { ...request.headers, 'X-Owner-Tier': tier }
});
```

---

### Task 7: Update Shared Types

**File**: `packages/shared/src/types/endpoint.ts`

```typescript
export interface Endpoint {
  id: string;
  method: string;
  path: string;
  response_body: string;
  status_code: number;
  delay_ms: number;
  rate_limit: number;  // Add this field
  created_at: string;
  updated_at: string;
}

export interface CreateEndpointRequest {
  method: string;
  path: string;
  response_body?: string;
  status_code?: number;
  delay_ms?: number;
  rate_limit?: number;  // Add this field
}

export interface UpdateEndpointRequest {
  method?: string;
  path?: string;
  response_body?: string;
  status_code?: number;
  delay_ms?: number;
  rate_limit?: number;  // Add this field
}
```

---

### Task 8: Update Frontend (Optional)

**File**: `packages/web/src/components/EndpointForm.tsx` (or similar)

Add UI for configuring endpoint rate limit:

- Number input for rate limit (requests per minute)
- Show maximum allowed based on user's tier
- Display current usage if available

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `workers/endpoint/src/EndpointDO.ts` | Modify | Add rate limit check, schema update, tier storage |
| `packages/shared/src/constants/limits.ts` | Modify | Add rate limit tier configurations |
| `packages/shared/src/utils/rate-limiter.ts` | Create | Rate limiting utility functions |
| `packages/shared/src/types/endpoint.ts` | Modify | Add rate_limit field to types |
| `workers/api/src/router.ts` | Modify | Validate rate limit against tier on create/update |
| `workers/endpoint/src/index.ts` | Modify | (Option B only) Pass tier header to DO |
| `packages/web/src/...` | Modify | (Optional) UI for rate limit configuration |

---

## Testing Plan

1. **Unit tests** for rate limiter utility functions
2. **Integration tests**:
   - Verify 120 requests/min allowed, 121st returns 429
   - Verify rate limit headers present on all responses
   - Verify custom rate limits respected
   - Verify tier maximum enforced on endpoint creation
3. **Load testing**: Ensure rate limiting doesn't significantly impact latency

---

## Rollout Plan

1. Deploy rate limiter utility and types (no behavior change)
2. Deploy schema migration (adds column with default)
3. Deploy API validation (prevents invalid rate limits)
4. Deploy rate limiting enforcement in EndpointDO
5. Monitor for 429 responses and latency impact
6. (Optional) Deploy frontend UI for configuration

---

## Future Enhancements

- **Sliding window** instead of fixed window for smoother rate limiting
- **Burst allowance**: Allow short bursts above limit
- **Per-IP rate limiting**: Limit by client IP in addition to endpoint
- **Rate limit analytics**: Dashboard showing rate limit hits
- **Webhook notifications**: Alert when approaching limits
