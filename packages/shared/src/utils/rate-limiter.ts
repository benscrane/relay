/**
 * Rate limiting utilities for endpoint-level rate limiting.
 * Uses a fixed-window algorithm with 1-minute windows.
 */

export const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

/**
 * Generate a storage key for rate limiting based on endpoint ID and current time window.
 */
export function getWindowKey(endpointId: string, windowMs: number = RATE_LIMIT_WINDOW_MS): string {
  const windowStart = Math.floor(Date.now() / windowMs);
  return `rate:${endpointId}:${windowStart}`;
}

/**
 * Calculate the rate limit headers to include in responses.
 */
export function calculateRateLimitHeaders(
  limit: number,
  count: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS
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

export interface RateLimitExceededData {
  body: string;
  status: 429;
  headers: Record<string, string>;
}

/**
 * Get data for a 429 Rate Limit Exceeded response.
 * The caller should use this data to construct the actual Response object.
 */
export function getRateLimitExceededData(
  limit: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): RateLimitExceededData {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = Math.ceil((windowStart + windowMs) / 1000);
  const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);

  return {
    body: JSON.stringify({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      limit,
      retryAfter,
    }),
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetAt),
      'Retry-After': String(retryAfter),
    },
  };
}
