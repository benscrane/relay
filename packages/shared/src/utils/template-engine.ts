/**
 * Template engine for dynamic mock response generation.
 *
 * Supports three categories of template variables:
 *
 * 1. Built-in generators ($ prefix): {{$uuid}}, {{$randomInt}}, {{$timestamp}}, etc.
 * 2. Request context: {{request.method}}, {{request.header.Name}}, {{request.query.key}}, {{request.body.field}}
 * 3. Path parameters (backward compatible): {{paramName}}
 */

// --- Types ---

export interface TemplateContext {
  pathParams: Record<string, string>;
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    body: string | null;
  };
}

// --- Random data pools ---

const FIRST_NAMES = [
  'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi',
  'Ivan', 'Judy', 'Karl', 'Laura', 'Mallory', 'Nina', 'Oscar', 'Peggy',
  'Quinn', 'Rupert', 'Sybil', 'Trent', 'Ursula', 'Victor', 'Wendy', 'Xander',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas',
];

const EMAIL_DOMAINS = [
  'example.com', 'test.com', 'mock.dev', 'sample.org', 'demo.net',
];

const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';

// --- Helpers ---

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomUUID(): string {
  const hex = '0123456789abcdef';
  const sections = [8, 4, 4, 4, 12];
  return sections
    .map((len) => {
      let s = '';
      for (let i = 0; i < len; i++) {
        s += hex[Math.floor(Math.random() * 16)];
      }
      return s;
    })
    .join('-');
}

function randomString(length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
  }
  return s;
}

function randomEmail(): string {
  const first = randomElement(FIRST_NAMES).toLowerCase();
  const last = randomElement(LAST_NAMES).toLowerCase();
  const domain = randomElement(EMAIL_DOMAINS);
  return `${first}.${last}@${domain}`;
}

function randomName(): string {
  return `${randomElement(FIRST_NAMES)} ${randomElement(LAST_NAMES)}`;
}

// --- Built-in variable resolvers ---

type BuiltinResolver = () => string;

const BUILTIN_VARIABLES: Record<string, BuiltinResolver> = {
  '$uuid': () => randomUUID(),
  '$randomInt': () => String(randomInt(0, 1000)),
  '$randomFloat': () => (Math.random()).toFixed(2),
  '$randomBool': () => (Math.random() < 0.5 ? 'true' : 'false'),
  '$timestamp': () => new Date().toISOString(),
  '$timestampUnix': () => String(Math.floor(Date.now() / 1000)),
  '$date': () => new Date().toISOString().split('T')[0],
  '$randomEmail': () => randomEmail(),
  '$randomName': () => randomName(),
  '$randomString': () => randomString(16),
};

// --- Request context resolver ---

function resolveRequestVariable(
  path: string,
  context: TemplateContext
): string | undefined {
  const parts = path.split('.');

  // request.method
  if (parts.length === 2 && parts[1] === 'method') {
    return context.request.method;
  }

  // request.path
  if (parts.length === 2 && parts[1] === 'path') {
    return context.request.path;
  }

  // request.body (raw)
  if (parts.length === 2 && parts[1] === 'body') {
    return context.request.body ?? '';
  }

  // request.header.<name>
  if (parts.length >= 3 && parts[1] === 'header') {
    const headerName = parts.slice(2).join('.');
    // Case-insensitive header lookup
    const lowerName = headerName.toLowerCase();
    for (const [key, value] of Object.entries(context.request.headers)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return '';
  }

  // request.query.<name>
  if (parts.length >= 3 && parts[1] === 'query') {
    const queryName = parts.slice(2).join('.');
    return context.request.query[queryName] ?? '';
  }

  // request.body.<field.path> (JSON dot notation)
  if (parts.length >= 3 && parts[1] === 'body') {
    const fieldPath = parts.slice(2);
    return resolveJsonPath(context.request.body, fieldPath);
  }

  return undefined;
}

function resolveJsonPath(
  body: string | null,
  fieldPath: string[]
): string {
  if (!body) return '';

  try {
    let current: unknown = JSON.parse(body);
    for (const key of fieldPath) {
      if (current === null || current === undefined) return '';
      if (typeof current !== 'object') return '';
      current = (current as Record<string, unknown>)[key];
    }
    if (current === null || current === undefined) return '';
    if (typeof current === 'object') return JSON.stringify(current);
    return String(current);
  } catch {
    return '';
  }
}

// --- Main template processor ---

// Matches {{...}} patterns, capturing the variable name inside
const TEMPLATE_REGEX = /\{\{([^}]+)\}\}/g;

function resolveVariable(
  variableName: string,
  context: TemplateContext
): string | undefined {
  const name = variableName.trim();

  // 1. Built-in generators ($-prefixed)
  if (name.startsWith('$')) {
    const resolver = BUILTIN_VARIABLES[name];
    if (resolver) return resolver();
    return undefined;
  }

  // 2. Request context (request.*)
  if (name.startsWith('request.')) {
    return resolveRequestVariable(name, context);
  }

  // 3. Path parameters (backward compatible)
  if (name in context.pathParams) {
    return context.pathParams[name];
  }

  // Unknown variable - leave as-is
  return undefined;
}

/**
 * Process all template variables in a response body string.
 *
 * Replaces {{variable}} placeholders with their resolved values.
 * Unknown variables are left unchanged.
 */
export function processTemplate(
  template: string,
  context: TemplateContext
): string {
  return template.replace(TEMPLATE_REGEX, (match, variableName: string) => {
    const resolved = resolveVariable(variableName, context);
    return resolved !== undefined ? resolved : match;
  });
}

/**
 * Strip template variables from a string for JSON validation purposes.
 *
 * Replaces {{...}} tokens with context-appropriate placeholders so that
 * JSON.parse can validate the surrounding structure even when template
 * variables are present.
 */
export function stripTemplatesForValidation(str: string): string {
  let result = '';
  let inString = false;
  let i = 0;

  while (i < str.length) {
    // Handle string boundaries (skip escaped quotes)
    if (str[i] === '"' && (i === 0 || str[i - 1] !== '\\')) {
      inString = !inString;
      result += str[i];
      i++;
      continue;
    }

    // Handle template tokens
    if (str[i] === '{' && str[i + 1] === '{') {
      const end = str.indexOf('}}', i + 2);
      if (end !== -1) {
        if (inString) {
          // Inside a JSON string: replace with plain text placeholder
          result += '__tpl__';
        } else {
          // Outside a JSON string: replace with valid JSON value
          result += '"__tpl__"';
        }
        i = end + 2;
        continue;
      }
    }

    result += str[i];
    i++;
  }

  return result;
}

/** List of supported built-in variable names (for UI display) */
export const TEMPLATE_VARIABLES = Object.keys(BUILTIN_VARIABLES);
