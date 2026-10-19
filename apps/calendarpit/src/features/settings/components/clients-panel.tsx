import { Button } from '@cloudflare/kumo/components/button';
import { Empty } from '@cloudflare/kumo/components/empty';
import { useState } from 'react';
import { ConfirmButton } from '../../../components/confirm-button';
import { Icon } from '../../../components/icon';
import { useMessages } from '../../../components/language';
import { useWorkspaceBusy } from '../../workspace/hooks/use-workspace-mutation';
import { useDeleteClient } from '../hooks/use-clients';
import type { ClientSummary } from '../models/client-form';
import { ClientEditor } from './client-editor';

/**
 * Registered OAuth clients. Each client can be edited or deleted in place,
 * and new clients can be added, without loading a fixture.
 */
export function ClientsPanel({ clients }: { clients: ClientSummary[] }) {
  /** The client being edited, `''` for a new client, or `undefined`. */
  const [editing, setEditing] = useState<string>();
  const remove = useDeleteClient();
  const busy = useWorkspaceBusy();
  const t = useMessages();
  const close = () => setEditing(undefined);
  return (
    <section className='panel' aria-labelledby='clients-title'>
      <header className='panel-head'>
        <div>
          <h2 id='clients-title'>{t['clients.title']}</h2>
          <p>{t['clients.description']}</p>
        </div>
        <Button
          variant='ghost'
          size='sm'
          disabled={busy || editing === ''}
          icon={<Icon name='plus' />}
          onClick={() => setEditing('')}
        >
          {t['clients.new']}
        </Button>
      </header>
      {editing === '' && <ClientEditor key='new' done={close} />}
      {clients.length ? (
        <ul className='rows client-list'>
          {clients.map((c) => (
            <li key={c.id}>
              <div className='data-row'>
                <div className='data-main'>
                  <strong>
                    <code>{c.id}</code>
                  </strong>
                  <ul className='scopes' aria-label={t['clients.redirectUris']}>
                    {c.redirectUris.map((uri) => (
                      <li key={uri}>{uri}</li>
                    ))}
                  </ul>
                </div>
                <Button
                  variant='secondary'
                  size='sm'
                  shape='square'
                  aria-label={t['clients.edit'](c.id)}
                  disabled={busy || editing === c.id}
                  icon={<Icon name='pencil' />}
                  onClick={() => setEditing(c.id)}
                />
                <ConfirmButton
                  iconOnly
                  ariaLabel={t['clients.delete'](c.id)}
                  size='sm'
                  icon={<Icon name='trash' />}
                  disabled={busy}
                  title={t['clients.deleteTitle']}
                  description={t['clients.deleteDescription']}
                  confirmLabel={t['clients.deleteConfirm']}
                  confirm={() => {
                    if (editing === c.id) close();
                    remove.mutate(c.id);
                  }}
                />
              </div>
              {editing === c.id && (
                <ClientEditor key={c.id} client={c} done={close} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        editing !== '' && (
          <Empty
            size='sm'
            className='empty-state'
            icon={<Icon name='shield' />}
            title={t['clients.empty']}
            description={t['clients.emptyDescription']}
          />
        )
      )}
    </section>
  );
}
