import { useState, useCallback } from 'react';
import { MethodBadge, StatusBadge } from '../common';
import { JsonViewer } from '../request';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const BODY_FORMATS = ['json', 'form'] as const;
type BodyFormat = typeof BODY_FORMATS[number];

interface QuickTestPanelProps {
  endpointUrl: string;
}

interface TestResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
}

interface HeaderEntry {
  key: string;
  value: string;
}

interface FormEntry {
  key: string;
  value: string;
}

export function QuickTestPanel({ endpointUrl }: QuickTestPanelProps) {
  const [method, setMethod] = useState<string>('GET');
  const [headers, setHeaders] = useState<HeaderEntry[]>([]);
  const [body, setBody] = useState('');
  const [bodyFormat, setBodyFormat] = useState<BodyFormat>('json');
  const [formEntries, setFormEntries] = useState<FormEntry[]>([{ key: '', value: '' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHeaders, setShowHeaders] = useState(false);
  const [showBody, setShowBody] = useState(false);
  const [activeResponseTab, setActiveResponseTab] = useState<'body' | 'headers'>('body');

  const hasBody = method !== 'GET' && method !== 'HEAD';

  const addHeader = useCallback(() => {
    setHeaders(prev => [...prev, { key: '', value: '' }]);
    setShowHeaders(true);
  }, []);

  const updateHeader = useCallback((index: number, field: 'key' | 'value', val: string) => {
    setHeaders(prev => prev.map((h, i) => i === index ? { ...h, [field]: val } : h));
  }, []);

  const removeHeader = useCallback((index: number) => {
    setHeaders(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addFormEntry = useCallback(() => {
    setFormEntries(prev => [...prev, { key: '', value: '' }]);
  }, []);

  const updateFormEntry = useCallback((index: number, field: 'key' | 'value', val: string) => {
    setFormEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: val } : e));
  }, []);

  const removeFormEntry = useCallback((index: number) => {
    setFormEntries(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const fetchHeaders: Record<string, string> = {};
      for (const h of headers) {
        if (h.key.trim()) {
          fetchHeaders[h.key.trim()] = h.value;
        }
      }

      let requestBody: string | undefined;

      if (hasBody) {
        const hasContentType = Object.keys(fetchHeaders).some(
          k => k.toLowerCase() === 'content-type'
        );

        if (bodyFormat === 'form') {
          const params = new URLSearchParams();
          for (const entry of formEntries) {
            if (entry.key.trim()) {
              params.append(entry.key.trim(), entry.value);
            }
          }
          const encoded = params.toString();
          if (encoded) {
            requestBody = encoded;
            if (!hasContentType) {
              fetchHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
            }
          }
        } else if (body.trim()) {
          requestBody = body;
          if (!hasContentType) {
            fetchHeaders['Content-Type'] = 'application/json';
          }
        }
      }

      const start = performance.now();
      const res = await fetch(endpointUrl, {
        method,
        headers: fetchHeaders,
        body: requestBody,
      });
      const durationMs = Math.round(performance.now() - start);

      const responseBody = await res.text();
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body: responseBody,
        durationMs,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  }, [endpointUrl, method, headers, body, bodyFormat, formEntries, hasBody]);

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-base-content mb-3">Quick Test</h3>

        {/* Method + Send */}
        <div className="flex gap-2 items-center">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="select select-bordered select-sm w-28 font-mono font-semibold"
          >
            {HTTP_METHODS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <div className="flex-1 min-w-0">
            <code className="text-xs text-base-content/60 block truncate">{endpointUrl}</code>
          </div>

          <button
            onClick={handleSend}
            disabled={isLoading}
            className="btn btn-primary btn-sm"
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
            Send
          </button>
        </div>

        {/* Options toggles */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => {
              if (!showHeaders && headers.length === 0) addHeader();
              else setShowHeaders(!showHeaders);
            }}
            className={`btn btn-xs ${showHeaders && headers.length > 0 ? 'btn-active' : 'btn-ghost'}`}
          >
            Headers{headers.filter(h => h.key.trim()).length > 0 && ` (${headers.filter(h => h.key.trim()).length})`}
          </button>
          {hasBody && (
            <button
              onClick={() => setShowBody(!showBody)}
              className={`btn btn-xs ${showBody ? 'btn-active' : 'btn-ghost'}`}
            >
              Body{body.trim() ? ' *' : ''}
            </button>
          )}
        </div>

        {/* Headers editor */}
        {showHeaders && (
          <div className="mt-3 space-y-2">
            {headers.map((header, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                  className="input input-bordered input-xs flex-1 font-mono"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  className="input input-bordered input-xs flex-1 font-mono"
                />
                <button
                  onClick={() => removeHeader(index)}
                  className="btn btn-ghost btn-xs btn-square"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button onClick={addHeader} className="btn btn-ghost btn-xs">
              + Add header
            </button>
          </div>
        )}

        {/* Body editor */}
        {hasBody && showBody && (
          <div className="mt-3">
            {/* Format tabs */}
            <div className="tabs tabs-bordered mb-2">
              <button
                className={`tab tab-sm ${bodyFormat === 'json' ? 'tab-active' : ''}`}
                onClick={() => setBodyFormat('json')}
              >
                JSON
              </button>
              <button
                className={`tab tab-sm ${bodyFormat === 'form' ? 'tab-active' : ''}`}
                onClick={() => setBodyFormat('form')}
              >
                Form URL-Encoded
              </button>
            </div>

            {bodyFormat === 'json' ? (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{"key": "value"}'
                rows={4}
                className="textarea textarea-bordered w-full font-mono text-xs"
                spellCheck={false}
              />
            ) : (
              <div className="space-y-2">
                {formEntries.map((entry, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Key"
                      value={entry.key}
                      onChange={(e) => updateFormEntry(index, 'key', e.target.value)}
                      className="input input-bordered input-xs flex-1 font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={entry.value}
                      onChange={(e) => updateFormEntry(index, 'value', e.target.value)}
                      className="input input-bordered input-xs flex-1 font-mono"
                    />
                    <button
                      onClick={() => removeFormEntry(index)}
                      className="btn btn-ghost btn-xs btn-square"
                      disabled={formEntries.length === 1}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button onClick={addFormEntry} className="btn btn-ghost btn-xs">
                  + Add field
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="alert alert-error mt-3 py-2 text-sm">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="mt-3 border border-base-300 rounded-lg overflow-hidden">
            {/* Response status bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-base-200 text-sm">
              <StatusBadge status={response.status} />
              <span className="text-base-content/70">{response.statusText}</span>
              <span className="ml-auto text-xs text-base-content/50">{response.durationMs}ms</span>
            </div>

            {/* Response tabs */}
            <div className="tabs tabs-bordered px-3 pt-1">
              <button
                className={`tab tab-sm ${activeResponseTab === 'body' ? 'tab-active' : ''}`}
                onClick={() => setActiveResponseTab('body')}
              >
                Body
              </button>
              <button
                className={`tab tab-sm ${activeResponseTab === 'headers' ? 'tab-active' : ''}`}
                onClick={() => setActiveResponseTab('headers')}
              >
                Headers ({Object.keys(response.headers).length})
              </button>
            </div>

            {/* Response content */}
            <div className="p-3 max-h-64 overflow-auto">
              {activeResponseTab === 'body' ? (
                response.body ? (
                  <JsonViewer data={response.body} />
                ) : (
                  <span className="text-base-content/50 italic text-sm">Empty response</span>
                )
              ) : (
                <div className="space-y-1">
                  {Object.entries(response.headers).map(([key, value]) => (
                    <div key={key} className="text-xs font-mono">
                      <span className="text-blue-600">{key}</span>
                      <span className="text-base-content/50">: </span>
                      <span className="text-base-content/80">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
