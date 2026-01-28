import { useMemo } from 'react';

interface JsonViewerProps {
  data: string;
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

export function JsonViewer({ data }: JsonViewerProps) {
  const tokens = useMemo(() => {
    if (!data || data === 'null') {
      return null;
    }

    // Try to parse and re-stringify for consistent formatting
    let formatted = data;
    try {
      const parsed = JSON.parse(data);
      formatted = JSON.stringify(parsed, null, 2);
    } catch {
      // If parse fails, use original string
    }

    return tokenizeJson(formatted);
  }, [data]);

  if (!tokens) {
    return <span className="text-gray-400 italic">No data</span>;
  }

  return (
    <pre className="text-sm font-mono bg-gray-50 p-3 rounded-sm overflow-x-auto whitespace-pre-wrap wrap-break-word">
      {tokens.map((token, index) => {
        const className = tokenColors[token.type];
        return className ? (
          <span key={index} className={className}>{token.value}</span>
        ) : (
          <span key={index}>{token.value}</span>
        );
      })}
    </pre>
  );
}
