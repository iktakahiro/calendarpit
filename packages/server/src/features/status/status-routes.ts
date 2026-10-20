import { json } from '../../http/responses';
import type { Route } from '../../http/router';
import type { Workspace } from '../../workspace/workspace';
import { getServerStatus } from './server-status';
import { snapshot } from './snapshot-operations';

/**
 * `GET`/`HEAD /__calendarpit/health`. It is outside the management API
 * guard, so probes need no same-origin or content-type headers.
 */
export const healthRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/health$/,
    handle({ workspace, request }) {
      if (request.method === 'HEAD')
        return new Response(null, { headers: { 'Cache-Control': 'no-store' } });
      if (request.method === 'GET')
        return json(getServerStatus(workspace.storage.mode));
      return new Response(null, {
        status: 405,
        headers: { Allow: 'GET, HEAD' },
      });
    },
  },
];

/**
 * Keep-alive interval for the change stream. It stays below Bun's default
 * 10-second idle timeout, which would otherwise end a quiet stream.
 */
const heartbeatMs = 5000;

/** How long a disconnected `EventSource` waits before it reconnects. */
const reconnectMs = 1000;

/**
 * Opens a Server-Sent Events stream that emits `change` whenever the saved
 * workspace changes. Events carry no state, so a client refetches what it
 * shows. The stream ends when the workspace closes.
 */
function changeStream(workspace: Workspace): Response {
  const encoder = new TextEncoder();
  let stop = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      const heartbeat = setInterval(() => send(': ping\n\n'), heartbeatMs);
      let unsubscribe = () => {};
      stop = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      // Sending a field at once flushes the headers, so `open` fires promptly.
      send(`retry: ${reconnectMs}\n\n`);
      unsubscribe = workspace.subscribe((signal) => {
        if (signal === 'change') return send('event: change\ndata: {}\n\n');
        stop();
        controller.close();
      });
    },
    cancel() {
      stop();
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * `GET /__calendarpit/state`, the admin UI's data source, and
 * `GET /__calendarpit/changes`, the Server-Sent Events stream that tells the
 * admin UI when to read it again.
 */
export const statusManagementRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/state$/,
    handle({ workspace, request }) {
      if (request.method === 'GET') return json(snapshot(workspace));
    },
  },
  {
    pattern: /^\/__calendarpit\/changes$/,
    handle({ workspace, request }) {
      if (request.method === 'GET') return changeStream(workspace);
    },
  },
];
