import { PROJECT_TEMPLATES, type ProjectTemplate } from '@mockd/shared';

interface TemplateSelectorProps {
  onSelect: (template: ProjectTemplate) => void;
  isLoading?: boolean;
  loadingTemplateId?: string | null;
}

const TEMPLATE_ICONS: Record<string, JSX.Element> = {
  'rest-crud': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm0 5h16M9 4v16" />
    </svg>
  ),
  'webhook-receiver': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  'error-simulation': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

export function TemplateSelector({ onSelect, isLoading, loadingTemplateId }: TemplateSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {PROJECT_TEMPLATES.map((template) => {
        const isThisLoading = isLoading && loadingTemplateId === template.id;
        return (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            disabled={isLoading}
            className="card bg-base-100 border border-base-300 hover:border-primary hover:shadow-md transition-all text-left p-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="text-primary shrink-0 mt-0.5">
                {TEMPLATE_ICONS[template.id] ?? TEMPLATE_ICONS['rest-crud']}
              </div>
              <div className="min-w-0">
                <h4 className="font-medium text-sm text-base-content">
                  {isThisLoading ? 'Creating...' : template.name}
                </h4>
                <p className="text-xs text-base-content/60 mt-1">
                  {template.description}
                </p>
                <p className="text-xs text-base-content/40 mt-2">
                  {template.endpoints.length} {template.endpoints.length === 1 ? 'endpoint' : 'endpoints'}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
