import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="text-secondary mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-base-content mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-base-content/70 mb-4 max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
}
