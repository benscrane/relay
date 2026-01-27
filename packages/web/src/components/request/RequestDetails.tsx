import type { RequestLog } from '@relay/shared';
import { JsonViewer } from './JsonViewer';

interface RequestDetailsProps {
  request: RequestLog;
}

export function RequestDetails({ request }: RequestDetailsProps) {
  return (
    <div className="bg-gray-50 border-t border-gray-200 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Headers</h4>
        <JsonViewer data={request.headers} />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Body</h4>
        <JsonViewer data={request.body || 'null'} />
      </div>
    </div>
  );
}
