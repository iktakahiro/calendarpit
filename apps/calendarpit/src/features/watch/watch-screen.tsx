import type { Snapshot } from '@calendarpit/server';
import { Badge } from '@cloudflare/kumo/components/badge';
import { Empty } from '@cloudflare/kumo/components/empty';
import { Table } from '@cloudflare/kumo/components/table';
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
                    <code>{c.calendarId ?? 'calendar list'}</code>
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
          <Empty
            size='sm'
            className='empty-state'
            icon={<Icon name='broadcast' />}
            title='No active subscriptions'
            description='Channels created with events.watch or calendarList.watch appear here until they expire or are stopped.'
          />
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
            <Table className='data-table'>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Channel / message</Table.Head>
                  <Table.Head>State</Table.Head>
                  <Table.Head>Attempts</Table.Head>
                  <Table.Head>Time</Table.Head>
                  <Table.Head>Status</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {snapshot.deliveries
                  .slice()
                  .reverse()
                  .map((d) => (
                    <Table.Row key={d.id}>
                      <Table.Cell>
                        <code>
                          {d.channelId} / #{d.messageNumber}
                        </code>
                      </Table.Cell>
                      <Table.Cell>
                        <code>{d.state}</code>
                      </Table.Cell>
                      <Table.Cell className='num'>
                        {d.attempts} {d.attempts === 1 ? 'attempt' : 'attempts'}
                      </Table.Cell>
                      <Table.Cell className='num'>
                        <time dateTime={d.time}>{formatTimestamp(d.time)}</time>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge variant={deliveryBadge[d.status] ?? 'secondary'}>
                          {d.status}
                          {d.httpStatus ? ` · ${d.httpStatus}` : ''}
                        </Badge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
              </Table.Body>
            </Table>
          </div>
        ) : (
          <Empty
            size='sm'
            className='empty-state'
            icon={<Icon name='signal' />}
            title='No deliveries yet'
            description='Notifications will appear here.'
          />
        )}
      </section>
    </div>
  );
}
