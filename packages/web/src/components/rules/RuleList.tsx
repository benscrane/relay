import type { MockRule } from '@relay/shared';
import { MethodBadge } from '../common/MethodBadge';

interface RuleListProps {
  rules: MockRule[];
  onEdit: (rule: MockRule) => void;
  onDelete: (ruleId: string) => void;
  onToggleActive: (rule: MockRule) => void;
}

export function RuleList({ rules, onEdit, onDelete, onToggleActive }: RuleListProps) {
  // Sort by priority (highest first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  if (sortedRules.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="mb-2">No rules configured</p>
        <p className="text-sm">
          Create a rule to customize responses based on request matching
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {sortedRules.map((rule) => (
        <div
          key={rule.id}
          className={`px-4 py-3 ${!rule.isActive ? 'opacity-50' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-8">#{rule.priority}</span>
              {rule.matchMethod && (
                <MethodBadge method={rule.matchMethod} />
              )}
              {!rule.matchMethod && (
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-sm">
                  ANY
                </span>
              )}
              <span className="font-mono text-sm text-gray-800">
                {rule.matchPath || '*'}
              </span>
              {rule.name && (
                <span className="text-sm text-gray-500">
                  {rule.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${
                rule.responseStatus >= 200 && rule.responseStatus < 300
                  ? 'bg-green-100 text-green-700'
                  : rule.responseStatus >= 400
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
              }`}>
                {rule.responseStatus}
              </span>

              <button
                onClick={() => onToggleActive(rule)}
                className={`p-1 rounded transition-colors ${
                  rule.isActive
                    ? 'text-green-600 hover:bg-green-50'
                    : 'text-gray-400 hover:bg-gray-100'
                }`}
                title={rule.isActive ? 'Disable rule' : 'Enable rule'}
              >
                {rule.isActive ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => onEdit(rule)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-sm transition-colors"
                title="Edit rule"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>

              <button
                onClick={() => onDelete(rule.id)}
                className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                title="Delete rule"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {rule.responseDelayMs > 0 && (
            <div className="mt-1 ml-11 text-xs text-gray-400">
              Delay: {rule.responseDelayMs}ms
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
