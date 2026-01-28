interface MethodBadgeProps {
  method: string;
  size?: 'sm' | 'md';
}

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  PATCH: 'bg-orange-100 text-orange-800',
  DELETE: 'bg-red-100 text-red-800',
  HEAD: 'bg-purple-100 text-purple-800',
  OPTIONS: 'bg-gray-100 text-gray-800',
};

export function MethodBadge({ method, size = 'md' }: MethodBadgeProps) {
  const colorClass = methodColors[method.toUpperCase()] || 'bg-gray-100 text-gray-800';
  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-block font-semibold rounded-sm ${colorClass} ${sizeClass}`}
    >
      {method.toUpperCase()}
    </span>
  );
}
