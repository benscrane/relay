import { useState } from 'react';
import type { CreateProjectRequest } from '@mockd/shared';
import { getEndpointBaseUrl, getMockApiSubdomainUrl } from '../../config';

interface ProjectFormProps {
  onSubmit: (data: CreateProjectRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ProjectForm({ onSubmit, onCancel, isLoading }: ProjectFormProps) {
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Get the endpoint base URL for display
  const endpointBase = getEndpointBaseUrl();
  const isDev = import.meta.env.DEV;
  const endpointDisplay = isDev ? endpointBase.replace(/^https?:\/\//, '') + '/m/' : '';

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
        <div className="alert alert-error text-sm">
          {error}
        </div>
      )}

      <div className="form-control">
        <label htmlFor="name" className="label">
          <span className="label-text">Project Name</span>
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="My API Project"
          className="input input-bordered w-full"
          disabled={isLoading}
        />
      </div>

      <div className="form-control">
        <label htmlFor="subdomain" className="label">
          <span className="label-text">Identifier</span>
        </label>
        <div className="join w-full">
          {isDev ? (
            <>
              <span className="join-item px-3 py-2 bg-base-200 border border-base-300 text-base-content/70 text-sm truncate max-w-[200px] flex items-center">
                {endpointDisplay}
              </span>
              <input
                type="text"
                id="subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                placeholder="my-api"
                className="input input-bordered join-item flex-1"
                disabled={isLoading}
              />
            </>
          ) : (
            <>
              <input
                type="text"
                id="subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                placeholder="my-api"
                className="input input-bordered join-item flex-1"
                disabled={isLoading}
              />
              <span className="join-item px-3 py-2 bg-base-200 border border-base-300 text-base-content/70 text-sm flex items-center">
                .mockd.sh
              </span>
            </>
          )}
        </div>
        <label className="label">
          <span className="label-text-alt text-base-content/70">
            Your mock endpoint URL will be: {getMockApiSubdomainUrl(subdomain || 'your-identifier')}
          </span>
        </label>
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
