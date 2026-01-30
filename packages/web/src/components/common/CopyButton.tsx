import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}

export function CopyButton({ text, label = 'Copy', className = '', iconOnly = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed. Try using HTTPS.');
    }
  }, [text]);

  const CopyIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );

  const CheckIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  if (iconOnly) {
    return (
      <button
        onClick={handleCopy}
        className={`btn btn-sm btn-ghost ${copied ? 'text-success' : ''} ${className}`}
        title={copied ? 'Copied!' : label}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      className={`btn btn-sm ${
        copied
          ? 'btn-success'
          : 'btn-outline'
      } ${className}`}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}
