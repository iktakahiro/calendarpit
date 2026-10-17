import type { Snapshot } from '@calendarpit/server';
import { Badge } from '@cloudflare/kumo/components/badge';
import { Button } from '@cloudflare/kumo/components/button';
import { Icon } from '../../components/icon';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import { useRevokeConnection } from './hooks/use-revoke-connection';
import { formatTimestamp } from '../../lib/format';
import { scopeLabel } from './models/connection-format';

/** OAuth connections (grants) with revocation, for reconnection tests. */
export function ConnectionsScreen({ snapshot }: { snapshot: Snapshot }) {
  const revoke = useRevokeConnection();
  const busy = useWorkspaceBusy();
  const active = snapshot.connections.filter((c) => !c.revoked).length;
  return (
    <div className='stack'>
      <section className='panel' aria-labelledby='connections-title'>
        <header className='panel-head'>
          <div>
            <h2 id='connections-title'>OAuth connections</h2>
            <p>
              {active} active · {snapshot.connections.length - active} revoked
            </p>
          </div>
          <Icon name='shield' />
        </header>
        {snapshot.connections.length ? (
          <ul className='rows'>
            {snapshot.connections.map((c) => (
              <li className='data-row' key={c.id}>
                <div className='data-main'>
                  <strong>
                    {snapshot.users.find((u) => u.id === c.userId)?.name ??
                      c.userId}
                    <span className='arrow' aria-hidden='true'>
                      →
                    </span>
                    <code>{c.clientId}</code>
                  </strong>
                  <ul className='scopes' aria-label='Granted scopes'>
                    {c.scopes.map((s) => (
                      <li key={s} title={s}>
                        {scopeLabel(s)}
                      </li>
                    ))}
                  </ul>
                  <p className='data-sub'>
                    Granted{' '}
                    <time dateTime={c.created}>
                      {formatTimestamp(c.created)}
                    </time>
                  </p>
                </div>
                <Badge variant={c.revoked ? 'secondary' : 'success'}>
                  {c.revoked ? 'Revoked' : 'Active'}
                </Badge>
                <Button
                  variant='secondary-destructive'
                  size='sm'
                  disabled={c.revoked || busy}
                  onClick={() => revoke.mutate(c.id)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className='empty-state compact'>
            <Icon name='plug' />
            <h3>No connections yet</h3>
            <p>
              Approve access from your app. To try it, start the SDK sample with{' '}
              <code>bun run sample:dev</code>.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
