import assert from 'node:assert/strict';
import { chmod, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { releaseVersion } from './release/artifacts';

const root = resolve(import.meta.dir, '..');
const binaryName = `calendarpit${process.platform === 'win32' ? '.exe' : ''}`;
const directory = await mkdtemp(join(tmpdir(), 'calendarpit-smoke-'));
const binary = join(directory, binaryName);
const override: unknown = process.env.CALENDARPIT_SMOKE_COMMAND
  ? JSON.parse(process.env.CALENDARPIT_SMOKE_COMMAND)
  : undefined;
if (
  override !== undefined &&
  (!Array.isArray(override) ||
    override.length === 0 ||
    !override.every((item) => typeof item === 'string'))
) {
  throw new Error(
    'CALENDARPIT_SMOKE_COMMAND must be a nonempty JSON array of strings.',
  );
}
const command: string[] =
  override === undefined ? [binary] : (override as string[]);
let child: ReturnType<typeof Bun.spawn> | undefined;

async function stop(signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM') {
  if (!child || child.exitCode !== null) return;
  // A launcher and its server form one test process tree. Windows has no POSIX signals.
  if (override && process.platform === 'win32') {
    await Bun.spawn(['taskkill', '/PID', String(child.pid), '/T', '/F'], {
      stdout: 'ignore',
      stderr: 'ignore',
    }).exited;
  } else if (override && signal === 'SIGKILL') {
    process.kill(-child.pid, signal);
  } else {
    child.kill(signal);
  }
  await child.exited;
}

try {
  await copyFile(resolve(root, 'dist/bin', binaryName), binary);
  await chmod(binary, 0o755);
  const config = join(directory, 'fixture.json');
  await Bun.write(
    config,
    JSON.stringify({
      users: [
        { id: 'smoke-user', name: 'Smoke user', email: 'smoke@example.test' },
      ],
      calendars: [],
      events: [],
      clients: [],
    }),
  );
  let origin: string | undefined;
  async function start(database: string) {
    origin = undefined;
    child = Bun.spawn(
      [
        ...command,
        '--config',
        config,
        '--database',
        database,
        '--host',
        '127.0.0.1',
        '--port',
        '0',
      ],
      {
        cwd: directory,
        stdout: 'pipe',
        stderr: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' },
        detached: override !== undefined && process.platform !== 'win32',
      },
    );
    const stdout = child.stdout;
    if (typeof stdout === 'number' || !stdout)
      throw new Error('Missing server output.');
    const reader = stdout.getReader();
    const timeout = setTimeout(() => {
      void stop('SIGKILL');
    }, 15_000);
    let output = '';
    try {
      while (!origin) {
        const { value, done } = await reader.read();
        if (done)
          throw new Error(`The executable exited before startup: ${output}`);
        output += new TextDecoder().decode(value);
        origin = /Admin\s+(http:\/\/[^\s]+)/.exec(output)?.[1];
      }
    } finally {
      clearTimeout(timeout);
      reader.releaseLock();
    }
  }
  const database = join(directory, 'workspace.sqlite');
  await start(database);

  async function request(path: string, init?: RequestInit) {
    return fetch(new URL(path, origin), {
      ...init,
      signal: AbortSignal.timeout(5000),
    });
  }

  const health = await request('/__calendarpit/health');
  assert.equal(health.status, 200);
  const status = await health.json();
  assert.equal(status.stage, 'preview');
  assert.equal(status.version, releaseVersion);
  const state = await request('/__calendarpit/state');
  assert.equal((await state.json()).users[0].id, 'smoke-user');
  const page = await request('/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /calendarpit/);
  assert.equal(
    (await request('/calendar/v3/freeBusy', { method: 'POST' })).status,
    401,
  );
  assert.equal((await request('/__calendarpit/missing')).status, 404);
  assert.equal((await request('/missing-page')).status, 404);

  const files = Array.from(
    new Bun.Glob('**/*').scanSync({
      cwd: resolve(root, 'dist/client'),
      onlyFiles: true,
    }),
  );
  for (const file of files) {
    const response = await request(`/${file.replaceAll('\\', '/')}`);
    assert.equal(response.status, 200, file);
    assert.ok((await response.arrayBuffer()).byteLength > 0, file);
  }
  const head = await request('/favicon.svg', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await request('/favicon.svg', { method: 'POST' })).status, 405);
  const createUser = () =>
    request('/__calendarpit/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'persisted-user',
        name: 'Persisted user',
        email: 'persisted@example.test',
      }),
    });
  assert.equal((await createUser()).status, 201);
  // Kill without cleanup: committed requests must survive and OS locks must release.
  await stop('SIGKILL');
  await start(database);
  assert.equal(
    (await (await request('/__calendarpit/state')).json()).users.length,
    2,
  );
  await stop();
  await start(':memory:');
  assert.equal(
    (await (await request('/__calendarpit/health')).json()).storage,
    'memory',
  );
  assert.equal(
    (await (await request('/__calendarpit/state')).json()).users.length,
    1,
  );
  assert.equal((await createUser()).status, 201);
  await stop();
  await start(':memory:');
  assert.equal(
    (await (await request('/__calendarpit/state')).json()).users.length,
    1,
  );
  await stop();
  await start(database);
  assert.equal(
    (await (await request('/__calendarpit/state')).json()).users.length,
    2,
  );
  assert.equal(
    (
      await request('/__calendarpit/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
    200,
  );
  await stop();
  await start(database);
  assert.equal(
    (await (await request('/__calendarpit/state')).json()).users.length,
    1,
  );
  console.info(
    `Standalone executable passed: SSR, API boundary, ${files.length} embedded assets, crash/restart persistence, memory isolation, and durable reset.`,
  );
} finally {
  if (child) {
    await stop('SIGKILL');
  }
  await rm(directory, { recursive: true, force: true });
}
