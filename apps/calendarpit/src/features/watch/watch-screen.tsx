import type { Snapshot } from '@calendarpit/server';
import { Badge } from '@cloudflare/kumo/components/badge';
import { Empty } from '@cloudflare/kumo/components/empty';
import { Table } from '@cloudflare/kumo/components/table';
import { Icon } from '../../components/icon';
import { useLocale, useMessages } from '../../components/language';
import { formatTimestamp } from '../../lib/format';

const deliveryBadge = {
  delivered: 'success',
  failed: 'error',
  queued: 'warning',
  cancelled: 'secondary',
} as const;

/** Active watch channels and the webhook delivery log. */
export function WatchScreen({ snapshot }: { snapshot: Snapshot }) {
  const t = useMessages();
  const locale = useLocale();
  return (
    <div className='stack'>
      <section className='panel' aria-labelledby='channels-title'>
        <header className='panel-head'>
          <div>
            <h2 id='channels-title'>{t['watch.channels']}</h2>
            <p>{t['watch.activeCount'](snapshot.channels.length)}</p>
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
                    {t['watch.expires']}
                    <time dateTime={new Date(c.expiration).toISOString()}>
                      {formatTimestamp(c.expiration, locale)}
                    </time>
                  </p>
                </div>
                <Badge variant='info'>{t['watch.watching']}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            size='sm'
            className='empty-state'
            icon={<Icon name='broadcast' />}
            title={t['watch.emptyChannels']}
            description={t['watch.emptyChannelsDescription']}
          />
        )}
      </section>
      <section className='panel' aria-labelledby='deliveries-title'>
        <header className='panel-head'>
          <div>
            <h2 id='deliveries-title'>{t['watch.deliveries']}</h2>
            <p>{t['watch.deliveriesDescription']}</p>
          </div>
          <Icon name='signal' />
        </header>
        {snapshot.deliveries.length ? (
          <div className='table-wrap'>
            <Table className='data-table'>
              <Table.Header>
                <Table.Row>
                  <Table.Head>{t['watch.columnChannel']}</Table.Head>
                  <Table.Head>{t['watch.columnState']}</Table.Head>
                  <Table.Head>{t['watch.columnAttempts']}</Table.Head>
                  <Table.Head>{t['watch.columnTime']}</Table.Head>
                  <Table.Head>{t['watch.columnStatus']}</Table.Head>
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
                        {t['watch.attempts'](d.attempts)}
                      </Table.Cell>
                      <Table.Cell className='num'>
                        <time dateTime={d.time}>
                          {formatTimestamp(d.time, locale)}
                        </time>
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
            title={t['watch.emptyDeliveries']}
            description={t['watch.emptyDeliveriesDescription']}
          />
        )}
      </section>
    </div>
  );
}
