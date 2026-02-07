import { useState } from 'react';
import type { CreateEndpointRequest, UpdateEndpointRequest, Endpoint } from '@mockd/shared';
import { TIER_LIMITS } from '@mockd/shared';
import { stripTemplatesForValidation } from '@mockd/shared/utils';
import { JsonEditor, TemplateVariableRef } from '../common';

interface EndpointFormCreateProps {
  endpoint?: undefined;
  onSubmit: (data: CreateEndpointRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface EndpointFormEditProps {
  endpoint: Endpoint;
  onSubmit: (data: UpdateEndpointRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

type EndpointFormProps = EndpointFormCreateProps | EndpointFormEditProps;

export function EndpointForm({ endpoint, onSubmit, onCancel, isLoading }: EndpointFormProps) {
  const isEdit = !!endpoint;

  const [path, setPath] = useState(endpoint?.path || '/');
  const [responseBody, setResponseBody] = useState(
    endpoint?.responseBody || '{\n  "message": "Hello, World!"\n}'
  );
  const [statusCode, setStatusCode] = useState(endpoint?.statusCode?.toString() || '200');
  const [delay, setDelay] = useState(endpoint?.delay?.toString() || '0');
  const [rateLimit, setRateLimit] = useState(endpoint?.rateLimit?.toString() || String(TIER_LIMITS.free.defaultEndpointRateLimit));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEdit && !path.trim()) {
      setError('Path is required');
      return;
    }

    if (!path.startsWith('/')) {
      setError('Path must start with /');
      return;
    }

    const statusCodeNum = parseInt(statusCode, 10);
    if (isNaN(statusCodeNum) || statusCodeNum < 100 || statusCodeNum > 599) {
      setError('Status code must be between 100 and 599');
      return;
    }

    const delayNum = parseInt(delay, 10);
    if (isNaN(delayNum) || delayNum < 0) {
      setError('Delay must be a non-negative number');
      return;
    }

    const rateLimitNum = parseInt(rateLimit, 10);
    if (isNaN(rateLimitNum) || rateLimitNum < 1) {
      setError('Rate limit must be a positive number');
      return;
    }

    try {
      // Validate JSON (strip template variables first so {{...}} tokens don't break parsing)
      JSON.parse(stripTemplatesForValidation(responseBody));
    } catch {
      setError('Response body must be valid JSON (template variables like {{$uuid}} are allowed inside values)');
      return;
    }

    try {
      if (isEdit) {
        const data: UpdateEndpointRequest = { responseBody, statusCode: statusCodeNum, delay: delayNum, rateLimit: rateLimitNum };
        await (onSubmit as (data: UpdateEndpointRequest) => Promise<void>)(data);
      } else {
        const data: CreateEndpointRequest = { path: path.trim(), responseBody, statusCode: statusCodeNum, delay: delayNum, rateLimit: rateLimitNum };
        await (onSubmit as (data: CreateEndpointRequest) => Promise<void>)(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save endpoint');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="alert alert-error text-sm">
          {error}
        </div>
      )}

      {!isEdit && (
        <div className="form-control">
          <label htmlFor="path" className="label">
            <span className="label-text">Path</span>
          </label>
          <input
            type="text"
            id="path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/api/users"
            className="input input-bordered w-full font-mono"
            disabled={isLoading}
          />
          <label className="label">
            <span className="label-text-alt text-base-content/70 whitespace-normal">All HTTP methods (GET, POST, PUT, etc.) will be accepted at this path</span>
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="form-control">
          <label htmlFor="statusCode" className="label">
            <span className="label-text">Status Code</span>
          </label>
          <input
            type="number"
            id="statusCode"
            value={statusCode}
            onChange={(e) => setStatusCode(e.target.value)}
            min="100"
            max="599"
            className="input input-bordered w-full"
            disabled={isLoading}
          />
        </div>

        <div className="form-control">
          <label htmlFor="delay" className="label">
            <span className="label-text">Delay (ms)</span>
          </label>
          <input
            type="number"
            id="delay"
            value={delay}
            onChange={(e) => setDelay(e.target.value)}
            min="0"
            className="input input-bordered w-full"
            disabled={isLoading}
          />
        </div>

        <div className="form-control">
          <label htmlFor="rateLimit" className="label">
            <span className="label-text">Rate Limit (req/min)</span>
          </label>
          <input
            type="number"
            id="rateLimit"
            value={rateLimit}
            onChange={(e) => setRateLimit(e.target.value)}
            min="1"
            className="input input-bordered w-full"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="form-control">
        <label htmlFor="responseBody" className="label">
          <span className="label-text">Response Body (JSON)</span>
        </label>
        <JsonEditor
          id="responseBody"
          value={responseBody}
          onChange={setResponseBody}
          rows={8}
          disabled={isLoading}
          templateAware
        />
        <TemplateVariableRef />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : isEdit ? 'Update Endpoint' : 'Create Endpoint'}
        </button>
      </div>
    </form>
  );
}
