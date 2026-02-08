import { useMemo } from 'react';
import type { RequestLog } from '@mockd/shared';
import { getContentTypeFromHeaders } from '@mockd/shared/utils';
import { JsonViewer } from './JsonViewer';
import { BodyViewer } from './BodyViewer';
import { CopyButton } from '../common/CopyButton';

interface RequestDetailsProps {
  request: RequestLog;
}

function buildCurlCommand(request: RequestLog): string {
  const parts = [`curl -X ${request.method}`];

  try {
    const headers = JSON.parse(request.headers || '{}');
    for (const [key, value] of Object.entries(headers)) {
      const lower = key.toLowerCase();
      if (lower === 'host' || lower === 'content-length' || lower.startsWith('cf-')) continue;
      parts.push(`-H '${key}: ${value}'`);
    }
  } catch {
    // skip malformed headers
  }

  if (request.body && request.body !== 'null') {
    try {
      const parsed = JSON.parse(request.body);
      parts.push(`-d '${JSON.stringify(parsed)}'`);
    } catch {
      parts.push(`-d '${request.body}'`);
    }
  }

  parts.push(`'${request.path}'`);
  return parts.join(' \\\n  ');
}

export function RequestDetails({ request }: RequestDetailsProps) {
  const contentType = useMemo(() => {
    try {
      const headers = JSON.parse(request.headers || '{}');
      return getContentTypeFromHeaders(headers);
    } catch {
      return '';
    }
  }, [request.headers]);

  return (
    <div className="bg-base-200 border-t border-base-200 p-4 space-y-4">
      <div className="flex justify-end">
        <CopyButton text={buildCurlCommand(request)} label="Copy as cURL" />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">Headers</h4>
        <JsonViewer data={request.headers} />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">Body</h4>
        <BodyViewer body={request.body} contentType={contentType} />
      </div>
    </div>
  );
}
