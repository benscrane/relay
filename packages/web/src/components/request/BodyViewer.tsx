import { useMemo } from 'react';
import { parseFormBody, isFormUrlEncoded } from '@mockd/shared/utils';
import { JsonViewer } from './JsonViewer';

interface BodyViewerProps {
  body: string | null;
  contentType?: string;
}

/**
 * Renders a request body with format-aware display.
 * Detects URL-encoded form data and shows it as a key-value table,
 * otherwise falls back to JSON viewer.
 */
export function BodyViewer({ body, contentType }: BodyViewerProps) {
  const formData = useMemo(() => {
    if (!body || !contentType || !isFormUrlEncoded(contentType)) return null;
    const parsed = parseFormBody(body);
    return Object.keys(parsed).length > 0 ? parsed : null;
  }, [body, contentType]);

  if (!body || body === 'null') {
    return <span className="text-base-content/50 italic">No data</span>;
  }

  if (formData) {
    return (
      <div className="bg-base-200 rounded-sm overflow-x-auto">
        <table className="table table-xs font-mono">
          <thead>
            <tr>
              <th className="text-blue-600">Key</th>
              <th className="text-green-600">Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(formData).map(([key, value]) => (
              <tr key={key}>
                <td className="text-blue-600">{key}</td>
                <td className="text-green-600">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <JsonViewer data={body} />;
}
