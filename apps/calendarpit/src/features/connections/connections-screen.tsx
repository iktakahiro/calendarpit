import type { Snapshot } from '@calendarpit/server';
import { Badge } from '@cloudflare/kumo/components/badge';
import { Empty } from '@cloudflare/kumo/components/empty';
import { ConfirmButton } from '../../components/confirm-button';
import { Icon } from '../../components/icon';
import { useLocale, useMessages } from '../../components/language';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import { useRevokeConnection } from './hooks/use-revoke-connection';
import { formatTimestamp } from '../../lib/format';
import { scopeLabel } from './models/connection-format';

/** OAuth connections (grants) with revocation, for reconnection tests. */
export function ConnectionsScreen({ snapshot }: { snapshot: Snapshot }) {
  const revoke = useRevokeConnection();
  const busy = useWorkspaceBusy();
  const t = useMessages();
  const locale = useLocale();
  const active = snapshot.connections.filter((c) => !c.revoked).length;
  return (
    <div className='stack'>
      <section className='panel' aria-labelledby='connections-title'>
        <header className='panel-head'>
          <div>
            <h2 id='connections-title'>{t['connections.title']}</h2>
            <p>
              {t['connections.summary'](
                active,
                snapshot.connections.length - active,
              )}
            </p>
          </div>
          <Icon name='shield' />
        </header>
        {snapshot.connections.length ? (
          <ul className='rows'>
            {snapshot.connections.map((c) => {
              const user =
                snapshot.users.find((u) => u.id === c.userId)?.name ?? c.userId;
              return (
                <li className='data-row' key={c.id}>
                  <div className='data-main'>
                    <strong>
                      {user}
                      <span className='arrow' aria-hidden='true'>
                        →
                      </span>
                      <code>{c.clientId}</code>
                    </strong>
                    <ul className='scopes' aria-label={t['connections.scopes']}>
                      {c.scopes.map((s) => (
                        <li key={s} title={s}>
                          {scopeLabel(s)}
                        </li>
                      ))}
                    </ul>
                    <p className='data-sub'>
                      {t['connections.granted']}
                      <time dateTime={c.created}>
                        {formatTimestamp(c.created, locale)}
                      </time>
                    </p>
                  </div>
                  <Badge variant={c.revoked ? 'secondary' : 'success'}>
                    {c.revoked
                      ? t['connections.revoked']
                      : t['connections.active']}
                  </Badge>
                  <ConfirmButton
                    size='sm'
                    label={t['connections.revoke']}
                    ariaLabel={t['connections.revokeLabel'](user, c.clientId)}
                    disabled={c.revoked || busy}
                    loading={revoke.isPending && revoke.variables === c.id}
                    title={t['connections.revokeTitle'](user, c.clientId)}
                    description={t['connections.revokeDescription']}
                    confirmLabel={t['connections.revokeConfirm']}
                    confirm={() => revoke.mutate(c.id)}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty
            size='sm'
            className='empty-state'
            icon={<Icon name='plug' />}
            title={t['connections.empty']}
            description={t['connections.emptyDescription']}
            commandLine='bun run sample:dev'
          />
        )}
      </section>
    </div>
  );
}
