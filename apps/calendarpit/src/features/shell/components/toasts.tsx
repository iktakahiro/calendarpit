import { Button } from '@cloudflare/kumo/components/button';
import { Icon } from '../../../components/icon';
import { useNotices } from '../../../lib/notices';

/** The error alert and the polite success status region. */
export function Toasts() {
  const { notice, error, dismissError } = useNotices();
  return (
    <div className='toasts'>
      {error && (
        <div className='toast error' role='alert'>
          <Icon name='circleXmark' />
          <span>{error}</span>
          <Button variant='ghost' size='sm' onClick={dismissError}>
            Dismiss
          </Button>
        </div>
      )}
      <p className={`toast ${notice ? '' : 'idle'}`} role='status'>
        {notice && <Icon name='check' />}
        {notice}
      </p>
    </div>
  );
}
