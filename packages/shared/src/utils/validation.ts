import { TIER_LIMITS, type Tier } from '../constants';

/**
 * Calculate UTF-8 byte length of a string without requiring TextEncoder.
 * Works in all JavaScript environments.
 */
function getUtf8ByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // Surrogate pair (4 bytes for the pair)
      bytes += 4;
      i++; // Skip the low surrogate
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export interface ValidationError {
  error: string;
  code: string;
  field: string;
  limit?: number;
  actual?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface EndpointInput {
  path?: string;
  responseBody?: string;
  statusCode?: number;
  delay?: number;
}

/**
 * Validates endpoint creation/update data against tier limits.
 * Returns validation result with detailed errors.
 */
export function validateEndpointInput(
  input: EndpointInput,
  tier: Tier,
  options: { requirePath?: boolean } = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  const limits = TIER_LIMITS[tier];

  // Path validation (required for creation)
  if (options.requirePath) {
    if (!input.path || typeof input.path !== 'string') {
      errors.push({
        error: 'Path is required',
        code: 'PATH_REQUIRED',
        field: 'path',
      });
    } else if (!input.path.startsWith('/')) {
      errors.push({
        error: 'Path must start with /',
        code: 'PATH_INVALID',
        field: 'path',
      });
    }
  }

  // Response body size validation
  if (input.responseBody !== undefined) {
    const bodySize = getUtf8ByteLength(input.responseBody);
    if (bodySize > limits.maxResponseSize) {
      errors.push({
        error: `Response body exceeds ${tier} tier limit of ${formatBytes(limits.maxResponseSize)}`,
        code: 'RESPONSE_BODY_TOO_LARGE',
        field: 'responseBody',
        limit: limits.maxResponseSize,
        actual: bodySize,
      });
    }
  }

  // Status code validation (valid HTTP status codes: 100-599)
  if (input.statusCode !== undefined) {
    if (
      typeof input.statusCode !== 'number' ||
      !Number.isInteger(input.statusCode) ||
      input.statusCode < 100 ||
      input.statusCode > 599
    ) {
      errors.push({
        error: 'Status code must be a valid HTTP status (100-599)',
        code: 'STATUS_CODE_INVALID',
        field: 'statusCode',
      });
    }
  }

  // Delay validation
  if (input.delay !== undefined) {
    if (typeof input.delay !== 'number' || input.delay < 0) {
      errors.push({
        error: 'Delay must be a non-negative number',
        code: 'DELAY_INVALID',
        field: 'delay',
      });
    } else if (input.delay > limits.maxDelay) {
      errors.push({
        error: `Delay exceeds ${tier} tier limit of ${limits.maxDelay}ms`,
        code: 'DELAY_TOO_LONG',
        field: 'delay',
        limit: limits.maxDelay,
        actual: input.delay,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}
