import { useState, useEffect } from 'react';
import type { MockRule, CreateMockRuleRequest, UpdateMockRuleRequest } from '@mockd/shared';
import { useRules } from '../../hooks/useRules';
import { RuleList } from './RuleList';
import { RuleForm } from './RuleForm';
import { ConfirmDialog } from '../common';

interface RulesPanelProps {
  projectId: string;
  endpointId: string;
}

type FormMode = { type: 'closed' } | { type: 'create' } | { type: 'edit'; rule: MockRule };

export function RulesPanel({ projectId, endpointId }: RulesPanelProps) {
  const { rules, loading, error, fetchRules, createRule, updateRule, deleteRule } = useRules();
  const [formMode, setFormMode] = useState<FormMode>({ type: 'closed' });
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  useEffect(() => {
    fetchRules(projectId, endpointId);
  }, [projectId, endpointId, fetchRules]);

  const handleCreate = async (data: CreateMockRuleRequest | UpdateMockRuleRequest) => {
    await createRule(projectId, endpointId, data as Omit<CreateMockRuleRequest, 'endpointId'>);
    setFormMode({ type: 'closed' });
  };

  const handleUpdate = async (data: CreateMockRuleRequest | UpdateMockRuleRequest) => {
    if (formMode.type !== 'edit') return;
    await updateRule(projectId, endpointId, formMode.rule.id, data as UpdateMockRuleRequest);
    setFormMode({ type: 'closed' });
  };

  const handleDelete = (ruleId: string) => {
    setDeleteRuleId(ruleId);
  };

  const confirmDelete = async () => {
    if (!deleteRuleId) return;
    await deleteRule(projectId, endpointId, deleteRuleId);
    setDeleteRuleId(null);
  };

  const handleToggleActive = async (rule: MockRule) => {
    await updateRule(projectId, endpointId, rule.id, { isActive: !rule.isActive });
  };

  if (loading && rules.length === 0) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="px-4 py-3 border-b border-base-200">
          <h3 className="font-semibold text-base-content">Mock Rules</h3>
        </div>
        <div className="px-4 py-12 text-center text-base-content/50">
          Loading rules...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="px-4 py-3 border-b border-base-200">
          <h3 className="font-semibold text-base-content">Mock Rules</h3>
        </div>
        <div className="px-4 py-4 text-center text-error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="px-4 py-3 border-b border-base-200 flex items-center justify-between">
        <h3 className="font-semibold text-base-content">Mock Rules</h3>
        {formMode.type === 'closed' && (
          <button
            onClick={() => setFormMode({ type: 'create' })}
            className="btn btn-primary btn-sm"
          >
            Add Rule
          </button>
        )}
      </div>

      {formMode.type !== 'closed' ? (
        <div className="p-4">
          <h4 className="font-medium text-base-content mb-4">
            {formMode.type === 'create' ? 'Create New Rule' : 'Edit Rule'}
          </h4>
          <RuleForm
            rule={formMode.type === 'edit' ? formMode.rule : undefined}
            onSubmit={formMode.type === 'create' ? handleCreate : handleUpdate}
            onCancel={() => setFormMode({ type: 'closed' })}
          />
        </div>
      ) : (
        <RuleList
          rules={rules}
          onEdit={(rule) => setFormMode({ type: 'edit', rule })}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
        />
      )}

      <ConfirmDialog
        isOpen={deleteRuleId !== null}
        title="Delete Rule"
        message="Are you sure you want to delete this rule?"
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteRuleId(null)}
      />
    </div>
  );
}
