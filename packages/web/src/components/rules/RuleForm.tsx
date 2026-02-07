import { useState } from 'react';
import type { MockRule, CreateMockRuleRequest, UpdateMockRuleRequest } from '@mockd/shared';
import { stripTemplatesForValidation } from '@mockd/shared/utils';
import { JsonEditor } from '../common/JsonEditor';
import { TemplateVariableRef } from '../common/TemplateVariableRef';

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

function isValidJsonRequiredTemplateAware(str: string): boolean {
  if (!str.trim()) return false;
  try {
    JSON.parse(stripTemplatesForValidation(str));
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

    // JSON validation - errors shown inline by JsonEditor (template-aware for response body)
    if (!isValidJsonRequiredTemplateAware(responseBody)) {
      newErrors.responseBody = 'invalid';
    }
    if (matchHeaders && !isValidJson(matchHeaders)) {
      newErrors.matchHeaders = 'invalid';
    }
    if (responseHeaders && !isValidJson(responseHeaders)) {
      newErrors.responseHeaders = 'invalid';
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
      <div className="form-control">
        <label className="label">
          <span className="label-text">Rule Name</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Return user by ID"
          className="input input-bordered w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="form-control min-w-0">
          <label className="label">
            <span className="label-text">Priority</span>
          </label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="input input-bordered w-full"
          />
          {errors.priority && (
            <p className="text-error text-sm mt-1">{errors.priority}</p>
          )}
          <label className="label">
            <span className="label-text-alt text-base-content/70 break-words">Higher priority rules are matched first</span>
          </label>
        </div>

        <div className="form-control min-w-0">
          <label className="label">
            <span className="label-text">Active</span>
          </label>
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="checkbox checkbox-primary"
            />
            <span className="text-sm text-base-content/70">Rule is active</span>
          </label>
        </div>
      </div>

      <div className="border-t border-base-200 pt-4">
        <h4 className="font-medium text-base-content mb-3">Match Conditions</h4>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control min-w-0">
            <label className="label">
              <span className="label-text">HTTP Method</span>
            </label>
            <select
              value={matchMethod}
              onChange={(e) => setMatchMethod(e.target.value)}
              className="select select-bordered w-full"
            >
              <option value="">Any method</option>
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="form-control min-w-0">
            <label className="label">
              <span className="label-text">Path Pattern</span>
            </label>
            <input
              type="text"
              value={matchPath}
              onChange={(e) => setMatchPath(e.target.value)}
              placeholder="e.g., /users/:id"
              className="input input-bordered w-full"
            />
            <label className="label">
              <span className="label-text-alt text-base-content/70 break-words">Use :paramName for path parameters</span>
            </label>
          </div>
        </div>

        <div className="form-control mt-3">
          <label className="label">
            <span className="label-text">Match Headers (JSON)</span>
          </label>
          <JsonEditor
            value={matchHeaders}
            onChange={setMatchHeaders}
            placeholder='{"Content-Type": "application/json"}'
            rows={2}
          />
        </div>
      </div>

      <div className="border-t border-base-200 pt-4">
        <h4 className="font-medium text-base-content mb-3">Response Configuration</h4>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control min-w-0">
            <label className="label">
              <span className="label-text">Status Code</span>
            </label>
            <input
              type="number"
              value={responseStatus}
              onChange={(e) => setResponseStatus(e.target.value)}
              className="input input-bordered w-full"
            />
            {errors.responseStatus && (
              <p className="text-error text-sm mt-1">{errors.responseStatus}</p>
            )}
          </div>

          <div className="form-control min-w-0">
            <label className="label">
              <span className="label-text">Delay (ms)</span>
            </label>
            <input
              type="number"
              value={responseDelayMs}
              onChange={(e) => setResponseDelayMs(e.target.value)}
              min="0"
              className="input input-bordered w-full"
            />
            {errors.responseDelayMs && (
              <p className="text-error text-sm mt-1">{errors.responseDelayMs}</p>
            )}
          </div>
        </div>

        <div className="form-control mt-3">
          <label className="label">
            <span className="label-text">Response Body (JSON)</span>
          </label>
          <JsonEditor
            value={responseBody}
            onChange={setResponseBody}
            rows={4}
            templateAware
          />
          <TemplateVariableRef />
        </div>

        <div className="form-control mt-3">
          <label className="label">
            <span className="label-text">Response Headers (JSON)</span>
          </label>
          <JsonEditor
            value={responseHeaders}
            onChange={setResponseHeaders}
            placeholder='{"X-Custom-Header": "value"}'
            rows={2}
          />
        </div>
      </div>

      {errors.submit && (
        <div className="alert alert-error">
          {errors.submit}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-base-200">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary"
        >
          {submitting ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
        </button>
      </div>
    </form>
  );
}
