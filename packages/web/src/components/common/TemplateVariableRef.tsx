import { useState } from 'react';

const VARIABLE_GROUPS = [
  {
    label: 'Dynamic Values',
    variables: [
      { name: '{{$uuid}}', description: 'Random UUID' },
      { name: '{{$randomInt}}', description: 'Random integer (0-1000)' },
      { name: '{{$randomFloat}}', description: 'Random float (0.00-1.00)' },
      { name: '{{$randomBool}}', description: 'true or false' },
      { name: '{{$randomEmail}}', description: 'Random email address' },
      { name: '{{$randomName}}', description: 'Random full name' },
      { name: '{{$randomString}}', description: 'Random 16-char string' },
      { name: '{{$timestamp}}', description: 'ISO 8601 timestamp' },
      { name: '{{$timestampUnix}}', description: 'Unix timestamp (seconds)' },
      { name: '{{$date}}', description: 'Date (YYYY-MM-DD)' },
    ],
  },
  {
    label: 'Request Data',
    variables: [
      { name: '{{request.method}}', description: 'HTTP method (GET, POST, ...)' },
      { name: '{{request.path}}', description: 'Request path' },
      { name: '{{request.header.Name}}', description: 'Header value by name' },
      { name: '{{request.query.key}}', description: 'Query parameter value' },
      { name: '{{request.body}}', description: 'Raw request body' },
      { name: '{{request.body.field}}', description: 'JSON body field (dot notation)' },
    ],
  },
  {
    label: 'Path Parameters',
    variables: [
      { name: '{{paramName}}', description: 'Path parameter from :paramName' },
    ],
  },
];

export function TemplateVariableRef() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-primary hover:text-primary-focus inline-flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {isOpen ? 'Hide' : 'Show'} template variables
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-2 p-3 bg-base-200/50 rounded-lg text-xs space-y-3">
          <p className="text-base-content/70">
            Use <code className="bg-base-300 px-1 rounded">{'{{variable}}'}</code> in your response body to insert dynamic values at request time.
          </p>
          {VARIABLE_GROUPS.map((group) => (
            <div key={group.label}>
              <h5 className="font-semibold text-base-content/80 mb-1">{group.label}</h5>
              <div className="grid grid-cols-1 gap-0.5">
                {group.variables.map((v) => (
                  <div key={v.name} className="flex items-baseline gap-2">
                    <code className="text-primary bg-base-300 px-1 rounded whitespace-nowrap font-mono">{v.name}</code>
                    <span className="text-base-content/60">{v.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-base-content/50 italic">
            Example: <code className="bg-base-300 px-1 rounded">{'{"id": "{{$uuid}}", "method": "{{request.method}}"}'}</code>
          </p>
        </div>
      )}
    </div>
  );
}
