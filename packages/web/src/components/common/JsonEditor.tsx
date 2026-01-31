import { useRef, useCallback, useMemo } from 'react';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  id?: string;
}

interface JsonError {
  message: string;
  line: number;
  column: number;
}

function getPositionFromOffset(text: string, offset: number): { line: number; column: number } {
  const lines = text.slice(0, offset).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function validateJson(value: string): JsonError | null {
  if (!value.trim()) return null; // Empty is valid (for optional fields)
  try {
    JSON.parse(value);
    return null;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Invalid JSON';

    // Try to extract position from error message (varies by JS engine)
    // Common formats: "at position 42", "at line 3 column 5"
    const positionMatch = errorMessage.match(/position\s+(\d+)/i);
    const lineColMatch = errorMessage.match(/line\s+(\d+)\s+column\s+(\d+)/i);

    let line = 1;
    let column = 1;

    if (lineColMatch) {
      line = parseInt(lineColMatch[1], 10);
      column = parseInt(lineColMatch[2], 10);
    } else if (positionMatch) {
      const offset = parseInt(positionMatch[1], 10);
      const pos = getPositionFromOffset(value, offset);
      line = pos.line;
      column = pos.column;
    }

    // Clean up the error message for display
    const cleanMessage = errorMessage
      .replace(/^JSON\.parse:\s*/i, '')
      .replace(/\s+at position \d+/i, '')
      .replace(/\s+at line \d+ column \d+/i, '');

    return { message: cleanMessage, line, column };
  }
}

function isValidJson(value: string): boolean {
  return validateJson(value) === null;
}

function formatJson(value: string): string {
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

function FormatIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
    </svg>
  );
}

type TokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation';

interface Token {
  type: TokenType;
  value: string;
}

function tokenizeJson(json: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < json.length) {
    const char = json[i];

    // Whitespace - preserve it
    if (/\s/.test(char)) {
      let whitespace = '';
      while (i < json.length && /\s/.test(json[i])) {
        whitespace += json[i];
        i++;
      }
      tokens.push({ type: 'punctuation', value: whitespace });
      continue;
    }

    // Punctuation
    if ('{}[],:'.includes(char)) {
      tokens.push({ type: 'punctuation', value: char });
      i++;
      continue;
    }

    // String (key or value)
    if (char === '"') {
      let str = '"';
      i++;
      while (i < json.length && json[i] !== '"') {
        if (json[i] === '\\' && i + 1 < json.length) {
          str += json[i] + json[i + 1];
          i += 2;
        } else {
          str += json[i];
          i++;
        }
      }
      str += '"';
      i++;

      // Look ahead to see if this is a key (followed by :)
      let lookahead = i;
      while (lookahead < json.length && /\s/.test(json[lookahead])) {
        lookahead++;
      }
      const isKey = json[lookahead] === ':';

      tokens.push({ type: isKey ? 'key' : 'string', value: str });
      continue;
    }

    // Number
    if (/[-\d]/.test(char)) {
      let num = '';
      while (i < json.length && /[-\d.eE+]/.test(json[i])) {
        num += json[i];
        i++;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // true, false, null
    if (json.slice(i, i + 4) === 'true') {
      tokens.push({ type: 'boolean', value: 'true' });
      i += 4;
      continue;
    }
    if (json.slice(i, i + 5) === 'false') {
      tokens.push({ type: 'boolean', value: 'false' });
      i += 5;
      continue;
    }
    if (json.slice(i, i + 4) === 'null') {
      tokens.push({ type: 'null', value: 'null' });
      i += 4;
      continue;
    }

    // Unknown character - just add it
    tokens.push({ type: 'punctuation', value: char });
    i++;
  }

  return tokens;
}

const tokenColors: Record<TokenType, string> = {
  key: 'text-blue-600',
  string: 'text-green-600',
  number: 'text-orange-600',
  boolean: 'text-purple-600',
  null: 'text-purple-600',
  punctuation: '',
};

function useSyncedScroll(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  highlightRef: React.RefObject<HTMLPreElement | null>
) {
  const handleScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;

    if (textarea && highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }
  }, [textareaRef, highlightRef]);

  return handleScroll;
}

export function JsonEditor({
  value,
  onChange,
  placeholder = '{}',
  rows = 8,
  disabled = false,
  id,
}: JsonEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  const handleScroll = useSyncedScroll(textareaRef, highlightRef);

  const tokens = tokenizeJson(value || '');

  // Calculate min-height based on rows (approximate line height of 1.5rem)
  const minHeight = `${rows * 1.5}rem`;

  const jsonError = useMemo(() => validateJson(value), [value]);

  const canFormat = useMemo(() => {
    if (!value.trim()) return false;
    return jsonError === null;
  }, [value, jsonError]);

  const handleFormat = useCallback(() => {
    if (canFormat) {
      onChange(formatJson(value));
    }
  }, [value, onChange, canFormat]);

  return (
    <div className="font-mono text-sm">
      <div className="relative bg-base-100 rounded-lg">
        {/* Format button */}
        <button
          type="button"
          onClick={handleFormat}
          disabled={disabled || !canFormat}
          className="absolute top-1 right-1 z-20 btn btn-xs btn-ghost text-base-content/50 hover:text-base-content disabled:opacity-30"
          title={canFormat ? 'Format JSON' : 'Invalid JSON'}
        >
          <FormatIcon />
        </button>
        {/* Syntax highlighted background layer */}
        <pre
          ref={highlightRef}
          className="absolute inset-0 p-3 m-0 overflow-hidden pointer-events-none whitespace-pre-wrap break-words"
          style={{ minHeight }}
          aria-hidden="true"
        >
          {tokens.length > 0 ? (
            tokens.map((token, index) => {
              const className = tokenColors[token.type];
              return className ? (
                <span key={index} className={className}>{token.value}</span>
              ) : (
                <span key={index}>{token.value}</span>
              );
            })
          ) : (
            <span className="text-base-content/30">{placeholder}</span>
          )}
          {/* Extra space to ensure pre matches textarea height */}
          {'\n'}
        </pre>

        {/* Editable textarea layer (transparent text, visible caret) */}
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          disabled={disabled}
          placeholder={placeholder}
          className={`relative z-10 w-full p-3 m-0 bg-transparent border rounded-lg resize-y overflow-auto focus:outline-none ${
            jsonError
              ? 'border-error focus:border-error'
              : 'border-base-300 focus:border-primary'
          }`}
          style={{
            minHeight,
            color: 'transparent',
            caretColor: 'oklch(var(--bc))',
          }}
          spellCheck={false}
        />
      </div>

      {/* Inline error display */}
      {jsonError && (
        <div className="mt-1 text-xs text-error flex items-start gap-1">
          <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <span className="font-medium">Line {jsonError.line}, Col {jsonError.column}:</span>{' '}
            {jsonError.message}
          </span>
        </div>
      )}
    </div>
  );
}
