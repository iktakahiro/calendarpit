import type { Snapshot } from '@calendarpit/server';
import { Badge } from '@cloudflare/kumo/components/badge';
import { Icon } from '../../components/icon';
import { formatTimestamp } from '../../lib/format';

const deliveryBadge = {
  delivered: 'success',
  failed: 'error',
  queued: 'warning',
  cancelled: 'secondary',
} as const;

/** Active watch channels and the webhook delivery log. */
export function WatchScreen({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className='stack'>
      <section className='panel' aria-labelledby='channels-title'>
        <header className='panel-head'>
          <div>
            <h2 id='channels-title'>Watch channels</h2>
            <p>{snapshot.channels.length} active subscriptions</p>
          </div>
          <Icon name='broadcast' />
        </header>
        {snapshot.channels.length ? (
          <ul className='rows'>
            {snapshot.channels.map((c) => (
              <li className='data-row' key={c.id}>
                <div className='data-main'>
                  <strong>
                    <code>{c.id}</code>
                  </strong>
                  <p className='data-sub route'>
                    <code>{c.calendarId}</code>
                    <span className='arrow' aria-hidden='true'>
                      →
                    </span>
                    <code>{c.address}</code>
                  </p>
                  <p className='data-sub'>
                    Expires{' '}
                    <time dateTime={new Date(c.expiration).toISOString()}>
                      {formatTimestamp(c.expiration)}
                    </time>
                  </p>
                </div>
                <Badge variant='info'>Watching</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <div className='empty-state compact'>
            <Icon name='broadcast' />
            <h3>No active subscriptions</h3>
            <p>
              Channels created with <code>events.watch</code> appear here until
              they expire or are stopped.
            </p>
          </div>
        )}
      </section>
      <section className='panel' aria-labelledby='deliveries-title'>
        <header className='panel-head'>
          <div>
            <h2 id='deliveries-title'>Delivery log</h2>
            <p>Push notifications sent to watch channels, newest first.</p>
          </div>
          <Icon name='signal' />
        </header>
        {snapshot.deliveries.length ? (
          <div className='table-wrap'>
            <table className='data-table'>
              <thead>
                <tr>
                  <th scope='col'>Channel / message</th>
                  <th scope='col'>State</th>
                  <th scope='col'>Attempts</th>
                  <th scope='col'>Time</th>
                  <th scope='col'>Status</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.deliveries
                  .slice()
                  .reverse()
                  .map((d) => (
                    <tr key={d.id}>
                      <td>
                        <code>
                          {d.channelId} / #{d.messageNumber}
                        </code>
                      </td>
                      <td>
                        <code>{d.state}</code>
                      </td>
                      <td className='num'>
                        {d.attempts} {d.attempts === 1 ? 'attempt' : 'attempts'}
                      </td>
                      <td className='num'>
                        <time dateTime={d.time}>{formatTimestamp(d.time)}</time>
                      </td>
                      <td>
                        <Badge variant={deliveryBadge[d.status] ?? 'secondary'}>
                          {d.status}
                          {d.httpStatus ? ` · ${d.httpStatus}` : ''}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className='empty-state compact'>
            <Icon name='signal' />
            <h3>No deliveries yet</h3>
            <p>Notifications will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
