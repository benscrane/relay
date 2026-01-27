interface JsonViewerProps {
  data: string;
}

function highlightJson(json: string): string {
  // Try to parse and re-stringify for consistent formatting
  try {
    const parsed = JSON.parse(json);
    json = JSON.stringify(parsed, null, 2);
  } catch {
    // If parse fails, use original string
  }

  // Escape HTML entities
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Apply syntax highlighting
  return escaped
    // Keys (including those with escaped characters)
    .replace(/"([^"\\]|\\.)*"(?=\s*:)/g, '<span class="text-blue-600">$&</span>')
    // String values
    .replace(/"([^"\\]|\\.)*"(?!\s*:)/g, '<span class="text-green-600">$&</span>')
    // Numbers
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="text-orange-600">$1</span>')
    // Booleans and null
    .replace(/\b(true|false|null)\b/g, '<span class="text-purple-600">$1</span>');
}

export function JsonViewer({ data }: JsonViewerProps) {
  if (!data || data === 'null') {
    return (
      <span className="text-gray-400 italic">No data</span>
    );
  }

  return (
    <pre
      className="text-sm font-mono bg-gray-50 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words"
      dangerouslySetInnerHTML={{ __html: highlightJson(data) }}
    />
  );
}
