import { resolve, sep } from 'node:path';

const dist = resolve(import.meta.dirname, '../dist');
const base = process.env.DOCS_BASE_PATH ?? '/';
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 4488,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === base.slice(0, -1))
      return Response.redirect(new URL(base, url), 308);
    if (!url.pathname.startsWith(base))
      return new Response('Not found', { status: 404 });
    let relative: string;
    try {
      relative = decodeURIComponent(url.pathname.slice(base.length));
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    const path = resolve(dist, relative);
    if (path !== dist && !path.startsWith(`${dist}${sep}`))
      return new Response('Not found', { status: 404 });
    const file = Bun.file(
      url.pathname.endsWith('/') ? `${path}/index.html` : path,
    );
    if (await file.exists()) return new Response(file);
    if (await Bun.file(`${path}/index.html`).exists())
      return Response.redirect(new URL(`${url.pathname}/`, url), 308);
    return new Response(Bun.file(`${dist}/404.html`), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
});
console.log(`Static documentation preview: ${server.url.origin}${base}`);
