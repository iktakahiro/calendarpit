import { Button } from '@cloudflare/kumo/components/button';
import { Empty } from '@cloudflare/kumo/components/empty';
import { useState } from 'react';
import { ConfirmButton } from '../../../components/confirm-button';
import { Icon } from '../../../components/icon';
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
  const close = () => setEditing(undefined);
  return (
    <section className='panel' aria-labelledby='clients-title'>
      <header className='panel-head'>
        <div>
          <h2 id='clients-title'>Registered OAuth clients</h2>
          <p>
            Edit secrets and redirect URIs. Users, events, and connections stay
            as they are.
          </p>
        </div>
        <Button
          variant='ghost'
          size='sm'
          disabled={busy || editing === ''}
          icon={<Icon name='plus' />}
          onClick={() => setEditing('')}
        >
          New client
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
                  <ul className='scopes' aria-label='Redirect URIs'>
                    {c.redirectUris.map((uri) => (
                      <li key={uri}>{uri}</li>
                    ))}
                  </ul>
                </div>
                <Button
                  variant='secondary'
                  size='sm'
                  shape='square'
                  aria-label={`Edit ${c.id}`}
                  disabled={busy || editing === c.id}
                  icon={<Icon name='pencil' />}
                  onClick={() => setEditing(c.id)}
                />
                <ConfirmButton
                  iconOnly
                  ariaLabel={`Delete ${c.id}`}
                  size='sm'
                  icon={<Icon name='trash' />}
                  disabled={busy}
                  title='Delete this OAuth client?'
                  description='The client is removed and its connections are revoked. Reset restores the startup fixture.'
                  confirmLabel='Delete client'
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
            title='No OAuth clients'
            description='Add a client to enable the consent flow.'
          />
        )
      )}
    </section>
  );
}
