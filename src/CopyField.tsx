'use client';
import { useState } from 'react';

interface Props {
  label: string;
  value: string;
  display?: React.ReactNode;
  /** Marks a value the payer must not leave out (the XRP destination tag) */
  required?: boolean;
  hint?: string;
}

export function CopyField({ label, value, display, required, hint }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="payitgo-label">
        {label}
        {required && <span className="payitgo-required">Required</span>}
      </div>
      <div className={`payitgo-field-box${required ? ' payitgo-field-required' : ''}`}>
        <span className="payitgo-field-value">{display ?? value}</span>
        <button
          type="button"
          className="payitgo-copy"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }, () => { /* clipboard blocked: the value stays selectable */ });
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {hint && <div className={required ? 'payitgo-hint payitgo-hint-required' : 'payitgo-hint'}>{hint}</div>}
    </div>
  );
}
