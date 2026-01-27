import type { ReactNode } from 'react';
import type { Project, Endpoint } from '@relay/shared';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import type { ConnectionStatus } from '../../hooks/useWebSocket';

interface LayoutProps {
  children: ReactNode;
  status?: ConnectionStatus;
  projects?: Project[];
  endpoints?: Endpoint[];
  currentProjectId?: string;
  currentEndpointId?: string;
  showSidebar?: boolean;
}

export function Layout({
  children,
  status = 'disconnected',
  projects = [],
  endpoints = [],
  currentProjectId,
  currentEndpointId,
  showSidebar = true,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header status={status} />
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <Sidebar
            projects={projects}
            endpoints={endpoints}
            currentProjectId={currentProjectId}
            currentEndpointId={currentEndpointId}
          />
        )}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
