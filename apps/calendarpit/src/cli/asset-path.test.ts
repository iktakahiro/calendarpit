import { expect, test } from 'bun:test';
import { assetPath } from './asset-path';
import { createHandler } from './runtime';

test('Windows and POSIX build paths serve the same HTTP asset URL', async () => {
  for (const filename of ['assets\\app.css', 'assets/app.css']) {
    const handler = createHandler({
      assets: new Map([[assetPath(filename), Bun.file(import.meta.path)]]),
      fetch: () => new Response('Missing', { status: 404 }),
    });
    const response = await handler(
      new Request('http://localhost/assets/app.css'),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Windows and POSIX');
  }
});

test('asset path escapes filenames for URL pathname matching', () => {
  expect(assetPath('assets\\a b#c.svg')).toBe('/assets/a%20b%23c.svg');
});
