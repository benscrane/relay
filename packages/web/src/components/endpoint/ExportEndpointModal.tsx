import { useState, useRef, useEffect } from 'react';
import type { Endpoint, MockRule } from '@mockd/shared';
import { endpointToCurl, endpointsToJson, endpointsToOpenApi, downloadJson } from '../../utils/exportEndpoint';
import { CopyButton } from '../common';

type ExportFormat = 'curl' | 'json' | 'openapi';

interface ExportEndpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  baseUrl: string;
  endpoints: Endpoint[];
  rulesMap?: Map<string, MockRule[]>;
  /** If set, only export this single endpoint */
  singleEndpointId?: string;
}

export function ExportEndpointModal({
  isOpen,
  onClose,
  projectName,
  baseUrl,
  endpoints,
  rulesMap,
  singleEndpointId,
}: ExportEndpointModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<ExportFormat>('curl');

  const targetEndpoints = singleEndpointId
    ? endpoints.filter(e => e.id === singleEndpointId)
    : endpoints;

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
      setFormat('curl');
    }
  }, [isOpen]);

  const getCurlCommands = (): string => {
    return targetEndpoints
      .map(ep => endpointToCurl(baseUrl, ep))
      .join('\n\n');
  };

  const getJsonExport = (): string => {
    const data = endpointsToJson(projectName, targetEndpoints, rulesMap);
    return JSON.stringify(data, null, 2);
  };

  const getOpenApiExport = (): string => {
    const data = endpointsToOpenApi(projectName, baseUrl, targetEndpoints, rulesMap);
    return JSON.stringify(data, null, 2);
  };

  const getExportContent = (): string => {
    switch (format) {
      case 'curl': return getCurlCommands();
      case 'json': return getJsonExport();
      case 'openapi': return getOpenApiExport();
    }
  };

  const handleDownload = () => {
    const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    switch (format) {
      case 'json':
        downloadJson(
          endpointsToJson(projectName, targetEndpoints, rulesMap),
          `${slug}-endpoints.json`
        );
        break;
      case 'openapi':
        downloadJson(
          endpointsToOpenApi(projectName, baseUrl, targetEndpoints, rulesMap),
          `${slug}-openapi.json`
        );
        break;
      case 'curl': {
        const blob = new Blob([getCurlCommands()], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slug}-curl.sh`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        break;
      }
    }
  };

  const title = singleEndpointId
    ? `Export Endpoint`
    : `Export ${targetEndpoints.length} Endpoint${targetEndpoints.length !== 1 ? 's' : ''}`;

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      onClose={onClose}
    >
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">{title}</h3>

        {/* Format tabs */}
        <div className="tabs tabs-bordered mb-4">
          <button
            className={`tab ${format === 'curl' ? 'tab-active' : ''}`}
            onClick={() => setFormat('curl')}
          >
            cURL
          </button>
          <button
            className={`tab ${format === 'json' ? 'tab-active' : ''}`}
            onClick={() => setFormat('json')}
          >
            JSON
          </button>
          <button
            className={`tab ${format === 'openapi' ? 'tab-active' : ''}`}
            onClick={() => setFormat('openapi')}
          >
            OpenAPI
          </button>
        </div>

        {/* Export preview */}
        <div className="relative">
          <pre className="bg-base-200 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
            {getExportContent()}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={getExportContent()} label="Copy" className="btn-xs" />
          </div>
        </div>

        {format === 'curl' && (
          <p className="text-xs text-base-content/50 mt-2">
            cURL commands you can run directly in your terminal to test the mock endpoints.
          </p>
        )}
        {format === 'json' && (
          <p className="text-xs text-base-content/50 mt-2">
            mockd export format. Import this into another mockd project to recreate these endpoints.
          </p>
        )}
        {format === 'openapi' && (
          <p className="text-xs text-base-content/50 mt-2">
            OpenAPI 3.0 spec. Import into Postman, Swagger UI, or any OpenAPI-compatible tool.
          </p>
        )}

        {/* Actions */}
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-outline" onClick={handleDownload}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
