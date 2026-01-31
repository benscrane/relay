import { useRef, useCallback } from 'react';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  id?: string;
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

  return (
    <div className="relative font-mono text-sm bg-base-100 rounded-lg">
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
        className="relative z-10 w-full p-3 m-0 bg-transparent border border-base-300 rounded-lg resize-y overflow-auto focus:outline-none focus:border-primary"
        style={{
          minHeight,
          color: 'transparent',
          caretColor: 'oklch(var(--bc))',
        }}
        spellCheck={false}
      />
    </div>
  );
}
