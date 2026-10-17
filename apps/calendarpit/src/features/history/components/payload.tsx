import { Button } from '@cloudflare/kumo/components/button';
import { useState } from 'react';
import { Icon } from '../../../components/icon';

/** How long the copy button shows its confirmation. */
const copiedMs = 1500;

/** A pretty-printed JSON payload with a copy button. */
export function Payload({ title, value }: { title: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2);
  return (
    <div className='payload'>
      <div className='payload-head'>
        <h3>{title}</h3>
        <Button
          variant='ghost'
          size='sm'
          icon={<Icon name={copied ? 'check' : 'copy'} />}
          aria-label={`Copy ${title.toLowerCase()} JSON`}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(text)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), copiedMs);
              })
              .catch(() => {});
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}
