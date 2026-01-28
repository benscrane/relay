import { useState } from 'react';
import type { CreateEndpointRequest, UpdateEndpointRequest, Endpoint } from '@relay/shared';

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

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export function EndpointForm({ endpoint, onSubmit, onCancel, isLoading }: EndpointFormProps) {
  const isEdit = !!endpoint;

  const [method, setMethod] = useState(endpoint?.method || 'GET');
  const [path, setPath] = useState(endpoint?.path || '/');
  const [responseBody, setResponseBody] = useState(
    endpoint?.responseBody || '{\n  "message": "Hello, World!"\n}'
  );
  const [statusCode, setStatusCode] = useState(endpoint?.statusCode?.toString() || '200');
  const [delay, setDelay] = useState(endpoint?.delay?.toString() || '0');
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

    try {
      // Validate JSON
      JSON.parse(responseBody);
    } catch {
      setError('Response body must be valid JSON');
      return;
    }

    try {
      if (isEdit) {
        const data: UpdateEndpointRequest = { responseBody, statusCode: statusCodeNum, delay: delayNum };
        await (onSubmit as (data: UpdateEndpointRequest) => Promise<void>)(data);
      } else {
        const data: CreateEndpointRequest = { method, path: path.trim(), responseBody, statusCode: statusCodeNum, delay: delayNum };
        await (onSubmit as (data: CreateEndpointRequest) => Promise<void>)(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save endpoint');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      {!isEdit && (
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label htmlFor="method" className="block text-sm font-medium text-gray-700 mb-1">
              Method
            </label>
            <select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            >
              {HTTP_METHODS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="col-span-3">
            <label htmlFor="path" className="block text-sm font-medium text-gray-700 mb-1">
              Path
            </label>
            <input
              type="text"
              id="path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/api/users"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:ring-blue-500 focus:border-blue-500 font-mono"
              disabled={isLoading}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="statusCode" className="block text-sm font-medium text-gray-700 mb-1">
            Status Code
          </label>
          <input
            type="number"
            id="statusCode"
            value={statusCode}
            onChange={(e) => setStatusCode(e.target.value)}
            min="100"
            max="599"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="delay" className="block text-sm font-medium text-gray-700 mb-1">
            Delay (ms)
          </label>
          <input
            type="number"
            id="delay"
            value={delay}
            onChange={(e) => setDelay(e.target.value)}
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        </div>
      </div>

      <div>
        <label htmlFor="responseBody" className="block text-sm font-medium text-gray-700 mb-1">
          Response Body (JSON)
        </label>
        <textarea
          id="responseBody"
          value={responseBody}
          onChange={(e) => setResponseBody(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          disabled={isLoading}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : isEdit ? 'Update Endpoint' : 'Create Endpoint'}
        </button>
      </div>
    </form>
  );
}
