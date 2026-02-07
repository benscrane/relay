import { useState, useRef, useEffect } from 'react';
import type { CreateEndpointRequest } from '@mockd/shared';
import { parseCurlPreview, curlToEndpoint } from '../../utils/curlParser';
import type { EndpointExport } from '../../utils/exportEndpoint';

type ImportMode = 'curl' | 'json';

interface ImportEndpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (endpoints: CreateEndpointRequest[]) => Promise<void>;
  isLoading?: boolean;
}

interface CurlPreview {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string | null;
  url: string;
}

export function ImportEndpointModal({ isOpen, onClose, onImport, isLoading }: ImportEndpointModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<ImportMode>('curl');
  const [curlInput, setCurlInput] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [curlPreview, setCurlPreview] = useState<CurlPreview | null>(null);
  const [jsonPreview, setJsonPreview] = useState<EndpointExport[] | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setCurlInput('');
      setJsonInput('');
      setError(null);
      setCurlPreview(null);
      setJsonPreview(null);
      setMode('curl');
    }
  }, [isOpen]);

  const handleCurlParse = () => {
    setError(null);
    setCurlPreview(null);
    try {
      const preview = parseCurlPreview(curlInput);
      setCurlPreview(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse cURL command');
    }
  };

  const handleJsonParse = () => {
    setError(null);
    setJsonPreview(null);
    try {
      const parsed = JSON.parse(jsonInput);
      let endpoints: EndpointExport[];

      // Support both { endpoints: [...] } wrapper and direct array
      if (Array.isArray(parsed)) {
        endpoints = parsed;
      } else if (parsed.endpoints && Array.isArray(parsed.endpoints)) {
        endpoints = parsed.endpoints;
      } else if (parsed.path) {
        // Single endpoint object
        endpoints = [parsed];
      } else {
        throw new Error('JSON must be an array of endpoints, an object with an "endpoints" array, or a single endpoint object');
      }

      // Validate each endpoint
      for (const ep of endpoints) {
        if (!ep.path || typeof ep.path !== 'string') {
          throw new Error(`Each endpoint must have a "path" field (found: ${JSON.stringify(ep.path)})`);
        }
        if (!ep.path.startsWith('/')) {
          throw new Error(`Path must start with "/" (found: "${ep.path}")`);
        }
      }

      setJsonPreview(endpoints);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON. Please check your input.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to parse JSON');
      }
    }
  };

  const handleImport = async () => {
    setError(null);
    try {
      if (mode === 'curl') {
        const endpoint = curlToEndpoint(curlInput);
        await onImport([endpoint]);
      } else if (mode === 'json' && jsonPreview) {
        const endpoints: CreateEndpointRequest[] = jsonPreview.map(ep => ({
          path: ep.path,
          responseBody: ep.responseBody || '{}',
          statusCode: ep.statusCode ?? 200,
          delay: ep.delay ?? 0,
          rateLimit: ep.rateLimit,
        }));
        await onImport(endpoints);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const canImport = (mode === 'curl' && curlPreview !== null) || (mode === 'json' && jsonPreview !== null && jsonPreview.length > 0);

  const headerCount = curlPreview ? Object.keys(curlPreview.headers).length : 0;

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      onClose={onClose}
    >
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">Import Endpoints</h3>

        {/* Mode tabs */}
        <div className="tabs tabs-bordered mb-4">
          <button
            className={`tab ${mode === 'curl' ? 'tab-active' : ''}`}
            onClick={() => { setMode('curl'); setError(null); }}
          >
            cURL
          </button>
          <button
            className={`tab ${mode === 'json' ? 'tab-active' : ''}`}
            onClick={() => { setMode('json'); setError(null); }}
          >
            JSON
          </button>
        </div>

        {error && (
          <div className="alert alert-error text-sm mb-4">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* cURL mode */}
        {mode === 'curl' && (
          <div>
            <label className="label">
              <span className="label-text">Paste a cURL command</span>
            </label>
            <textarea
              value={curlInput}
              onChange={(e) => { setCurlInput(e.target.value); setCurlPreview(null); setError(null); }}
              placeholder={`curl -X POST 'https://api.example.com/users' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"name": "John"}'`}
              rows={5}
              className="textarea textarea-bordered w-full font-mono text-xs"
              spellCheck={false}
              disabled={isLoading}
            />
            {!curlPreview && curlInput.trim() && (
              <button
                onClick={handleCurlParse}
                className="btn btn-sm btn-outline mt-2"
                disabled={isLoading}
              >
                Parse
              </button>
            )}

            {/* cURL preview */}
            {curlPreview && (
              <div className="mt-4 border border-base-300 rounded-lg p-4 bg-base-200">
                <h4 className="text-sm font-semibold mb-2">Preview</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-base-content/70">Method:</span>{' '}
                    <span className="font-mono font-semibold">{curlPreview.method}</span>
                  </div>
                  <div>
                    <span className="text-base-content/70">Path:</span>{' '}
                    <span className="font-mono">{curlPreview.path}</span>
                  </div>
                </div>
                {headerCount > 0 && (
                  <div className="mt-2 text-xs text-base-content/60">
                    {headerCount} header{headerCount !== 1 ? 's' : ''} detected (headers are for reference only)
                  </div>
                )}
                {curlPreview.body && (
                  <div className="mt-2">
                    <span className="text-xs text-base-content/70">Body:</span>
                    <pre className="bg-base-300 p-2 rounded text-xs font-mono mt-1 overflow-x-auto max-h-32 overflow-y-auto">
                      {(() => {
                        try { return JSON.stringify(JSON.parse(curlPreview.body!), null, 2); }
                        catch { return curlPreview.body; }
                      })()}
                    </pre>
                  </div>
                )}
                <p className="text-xs text-base-content/50 mt-3">
                  This will create an endpoint at <code className="bg-base-300 px-1 rounded">{curlPreview.path}</code> with a mock response body.
                </p>
              </div>
            )}
          </div>
        )}

        {/* JSON mode */}
        {mode === 'json' && (
          <div>
            <label className="label">
              <span className="label-text">Paste endpoint JSON (mockd export format or array of endpoints)</span>
            </label>
            <textarea
              value={jsonInput}
              onChange={(e) => { setJsonInput(e.target.value); setJsonPreview(null); setError(null); }}
              placeholder={`{\n  "endpoints": [\n    {\n      "path": "/api/users",\n      "statusCode": 200,\n      "responseBody": "{\\"users\\": []}"\n    }\n  ]\n}`}
              rows={8}
              className="textarea textarea-bordered w-full font-mono text-xs"
              spellCheck={false}
              disabled={isLoading}
            />
            {!jsonPreview && jsonInput.trim() && (
              <button
                onClick={handleJsonParse}
                className="btn btn-sm btn-outline mt-2"
                disabled={isLoading}
              >
                Parse
              </button>
            )}

            {/* JSON preview */}
            {jsonPreview && (
              <div className="mt-4 border border-base-300 rounded-lg p-4 bg-base-200">
                <h4 className="text-sm font-semibold mb-2">
                  {jsonPreview.length} endpoint{jsonPreview.length !== 1 ? 's' : ''} found
                </h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {jsonPreview.map((ep, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className={`badge badge-sm ${
                        (ep.statusCode ?? 200) < 300 ? 'badge-success' :
                        (ep.statusCode ?? 200) < 400 ? 'badge-warning' :
                        'badge-error'
                      }`}>
                        {ep.statusCode ?? 200}
                      </span>
                      <span className="font-mono text-xs">{ep.path}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!canImport || isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                Importing...
              </>
            ) : (
              <>
                Import{mode === 'json' && jsonPreview ? ` ${jsonPreview.length} endpoint${jsonPreview.length !== 1 ? 's' : ''}` : ''}
              </>
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
