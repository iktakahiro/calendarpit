import { cp, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '../dist');
// Start's server bundle is only a build-time renderer, never a deployment artifact.
await rm(`${dist}/server`, { recursive: true, force: true });
const staged = `${dist}/static`;
await rename(`${dist}/client`, staged);
for await (const entry of new Bun.Glob('*').scan({
  cwd: staged,
  onlyFiles: false,
})) {
  await cp(`${staged}/${entry}`, `${dist}/${entry}`, { recursive: true });
}
await rm(staged, { recursive: true });
const base = (process.env.DOCS_BASE_PATH ?? '/').replace(/^\/|\/$/gu, '');
// Prerender paths include the deployment base, while hosts mount the artifact at it.
const prerendered = base ? `${dist}/${base}` : dist;
if (base && (await Bun.file(`${prerendered}/index.html`).exists())) {
  await cp(prerendered, dist, { recursive: true });
  await rm(prerendered, { recursive: true });
}
await cp(`${dist}/404/index.html`, `${dist}/404.html`);
await rm(`${dist}/404`, { recursive: true });
console.log('Static documentation ready in apps/docs/dist (no server bundle).');
