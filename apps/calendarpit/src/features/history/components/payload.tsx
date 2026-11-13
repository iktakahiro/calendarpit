import { useMessages } from '../../../components/language';
import { CopyButton } from './copy-button';

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
  const text = JSON.stringify(value, null, 2);
  return (
    <div className='payload'>
      <div className='payload-head'>
        <h3>{title}</h3>
        <CopyButton label={copyLabel} text={() => text}>
          {t['history.copy']}
        </CopyButton>
      </div>
      <pre>{text}</pre>
    </div>
  );
}
