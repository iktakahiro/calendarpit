import type { History } from '@calendarpit/server';

const hopByHop = new Set([
  'host',
  'content-length',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

/** Builds a shell command from the recorded, already-redacted request. */
export function buildCurl(row: History, origin: string): string {
  const headers =
    row.headers &&
    typeof row.headers === 'object' &&
    !Array.isArray(row.headers)
      ? Object.entries(row.headers).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        )
      : [];
  const connection =
    headers.find(([key]) => key.toLowerCase() === 'connection')?.[1] ?? '';
  const omitted = new Set([
    ...hopByHop,
    ...connection.split(',').map((name) => name.trim().toLowerCase()),
  ]);
  const args = [
    'curl',
    '--globoff',
    ...(row.method === 'HEAD' ? ['--head'] : ['-X', quote(row.method)]),
    quote(origin + row.path),
  ];
  for (const [key, value] of headers) {
    if (!omitted.has(key.toLowerCase()))
      args.push('-H', quote(value === '' ? `${key};` : `${key}: ${value}`));
  }
  if (
    row.request !== null &&
    row.request !== undefined &&
    row.request !== '[Unparsed body]'
  ) {
    const contentType =
      headers.find(([key]) => key.toLowerCase() === 'content-type')?.[1] ?? '';
    const body =
      contentType.includes('application/x-www-form-urlencoded') &&
      typeof row.request === 'object' &&
      !Array.isArray(row.request)
        ? new URLSearchParams(
            Object.entries(row.request).map(([key, value]) => [
              key,
              String(value),
            ]),
          ).toString()
        : JSON.stringify(row.request);
    if (body !== undefined) args.push('--data-raw', quote(body));
  }
  return args.join(' ');
}
