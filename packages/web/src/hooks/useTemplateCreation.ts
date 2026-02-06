import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { Project, CreateEndpointRequest } from '@mockd/shared';
import type { ProjectTemplate } from '@mockd/shared';
import { getApiBaseUrl } from '../config';
import { addAnonymousProjectId, getAnonymousProjectIds, clearAllAnonymousProjects } from '../utils/anonymousProjects';

interface UseTemplateCreationReturn {
  createFromTemplate: (template: ProjectTemplate) => Promise<Project>;
  isCreating: boolean;
  loadingTemplateId: string | null;
}

export function useTemplateCreation(): UseTemplateCreationReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);

  const createFromTemplate = useCallback(async (template: ProjectTemplate): Promise<Project> => {
    setIsCreating(true);
    setLoadingTemplateId(template.id);

    try {
      // Clean up existing anonymous projects (same logic as useProjects.createAnonymousProject)
      const existingIds = getAnonymousProjectIds();
      if (existingIds.length > 0) {
        await Promise.all(
          existingIds.map(async (id) => {
            try {
              await fetch(`${getApiBaseUrl()}/api/projects/${id}`, {
                method: 'DELETE',
                credentials: 'include',
              });
            } catch {
              // Ignore
            }
          })
        );
        clearAllAnonymousProjects();
      }

      // Create the anonymous project with the template name
      const projectRes = await fetch(`${getApiBaseUrl()}/api/projects/anonymous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: template.name }),
      });

      if (!projectRes.ok) {
        const json = await projectRes.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to create project');
      }

      const projectJson = await projectRes.json();
      const project = projectJson.data as Project;
      addAnonymousProjectId(project.id);

      // Create all endpoints from the template
      const endpointPromises = template.endpoints.map(async (ep: CreateEndpointRequest) => {
        const res = await fetch(
          `${getApiBaseUrl()}/api/projects/${project.id}/endpoints`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(ep),
          }
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          console.error(`Failed to create endpoint ${ep.path}:`, json.error);
        }
      });

      await Promise.all(endpointPromises);
      toast.success(`Created "${template.name}" with ${template.endpoints.length} endpoints`);

      return project;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create from template';
      toast.error(msg);
      throw err;
    } finally {
      setIsCreating(false);
      setLoadingTemplateId(null);
    }
  }, []);

  return { createFromTemplate, isCreating, loadingTemplateId };
}
