import type { Snapshot } from '@calendarpit/server';
import { Select } from '@cloudflare/kumo/components/select';
import { Collapsible } from '@cloudflare/kumo/components/collapsible';
import { InputArea } from '@cloudflare/kumo/components/input';
import { Tabs } from '@cloudflare/kumo/primitives/tabs';
import { useState } from 'react';
import { AppearanceSwitcher } from '../../components/appearance';
import { ConfirmButton } from '../../components/confirm-button';
import { Icon } from '../../components/icon';
import { LanguageSwitcher, useMessages } from '../../components/language';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import { ClientsPanel } from './components/clients-panel';
import { useLoadFixture, useResetWorkspace } from './hooks/use-fixtures';
import { useSetRateLimitMode } from './hooks/use-rate-limit';

/**
 * Appearance and language, Calendar API rate limits, storage, fixtures and
 * reset, and registered OAuth clients.
 */
export function SettingsScreen({ snapshot }: { snapshot: Snapshot }) {
  const [fixture, setFixture] = useState('');
  const loadFixture = useLoadFixture();
  const reset = useResetWorkspace();
  const setRateLimit = useSetRateLimitMode();
  const busy = useWorkspaceBusy();
  const t = useMessages();
  const mode = snapshot.rateLimitMode;
  return (
    <Tabs.Root defaultValue='appearance' className='settings-content'>
      <Tabs.List className='settings-tabs' aria-label={t['settings.sections']}>
        <Tabs.Tab value='appearance'>{t['settings.appearance']}</Tabs.Tab>
        <Tabs.Tab value='developer'>{t['settings.developer']}</Tabs.Tab>
        <Tabs.Tab value='data'>{t['settings.testData']}</Tabs.Tab>
        <Tabs.Tab value='clients'>{t['settings.clients']}</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value='appearance' className='stack settings-panel'>
        <section className='panel' aria-labelledby='appearance-title'>
          <header className='panel-head'>
            <div>
              <h2 id='appearance-title'>{t['settings.appearance']}</h2>
              <p>{t['settings.appearanceDescription']}</p>
            </div>
            <Icon name='display' />
          </header>
          <div className='panel-body'>
            <div className='field'>
              <span>{t['settings.theme']}</span>
              <AppearanceSwitcher />
            </div>
            <div className='field'>
              <span>{t['settings.language']}</span>
              <LanguageSwitcher />
            </div>
          </div>
        </section>
      </Tabs.Panel>
      <Tabs.Panel value='developer' className='stack settings-panel'>
        <section className='panel' aria-labelledby='rate-limit-title'>
          <header className='panel-head'>
            <div>
              <h2 id='rate-limit-title'>{t['settings.rateLimit']}</h2>
              <p>{t['settings.rateLimitDescription']}</p>
            </div>
            <Icon name='gear' />
          </header>
          <div className='panel-body'>
            <label className='field'>
              <span id='rate-limit-label'>{t['settings.rateLimitMode']}</span>
              <Select
                aria-labelledby='rate-limit-label'
                value={mode}
                disabled={busy}
                onValueChange={(value: Snapshot['rateLimitMode'] | null) => {
                  if (value && value !== mode) setRateLimit.mutate(value);
                }}
                items={{
                  off: t['settings.rateLimitOff'],
                  prod: t['settings.rateLimitProd'],
                  strict: t['settings.rateLimitStrict'],
                }}
              />
            </label>
            <ul className='settings-notes'>
              <li>
                <strong>{t['settings.rateLimitOff']}. </strong>
                {t['settings.rateLimitOffDescription']}
              </li>
              <li>
                <strong>{t['settings.rateLimitProd']}. </strong>
                {t['settings.rateLimitProdDescription']}
              </li>
              <li>
                <strong>{t['settings.rateLimitStrict']}. </strong>
                {t['settings.rateLimitStrictDescription']}
              </li>
            </ul>
          </div>
        </section>
      </Tabs.Panel>
      <Tabs.Panel value='data' className='stack settings-panel'>
        <section className='panel' aria-labelledby='storage-title'>
          <header className='panel-head'>
            <div>
              <h2 id='storage-title'>{t['settings.storage']}</h2>
              <p>
                {snapshot.storage.mode === 'sqlite'
                  ? t['settings.storageSqlite']
                  : t['settings.storageMemory']}
              </p>
            </div>
            <Icon name='database' />
          </header>
          <div className='panel-body'>
            <code className='storage-path'>
              {snapshot.storage.path ?? ':memory:'}
            </code>
          </div>
        </section>
        <section className='panel' aria-labelledby='fixtures-title'>
          <header className='panel-head'>
            <div>
              <h2 id='fixtures-title'>{t['settings.fixtures']}</h2>
              <p>{t['settings.fixturesDescription']}</p>
            </div>
            <Icon name='database' />
          </header>
          <div className='panel-body'>
            <label className='field'>
              <span>{t['settings.fixtureJson']}</span>
              <InputArea
                aria-label={t['settings.fixtureJson']}
                className='mono'
                rows={8}
                spellCheck={false}
                value={fixture}
                onChange={(e) => setFixture(e.target.value)}
                placeholder='{"users": [], "calendars": [], "events": [], "clients": []}'
              />
            </label>
            <div className='button-row'>
              <label className='file-button'>
                <input
                  type='file'
                  accept='application/json,.json'
                  className='sr-only'
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void file.text().then(setFixture);
                  }}
                />
                <Icon name='code' />
                {t['settings.openFile']}
              </label>
              <ConfirmButton
                label={t['settings.loadFixture']}
                variant='primary'
                disabled={busy || !fixture.trim()}
                title={t['settings.loadTitle']}
                description={t['settings.loadDescription']}
                confirmLabel={t['settings.loadFixture']}
                confirm={() => loadFixture.mutate(fixture)}
              />
            </div>
            <div className='danger-zone'>
              <div>
                <h3>{t['settings.reset']}</h3>
                <p>{t['settings.resetDescription']}</p>
              </div>
              <ConfirmButton
                label={t['settings.reset']}
                icon={<Icon name='arrowRotateLeft' />}
                disabled={busy}
                title={t['settings.resetTitle']}
                description={t['settings.resetConfirmDescription']}
                confirmLabel={t['settings.reset']}
                confirm={() => reset.mutate(undefined)}
              />
            </div>
          </div>
        </section>
        <Collapsible.Root className='panel state-dump'>
          <Collapsible.Trigger className='state-dump-summary'>
            <span>{t['settings.currentState']}</span>
            <small>{t['settings.stateNote'](snapshot.revision)}</small>
          </Collapsible.Trigger>
          <Collapsible.Panel>
            <pre>{JSON.stringify(snapshot, null, 2)}</pre>
          </Collapsible.Panel>
        </Collapsible.Root>
      </Tabs.Panel>
      <Tabs.Panel value='clients' className='stack settings-panel'>
        <ClientsPanel clients={snapshot.clients} />
      </Tabs.Panel>
    </Tabs.Root>
  );
}
