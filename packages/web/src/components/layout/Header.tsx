import type { ConnectionStatus } from '../../hooks/useWebSocket';

interface HeaderProps {
  status: ConnectionStatus;
}

const statusConfig: Record<ConnectionStatus, { label: string; color: string }> = {
  connected: { label: 'Live', color: 'bg-green-500' },
  connecting: { label: 'Connecting', color: 'bg-yellow-500' },
  disconnected: { label: 'Disconnected', color: 'bg-gray-400' },
  error: { label: 'Error', color: 'bg-red-500' },
};

export function Header({ status }: HeaderProps) {
  const { label, color } = statusConfig[status];

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-bold text-gray-900">Relay</h1>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-sm text-gray-600">Status: {label}</span>
      </div>
    </header>
  );
}
