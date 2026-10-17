import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandler } from './runtime';

const directory = await mkdtemp(join(tmpdir(), 'calendarpit-assets-'));
const path = join(directory, 'app.js');
await Bun.write(path, 'console.info("local asset");');
afterAll(() => rm(directory, { recursive: true, force: true }));

const handle = createHandler({
  assets: new Map([['/assets/app.js', Bun.file(path)]]),
  fetch: () => new Response('Not found.', { status: 404 }),
});

describe('asset serving', () => {
  test('serves built assets with MIME and HEAD support', async () => {
    const response = await handle(
      new Request('http://localhost/assets/app.js'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('javascript');
    expect(await response.text()).toContain('local asset');
    const head = await handle(
      new Request('http://localhost/assets/app.js', { method: 'HEAD' }),
    );
    expect(await head.text()).toBe('');
    expect(head.headers.get('Content-Length')).toBe(
      String(Bun.file(path).size),
    );
  });

  test('does not resolve arbitrary files from the request path', async () => {
    const response = await handle(
      new Request('http://localhost/%2e%2e/package.json'),
    );
    expect(response.status).toBe(404);
  });

  test('rejects asset writes', async () => {
    const response = await handle(
      new Request('http://localhost/assets/app.js', { method: 'POST' }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
  });
});
