import { useState, useEffect } from 'react';
import type { MockRule, CreateMockRuleRequest, UpdateMockRuleRequest } from '@relay/shared';

interface RuleFormProps {
  rule?: MockRule;
  onSubmit: (data: CreateMockRuleRequest | UpdateMockRuleRequest) => Promise<void>;
  onCancel: () => void;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

function isValidJson(str: string): boolean {
  if (!str.trim()) return true;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function RuleForm({ rule, onSubmit, onCancel }: RuleFormProps) {
  const [name, setName] = useState(rule?.name || '');
  const [priority, setPriority] = useState(rule?.priority?.toString() || '0');
  const [matchMethod, setMatchMethod] = useState(rule?.matchMethod || '');
  const [matchPath, setMatchPath] = useState(rule?.matchPath || '');
  const [matchHeaders, setMatchHeaders] = useState(
    rule?.matchHeaders ? JSON.stringify(rule.matchHeaders, null, 2) : ''
  );
  const [responseStatus, setResponseStatus] = useState(rule?.responseStatus?.toString() || '200');
  const [responseBody, setResponseBody] = useState(rule?.responseBody || '{}');
  const [responseHeaders, setResponseHeaders] = useState(
    rule?.responseHeaders ? JSON.stringify(rule.responseHeaders, null, 2) : ''
  );
  const [responseDelayMs, setResponseDelayMs] = useState(rule?.responseDelayMs?.toString() || '0');
  const [isActive, setIsActive] = useState(rule?.isActive !== false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!responseBody.trim()) {
      newErrors.responseBody = 'Response body is required';
    } else if (!isValidJson(responseBody)) {
      newErrors.responseBody = 'Response body must be valid JSON';
    }

    if (matchHeaders && !isValidJson(matchHeaders)) {
      newErrors.matchHeaders = 'Match headers must be valid JSON';
    }

    if (responseHeaders && !isValidJson(responseHeaders)) {
      newErrors.responseHeaders = 'Response headers must be valid JSON';
    }

    const priorityNum = parseInt(priority, 10);
    if (isNaN(priorityNum)) {
      newErrors.priority = 'Priority must be a number';
    }

    const statusNum = parseInt(responseStatus, 10);
    if (isNaN(statusNum) || statusNum < 100 || statusNum > 599) {
      newErrors.responseStatus = 'Status must be between 100 and 599';
    }

    const delayNum = parseInt(responseDelayMs, 10);
    if (isNaN(delayNum) || delayNum < 0) {
      newErrors.responseDelayMs = 'Delay must be a non-negative number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);

    try {
      const data: CreateMockRuleRequest | UpdateMockRuleRequest = {
        name: name.trim() || null,
        priority: parseInt(priority, 10),
        matchMethod: matchMethod || null,
        matchPath: matchPath.trim() || null,
        matchHeaders: matchHeaders.trim() ? JSON.parse(matchHeaders) : null,
        responseStatus: parseInt(responseStatus, 10),
        responseBody: responseBody,
        responseHeaders: responseHeaders.trim() ? JSON.parse(responseHeaders) : null,
        responseDelayMs: parseInt(responseDelayMs, 10),
        isActive,
      };

      await onSubmit(data);
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to save rule' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rule Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Return user by ID"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          {errors.priority && (
            <p className="text-red-500 text-sm mt-1">{errors.priority}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">Higher priority rules are matched first</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Active
          </label>
          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded-sm focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Rule is active</span>
          </label>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium text-gray-800 mb-3">Match Conditions</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HTTP Method
            </label>
            <select
              value={matchMethod}
              onChange={(e) => setMatchMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Any method</option>
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Path Pattern
            </label>
            <input
              type="text"
              value={matchPath}
              onChange={(e) => setMatchPath(e.target.value)}
              placeholder="e.g., /users/:id"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Use :paramName for path parameters</p>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Match Headers (JSON)
          </label>
          <textarea
            value={matchHeaders}
            onChange={(e) => setMatchHeaders(e.target.value)}
            placeholder='{"Content-Type": "application/json"}'
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          {errors.matchHeaders && (
            <p className="text-red-500 text-sm mt-1">{errors.matchHeaders}</p>
          )}
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium text-gray-800 mb-3">Response Configuration</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status Code
            </label>
            <input
              type="number"
              value={responseStatus}
              onChange={(e) => setResponseStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            {errors.responseStatus && (
              <p className="text-red-500 text-sm mt-1">{errors.responseStatus}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delay (ms)
            </label>
            <input
              type="number"
              value={responseDelayMs}
              onChange={(e) => setResponseDelayMs(e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            {errors.responseDelayMs && (
              <p className="text-red-500 text-sm mt-1">{errors.responseDelayMs}</p>
            )}
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Response Body (JSON)
          </label>
          <textarea
            value={responseBody}
            onChange={(e) => setResponseBody(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          {errors.responseBody && (
            <p className="text-red-500 text-sm mt-1">{errors.responseBody}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Use {"{{paramName}}"} to interpolate path parameters
          </p>
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Response Headers (JSON)
          </label>
          <textarea
            value={responseHeaders}
            onChange={(e) => setResponseHeaders(e.target.value)}
            placeholder='{"X-Custom-Header": "value"}'
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          {errors.responseHeaders && (
            <p className="text-red-500 text-sm mt-1">{errors.responseHeaders}</p>
          )}
        </div>
      </div>

      {errors.submit && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
          {errors.submit}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
        </button>
      </div>
    </form>
  );
}
