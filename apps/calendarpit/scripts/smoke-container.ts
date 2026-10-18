import assert from 'node:assert/strict';
import { releaseVersion } from './release/artifacts';

const image = process.argv[2] ?? 'calendarpit:local';
const id = `calendarpit-smoke-${crypto.randomUUID()}`;
const volume = `${id}-data`;
const names = new Set<string>();
async function docker(args: string[]) {
  const child = Bun.spawn(['docker', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`docker ${args.join(' ')}: ${stderr}`);
  return stdout.trim();
}
async function start(suffix: string, memory = false) {
  const name = `${id}-${suffix}`;
  names.add(name);
  await docker([
    'run',
    '-d',
    '--name',
    name,
    '-p',
    '127.0.0.1::4173',
    ...(memory
      ? ['-e', 'CALENDARPIT_DATABASE=:memory:']
      : ['-v', `${volume}:/data`]),
    image,
  ]);
  const port = await docker(['port', name, '4173/tcp']);
  const origin = `http://${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`${origin}/__calendarpit/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return { name, origin };
    } catch {
      /* The container may still be starting. */
    }
    await Bun.sleep(100);
  }
  throw new Error(`Container failed to start: ${await docker(['logs', name])}`);
}
async function request(origin: string, path: string, body?: unknown) {
  const response = await fetch(`${origin}/__calendarpit/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  assert.ok(response.ok, `${path}: ${response.status}`);
  return response.json();
}
try {
  assert.equal(
    await docker(['run', '--rm', image, '--version']),
    releaseVersion,
  );
  const first = await start('first');
  assert.equal((await request(first.origin, 'health')).storage, 'sqlite');
  const initial = (await request(first.origin, 'state')).users.length;
  assert.equal((await fetch(first.origin)).status, 200);
  await request(first.origin, 'users', {
    id: 'container-user',
    name: 'Container user',
    email: 'container@example.test',
  });
  await docker(['stop', '-t', '5', first.name]);
  const second = await start('second');
  assert.equal(
    (await request(second.origin, 'state')).users.length,
    initial + 1,
  );
  await request(second.origin, 'reset', {});
  await docker(['stop', '-t', '5', second.name]);
  const third = await start('third');
  assert.equal((await request(third.origin, 'state')).users.length, initial);
  assert.notEqual(await docker(['exec', third.name, 'id', '-u']), '0');
  const memory = await start('memory', true);
  assert.equal((await request(memory.origin, 'health')).storage, 'memory');
  await request(memory.origin, 'users', {
    id: 'temporary-user',
    name: 'Temporary user',
    email: 'temporary@example.test',
  });
  await docker(['stop', '-t', '5', memory.name]);
  const fresh = await start('fresh', true);
  assert.equal((await request(fresh.origin, 'state')).users.length, initial);
  console.info(
    'Container passed: version, HTTP/UI, non-root user, volume persistence, reset baseline, and memory isolation.',
  );
} finally {
  for (const name of names) await docker(['rm', '-f', name]).catch(() => {});
  await docker(['volume', 'rm', volume]).catch(() => {});
}
