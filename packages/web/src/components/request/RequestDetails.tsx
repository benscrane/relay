import type { RequestLog } from '@mockd/shared';
import { JsonViewer } from './JsonViewer';

interface RequestDetailsProps {
  request: RequestLog;
}

export function RequestDetails({ request }: RequestDetailsProps) {
  return (
    <div className="bg-base-200 border-t border-base-200 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">Headers</h4>
        <JsonViewer data={request.headers} />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">Body</h4>
        <JsonViewer data={request.body || 'null'} />
      </div>
    </div>
  );
}
