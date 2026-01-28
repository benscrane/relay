import { useState } from 'react';
import type { CreateProjectRequest } from '@relay/shared';
import { getEndpointBaseUrl } from '../../config';

interface ProjectFormProps {
  onSubmit: (data: CreateProjectRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ProjectForm({ onSubmit, onCancel, isLoading }: ProjectFormProps) {
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Get the endpoint base URL for display (strip protocol for prefix display)
  const endpointBase = getEndpointBaseUrl();
  const endpointDisplay = endpointBase.replace(/^https?:\/\//, '') + '/m/';

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate subdomain from name if subdomain hasn't been manually edited
    if (!subdomain || subdomain === slugify(name)) {
      setSubdomain(slugify(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!subdomain.trim()) {
      setError('Subdomain is required');
      return;
    }

    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(subdomain)) {
      setError('Subdomain must contain only lowercase letters, numbers, and hyphens');
      return;
    }

    try {
      await onSubmit({ name: name.trim(), subdomain: subdomain.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Project Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="My API Project"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700 mb-1">
          Identifier
        </label>
        <div className="flex items-center">
          <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-gray-500 text-sm truncate max-w-[200px]">
            {endpointDisplay}
          </span>
          <input
            type="text"
            id="subdomain"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
            placeholder="my-api"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md shadow-xs focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Your mock endpoint URL will be: {endpointBase}/m/{subdomain || 'your-identifier'}
        </p>
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
          {isLoading ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </form>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}
