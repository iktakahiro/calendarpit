import { Button } from '@cloudflare/kumo/components/button';
import { useState } from 'react';
import { Icon } from '../../../components/icon';
import { useMessages } from '../../../components/language';

/** Copies text and briefly displays the same confirmation used for payloads. */
export function CopyButton({
  label,
  text,
  children,
}: {
  label: string;
  text: () => string;
  children: string;
}) {
  const t = useMessages();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant='ghost'
      size='sm'
      icon={<Icon name={copied ? 'check' : 'copy'} />}
      aria-label={label}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text())
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
    >
      {copied ? t['history.copied'] : children}
    </Button>
  );
}
