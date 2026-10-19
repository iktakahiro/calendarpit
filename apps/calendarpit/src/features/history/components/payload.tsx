import { Button } from '@cloudflare/kumo/components/button';
import { useState } from 'react';
import { Icon } from '../../../components/icon';
import { useMessages } from '../../../components/language';

/** How long the copy button shows its confirmation. */
const copiedMs = 1500;

/** A pretty-printed JSON payload with a copy button. */
export function Payload({
  title,
  copyLabel,
  value,
}: {
  title: string;
  /** Accessible name of the copy button. */
  copyLabel: string;
  value: unknown;
}) {
  const t = useMessages();
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
          aria-label={copyLabel}
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
          {copied ? t['history.copied'] : t['history.copy']}
        </Button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}
