import { describe, it, expect } from 'vitest';
import {
  processTemplate,
  stripTemplatesForValidation,
  parseFormBody,
  isFormUrlEncoded,
  getContentTypeFromHeaders,
  type TemplateContext,
} from './template-engine';

function makeContext(overrides?: Partial<TemplateContext>): TemplateContext {
  return {
    pathParams: {},
    request: {
      method: 'GET',
      path: '/test',
      headers: {},
      query: {},
      body: null,
    },
    ...overrides,
  };
}

describe('processTemplate', () => {
  describe('path parameters (backward compatible)', () => {
    it('should replace path params', () => {
      const result = processTemplate(
        '{"id": "{{id}}"}',
        makeContext({ pathParams: { id: '42' } })
      );
      expect(result).toBe('{"id": "42"}');
    });

    it('should replace multiple path params', () => {
      const result = processTemplate(
        '{"userId": "{{userId}}", "postId": "{{postId}}"}',
        makeContext({ pathParams: { userId: 'u1', postId: 'p2' } })
      );
      expect(result).toBe('{"userId": "u1", "postId": "p2"}');
    });

    it('should leave unknown params unchanged', () => {
      const result = processTemplate('{"x": "{{unknown}}"}', makeContext());
      expect(result).toBe('{"x": "{{unknown}}"}');
    });
  });

  describe('built-in generators', () => {
    it('should generate a UUID', () => {
      const result = processTemplate('{"id": "{{$uuid}}"}', makeContext());
      const parsed = JSON.parse(result);
      expect(parsed.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should generate a random integer', () => {
      const result = processTemplate('{"n": "{{$randomInt}}"}', makeContext());
      const parsed = JSON.parse(result);
      const n = parseInt(parsed.n, 10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1000);
    });

    it('should generate a random float', () => {
      const result = processTemplate('{"f": "{{$randomFloat}}"}', makeContext());
      const parsed = JSON.parse(result);
      const f = parseFloat(parsed.f);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    });

    it('should generate a random boolean', () => {
      const result = processTemplate('{"b": "{{$randomBool}}"}', makeContext());
      const parsed = JSON.parse(result);
      expect(['true', 'false']).toContain(parsed.b);
    });

    it('should generate a timestamp', () => {
      const result = processTemplate('{"ts": "{{$timestamp}}"}', makeContext());
      const parsed = JSON.parse(result);
      expect(new Date(parsed.ts).toISOString()).toBe(parsed.ts);
    });

    it('should generate a unix timestamp', () => {
      const result = processTemplate('{"ts": "{{$timestampUnix}}"}', makeContext());
      const parsed = JSON.parse(result);
      const ts = parseInt(parsed.ts, 10);
      expect(ts).toBeGreaterThan(1000000000);
    });

    it('should generate a date', () => {
      const result = processTemplate('{"d": "{{$date}}"}', makeContext());
      const parsed = JSON.parse(result);
      expect(parsed.d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should generate a random email', () => {
      const result = processTemplate('{"e": "{{$randomEmail}}"}', makeContext());
      const parsed = JSON.parse(result);
      expect(parsed.e).toMatch(/^[a-z]+\.[a-z]+@[a-z.]+$/);
    });

    it('should generate a random name', () => {
      const result = processTemplate('{"n": "{{$randomName}}"}', makeContext());
      const parsed = JSON.parse(result);
      expect(parsed.n.split(' ')).toHaveLength(2);
    });

    it('should generate a random string', () => {
      const result = processTemplate('{"s": "{{$randomString}}"}', makeContext());
      const parsed = JSON.parse(result);
      expect(parsed.s).toMatch(/^[a-z0-9]{16}$/);
    });

    it('should replace each occurrence independently', () => {
      const result = processTemplate('{"a": "{{$uuid}}", "b": "{{$uuid}}"}', makeContext());
      const parsed = JSON.parse(result);
      // UUIDs should be different (technically could collide but astronomically unlikely)
      expect(parsed.a).not.toBe(parsed.b);
    });
  });

  describe('request context variables', () => {
    it('should resolve request.method', () => {
      const ctx = makeContext({ request: { method: 'POST', path: '/test', headers: {}, query: {}, body: null } });
      const result = processTemplate('{"method": "{{request.method}}"}', ctx);
      expect(JSON.parse(result).method).toBe('POST');
    });

    it('should resolve request.path', () => {
      const ctx = makeContext({ request: { method: 'GET', path: '/users/123', headers: {}, query: {}, body: null } });
      const result = processTemplate('{"path": "{{request.path}}"}', ctx);
      expect(JSON.parse(result).path).toBe('/users/123');
    });

    it('should resolve request.header.Name (case-insensitive)', () => {
      const ctx = makeContext({
        request: { method: 'GET', path: '/', headers: { 'Content-Type': 'application/json', 'X-Custom': 'hello' }, query: {}, body: null },
      });
      expect(processTemplate('{{request.header.Content-Type}}', ctx)).toBe('application/json');
      expect(processTemplate('{{request.header.content-type}}', ctx)).toBe('application/json');
      expect(processTemplate('{{request.header.X-Custom}}', ctx)).toBe('hello');
    });

    it('should return empty string for missing headers', () => {
      const ctx = makeContext();
      expect(processTemplate('{{request.header.Missing}}', ctx)).toBe('');
    });

    it('should resolve request.query.key', () => {
      const ctx = makeContext({
        request: { method: 'GET', path: '/', headers: {}, query: { page: '2', sort: 'name' }, body: null },
      });
      expect(processTemplate('{{request.query.page}}', ctx)).toBe('2');
      expect(processTemplate('{{request.query.sort}}', ctx)).toBe('name');
    });

    it('should return empty string for missing query params', () => {
      const ctx = makeContext();
      expect(processTemplate('{{request.query.missing}}', ctx)).toBe('');
    });

    it('should resolve request.body (raw)', () => {
      const ctx = makeContext({
        request: { method: 'POST', path: '/', headers: {}, query: {}, body: '{"name": "test"}' },
      });
      const result = processTemplate('{{request.body}}', ctx);
      expect(result).toBe('{"name": "test"}');
    });

    it('should resolve request.body.field (JSON dot notation)', () => {
      const ctx = makeContext({
        request: { method: 'POST', path: '/', headers: {}, query: {}, body: '{"user": {"name": "Alice", "age": 30}}' },
      });
      expect(processTemplate('{{request.body.user.name}}', ctx)).toBe('Alice');
      expect(processTemplate('{{request.body.user.age}}', ctx)).toBe('30');
    });

    it('should resolve nested objects as JSON strings', () => {
      const ctx = makeContext({
        request: { method: 'POST', path: '/', headers: {}, query: {}, body: '{"user": {"name": "Alice"}}' },
      });
      const result = processTemplate('{{request.body.user}}', ctx);
      expect(JSON.parse(result)).toEqual({ name: 'Alice' });
    });

    it('should return empty string for missing body fields', () => {
      const ctx = makeContext({
        request: { method: 'POST', path: '/', headers: {}, query: {}, body: '{"a": 1}' },
      });
      expect(processTemplate('{{request.body.missing}}', ctx)).toBe('');
    });

    it('should return empty string when body is null', () => {
      const ctx = makeContext();
      expect(processTemplate('{{request.body.field}}', ctx)).toBe('');
    });

    it('should return empty string when body is not valid JSON', () => {
      const ctx = makeContext({
        request: { method: 'POST', path: '/', headers: {}, query: {}, body: 'not json' },
      });
      expect(processTemplate('{{request.body.field}}', ctx)).toBe('');
    });
  });

  describe('mixed usage', () => {
    it('should handle path params, builtins, and request vars together', () => {
      const ctx = makeContext({
        pathParams: { id: '99' },
        request: { method: 'PUT', path: '/items/99', headers: {}, query: { v: '2' }, body: null },
      });
      const template = '{"id": "{{id}}", "method": "{{request.method}}", "version": "{{request.query.v}}", "ts": "{{$timestamp}}"}';
      const result = processTemplate(template, ctx);
      const parsed = JSON.parse(result);
      expect(parsed.id).toBe('99');
      expect(parsed.method).toBe('PUT');
      expect(parsed.version).toBe('2');
      expect(parsed.ts).toBeTruthy();
    });

    it('should not replace unknown variables', () => {
      const result = processTemplate('{{$nonexistent}} {{nope}}', makeContext());
      expect(result).toBe('{{$nonexistent}} {{nope}}');
    });
  });

  describe('edge cases', () => {
    it('should handle empty template', () => {
      expect(processTemplate('', makeContext())).toBe('');
    });

    it('should handle template with no variables', () => {
      expect(processTemplate('{"static": true}', makeContext())).toBe('{"static": true}');
    });

    it('should handle template with only whitespace in variable name', () => {
      expect(processTemplate('{{ }}', makeContext())).toBe('{{ }}');
    });

    it('should handle adjacent template variables', () => {
      const ctx = makeContext({ pathParams: { a: 'X', b: 'Y' } });
      expect(processTemplate('{{a}}{{b}}', ctx)).toBe('XY');
    });
  });
});

describe('URL-encoded body support', () => {
  describe('processTemplate with form-urlencoded body', () => {
    it('should resolve request.body.field from URL-encoded body', () => {
      const ctx = makeContext({
        request: {
          method: 'POST',
          path: '/',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          query: {},
          body: 'name=Alice&age=30',
        },
      });
      expect(processTemplate('{{request.body.name}}', ctx)).toBe('Alice');
      expect(processTemplate('{{request.body.age}}', ctx)).toBe('30');
    });

    it('should return empty string for missing form fields', () => {
      const ctx = makeContext({
        request: {
          method: 'POST',
          path: '/',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          query: {},
          body: 'name=Alice',
        },
      });
      expect(processTemplate('{{request.body.missing}}', ctx)).toBe('');
    });

    it('should handle URL-encoded values', () => {
      const ctx = makeContext({
        request: {
          method: 'POST',
          path: '/',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          query: {},
          body: 'message=hello+world&url=https%3A%2F%2Fexample.com',
        },
      });
      expect(processTemplate('{{request.body.message}}', ctx)).toBe('hello world');
      expect(processTemplate('{{request.body.url}}', ctx)).toBe('https://example.com');
    });

    it('should handle content-type with charset parameter', () => {
      const ctx = makeContext({
        request: {
          method: 'POST',
          path: '/',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
          query: {},
          body: 'key=value',
        },
      });
      expect(processTemplate('{{request.body.key}}', ctx)).toBe('value');
    });

    it('should handle case-insensitive Content-Type header', () => {
      const ctx = makeContext({
        request: {
          method: 'POST',
          path: '/',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          query: {},
          body: 'key=value',
        },
      });
      expect(processTemplate('{{request.body.key}}', ctx)).toBe('value');
    });

    it('should return raw body with request.body for form data', () => {
      const ctx = makeContext({
        request: {
          method: 'POST',
          path: '/',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          query: {},
          body: 'name=Alice&age=30',
        },
      });
      expect(processTemplate('{{request.body}}', ctx)).toBe('name=Alice&age=30');
    });

    it('should return empty string when form body is null', () => {
      const ctx = makeContext({
        request: {
          method: 'POST',
          path: '/',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          query: {},
          body: null,
        },
      });
      expect(processTemplate('{{request.body.field}}', ctx)).toBe('');
    });

    it('should still use JSON parsing when content-type is application/json', () => {
      const ctx = makeContext({
        request: {
          method: 'POST',
          path: '/',
          headers: { 'Content-Type': 'application/json' },
          query: {},
          body: '{"name": "Alice"}',
        },
      });
      expect(processTemplate('{{request.body.name}}', ctx)).toBe('Alice');
    });
  });

  describe('parseFormBody', () => {
    it('should parse simple form data', () => {
      expect(parseFormBody('name=Alice&age=30')).toEqual({ name: 'Alice', age: '30' });
    });

    it('should handle URL-encoded values', () => {
      expect(parseFormBody('msg=hello+world')).toEqual({ msg: 'hello world' });
    });

    it('should handle empty string', () => {
      expect(parseFormBody('')).toEqual({});
    });

    it('should handle encoded special characters', () => {
      expect(parseFormBody('q=foo%26bar')).toEqual({ q: 'foo&bar' });
    });
  });

  describe('isFormUrlEncoded', () => {
    it('should return true for form-urlencoded', () => {
      expect(isFormUrlEncoded('application/x-www-form-urlencoded')).toBe(true);
    });

    it('should return true with charset parameter', () => {
      expect(isFormUrlEncoded('application/x-www-form-urlencoded; charset=utf-8')).toBe(true);
    });

    it('should return false for JSON', () => {
      expect(isFormUrlEncoded('application/json')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isFormUrlEncoded('')).toBe(false);
    });
  });

  describe('getContentTypeFromHeaders', () => {
    it('should extract content-type case-insensitively', () => {
      expect(getContentTypeFromHeaders({ 'Content-Type': 'application/json' })).toBe('application/json');
      expect(getContentTypeFromHeaders({ 'content-type': 'text/plain' })).toBe('text/plain');
    });

    it('should strip parameters', () => {
      expect(getContentTypeFromHeaders({ 'Content-Type': 'text/html; charset=utf-8' })).toBe('text/html');
    });

    it('should return empty string when missing', () => {
      expect(getContentTypeFromHeaders({})).toBe('');
    });
  });
});

describe('stripTemplatesForValidation', () => {
  it('should pass through plain JSON unchanged', () => {
    const json = '{"key": "value", "num": 42}';
    expect(stripTemplatesForValidation(json)).toBe(json);
  });

  it('should replace templates inside strings with placeholder', () => {
    const input = '{"id": "{{$uuid}}"}';
    const result = stripTemplatesForValidation(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(result).toBe('{"id": "__tpl__"}');
  });

  it('should replace templates outside strings with quoted placeholder', () => {
    const input = '{"count": {{$randomInt}}}';
    const result = stripTemplatesForValidation(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(result).toBe('{"count": "__tpl__"}');
  });

  it('should handle mixed template positions', () => {
    const input = '{"id": "{{$uuid}}", "count": {{$randomInt}}, "name": "{{$randomName}}"}';
    const result = stripTemplatesForValidation(input);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('should handle template-free JSON', () => {
    const input = '{"a": 1, "b": "hello"}';
    expect(stripTemplatesForValidation(input)).toBe(input);
  });

  it('should handle empty string', () => {
    expect(stripTemplatesForValidation('')).toBe('');
  });

  it('should handle unclosed template braces', () => {
    const input = '{"x": "{{unclosed"}';
    const result = stripTemplatesForValidation(input);
    // Should not crash; unclosed template left as-is
    expect(result).toBe(input);
  });

  it('should handle escaped quotes', () => {
    const input = '{"msg": "say \\"hi\\" {{$randomName}}"}';
    const result = stripTemplatesForValidation(input);
    expect(result).toContain('__tpl__');
  });
});
