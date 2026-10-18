import type { Snapshot } from '@calendarpit/server';
import { Collapsible } from '@cloudflare/kumo/components/collapsible';
import { Empty } from '@cloudflare/kumo/components/empty';
import { InputArea } from '@cloudflare/kumo/components/input';
import { Tabs } from '@cloudflare/kumo/primitives/tabs';
import { useState } from 'react';
import { AppearanceSwitcher } from '../../components/appearance';
import { ConfirmButton } from '../../components/confirm-button';
import { Icon } from '../../components/icon';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import { useLoadFixture, useResetWorkspace } from './hooks/use-fixtures';

/** Appearance, storage, fixtures and reset, and registered OAuth clients. */
export function SettingsScreen({ snapshot }: { snapshot: Snapshot }) {
  const [fixture, setFixture] = useState('');
  const loadFixture = useLoadFixture();
  const reset = useResetWorkspace();
  const busy = useWorkspaceBusy();
  return (
    <Tabs.Root defaultValue='appearance' className='settings-content'>
      <Tabs.List className='settings-tabs' aria-label='Settings sections'>
        <Tabs.Tab value='appearance'>Appearance</Tabs.Tab>
        <Tabs.Tab value='data'>Test data</Tabs.Tab>
        <Tabs.Tab value='clients'>OAuth clients</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value='appearance' className='stack settings-panel'>
        <section className='panel' aria-labelledby='appearance-title'>
          <header className='panel-head'>
            <div>
              <h2 id='appearance-title'>Appearance</h2>
              <p>Choose a theme, or follow your device settings.</p>
            </div>
            <Icon name='display' />
          </header>
          <div className='panel-body'>
            <AppearanceSwitcher />
          </div>
        </section>
      </Tabs.Panel>
      <Tabs.Panel value='data' className='stack settings-panel'>
        <section className='panel' aria-labelledby='storage-title'>
          <header className='panel-head'>
            <div>
              <h2 id='storage-title'>Storage</h2>
              <p>
                {snapshot.storage.mode === 'sqlite'
                  ? 'Changes are saved automatically across restarts.'
                  : 'Temporary session. Restarting discards changes.'}
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
              <h2 id='fixtures-title'>Fixtures & reset</h2>
              <p>
                Load JSON with users, calendars, events, and OAuth clients.
                Loading replaces current state; reset restores the initial
                fixture.
              </p>
            </div>
            <Icon name='database' />
          </header>
          <div className='panel-body'>
            <label className='field'>
              <span>Fixture JSON</span>
              <InputArea
                aria-label='Fixture JSON'
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
                Open JSON file…
              </label>
              <ConfirmButton
                label='Load fixture'
                variant='primary'
                disabled={busy || !fixture.trim()}
                title='Load this fixture?'
                description='The fixture replaces the current users, calendars, events, and OAuth clients, and every connection is revoked.'
                confirmLabel='Load fixture'
                confirm={() => loadFixture.mutate(fixture)}
              />
            </div>
            <div className='danger-zone'>
              <div>
                <h3>Reset workspace</h3>
                <p>
                  Restore initial data and clear connections, history, and watch
                  channels.
                </p>
              </div>
              <ConfirmButton
                label='Reset workspace'
                icon={<Icon name='arrowRotateLeft' />}
                disabled={busy}
                title='Reset the workspace?'
                description='The startup fixture is restored, and connections, protocol history, and watch channels are cleared.'
                confirmLabel='Reset workspace'
                confirm={() => reset.mutate(undefined)}
              />
            </div>
          </div>
        </section>
        <Collapsible.Root className='panel state-dump'>
          <Collapsible.Trigger className='state-dump-summary'>
            <span>Current state</span>
            <small>Credentials excluded · revision {snapshot.revision}</small>
          </Collapsible.Trigger>
          <Collapsible.Panel>
            <pre>{JSON.stringify(snapshot, null, 2)}</pre>
          </Collapsible.Panel>
        </Collapsible.Root>
      </Tabs.Panel>
      <Tabs.Panel value='clients' className='stack settings-panel'>
        <section className='panel' aria-labelledby='clients-title'>
          <header className='panel-head'>
            <div>
              <h2 id='clients-title'>Registered OAuth clients</h2>
              <p>Configure client secrets and redirect URIs in a fixture.</p>
            </div>
            <Icon name='shield' />
          </header>
          {snapshot.clients.length ? (
            <ul className='rows'>
              {snapshot.clients.map((c) => (
                <li className='data-row' key={c.id}>
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
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              size='sm'
              className='empty-state'
              icon={<Icon name='shield' />}
              title='No OAuth clients'
              description='Add clients to a fixture to enable the consent flow.'
            />
          )}
        </section>
      </Tabs.Panel>
    </Tabs.Root>
  );
}
