import type { CreateEndpointRequest } from '@mockd/shared';

interface ParsedCurl {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string>;
  body: string | null;
}

/**
 * Tokenize a cURL command string, handling quoted strings and escaped characters.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  // Normalize line continuations (backslash + newline)
  const normalized = input.replace(/\\\n\s*/g, ' ').trim();

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && !inSingle) {
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if ((ch === ' ' || ch === '\t') && !inSingle && !inDouble) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Extract the path from a URL string.
 */
function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || '/';
  } catch {
    // If it's not a valid URL, try to extract path from the string
    const match = url.match(/^https?:\/\/[^/]+(\/.*?)(?:\?.*)?$/);
    if (match) return match[1];
    // Maybe it's just a path already
    if (url.startsWith('/')) return url.split('?')[0];
    return '/';
  }
}

/**
 * Parse a cURL command string into structured data.
 */
export function parseCurl(curlCommand: string): ParsedCurl {
  const trimmed = curlCommand.trim();
  if (!trimmed.toLowerCase().startsWith('curl')) {
    throw new Error('Input must be a valid cURL command starting with "curl"');
  }

  const tokens = tokenize(trimmed);
  let method = 'GET';
  let url = '';
  const headers: Record<string, string> = {};
  let body: string | null = null;

  let i = 1; // skip "curl"
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      i++;
      if (i < tokens.length) {
        method = tokens[i].toUpperCase();
      }
    } else if (token === '-H' || token === '--header') {
      i++;
      if (i < tokens.length) {
        const headerStr = tokens[i];
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx > 0) {
          const key = headerStr.substring(0, colonIdx).trim();
          const value = headerStr.substring(colonIdx + 1).trim();
          headers[key] = value;
        }
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      i++;
      if (i < tokens.length) {
        body = tokens[i];
        // If body is present and method wasn't explicitly set, default to POST
        if (method === 'GET') {
          method = 'POST';
        }
      }
    } else if (token === '--data-urlencode') {
      i++;
      if (i < tokens.length) {
        // --data-urlencode encodes the value and appends to body
        const part = tokens[i];
        if (body) {
          body += '&' + encodeURIComponent(part).replace(/%3D/, '=');
        } else {
          body = encodeURIComponent(part).replace(/%3D/, '=');
        }
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        if (method === 'GET') {
          method = 'POST';
        }
      }
    } else if (token === '--json') {
      i++;
      if (i < tokens.length) {
        body = tokens[i];
        headers['Content-Type'] = 'application/json';
        if (method === 'GET') {
          method = 'POST';
        }
      }
    } else if (token === '--url') {
      i++;
      if (i < tokens.length) {
        url = tokens[i];
      }
    } else if (
      token === '-s' || token === '--silent' ||
      token === '-S' || token === '--show-error' ||
      token === '-k' || token === '--insecure' ||
      token === '-v' || token === '--verbose' ||
      token === '-i' || token === '--include' ||
      token === '-L' || token === '--location' ||
      token === '-f' || token === '--fail' ||
      token === '--compressed'
    ) {
      // Skip boolean flags
    } else if (
      token === '-o' || token === '--output' ||
      token === '-u' || token === '--user' ||
      token === '-A' || token === '--user-agent' ||
      token === '-e' || token === '--referer' ||
      token === '--connect-timeout' ||
      token === '-m' || token === '--max-time' ||
      token === '--retry' ||
      token === '-w' || token === '--write-out'
    ) {
      // Skip flags that take a value
      i++;
    } else if (!token.startsWith('-') && !url) {
      // Positional argument = URL
      url = token;
    }

    i++;
  }

  if (!url) {
    throw new Error('No URL found in cURL command');
  }

  const path = extractPath(url);

  return { method, url, path, headers, body };
}

/**
 * Convert a parsed cURL command into a CreateEndpointRequest.
 */
export function curlToEndpoint(curlCommand: string): CreateEndpointRequest {
  const parsed = parseCurl(curlCommand);

  let responseBody = '{}';
  if (parsed.body) {
    try {
      // Validate it's JSON and pretty-print it
      const parsed_ = JSON.parse(parsed.body);
      responseBody = JSON.stringify(parsed_, null, 2);
    } catch {
      // Use as-is wrapped in a JSON message
      responseBody = JSON.stringify({ message: "Mock response", receivedBody: parsed.body }, null, 2);
    }
  } else {
    responseBody = JSON.stringify({ message: "Mock response" }, null, 2);
  }

  return {
    path: parsed.path,
    responseBody,
    statusCode: 200,
  };
}

/**
 * Build a preview summary from a parsed cURL command.
 */
export function parseCurlPreview(curlCommand: string): {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string | null;
  url: string;
} {
  const parsed = parseCurl(curlCommand);
  return {
    method: parsed.method,
    path: parsed.path,
    headers: parsed.headers,
    body: parsed.body,
    url: parsed.url,
  };
}
