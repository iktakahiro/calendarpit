import { json, noContent } from '../../http/responses';
import type { Route } from '../../http/router';
import { recordLimit, type Workspace } from '../../workspace/workspace';
import { redact, redactHeaders, safeUrl } from './redaction';

/**
 * Records one Calendar or OAuth exchange in the protocol history, with
 * secrets redacted. Consent HTML is replaced by a placeholder, and only the
 * latest 200 records are kept.
 *
 * @param body - The request body that was already read.
 */
export async function recordExchange(
  workspace: Workspace,
  request: Request,
  url: URL,
  body: string,
  response: Response,
) {
  let requestBody: unknown = body ? '[Unparsed body]' : null;
  try {
    requestBody = JSON.parse(body);
  } catch {
    if (request.headers.get('content-type')?.includes('form-urlencoded'))
      requestBody = Object.fromEntries(new URLSearchParams(body));
  }
  let responseBody: unknown = null;
  if (response.headers.get('content-type')?.includes('json'))
    responseBody = await response.clone().json();
  else if (response.headers.get('content-type')?.includes('html'))
    responseBody = '[Consent HTML]';
  workspace.history.push({
    id: crypto.randomUUID(),
    time: new Date(workspace.now()).toISOString(),
    method: request.method,
    path: safeUrl(url.pathname + url.search),
    status: response.status,
    request: redact(requestBody),
    response: redact(responseBody),
    headers: redactHeaders(request.headers),
    responseHeaders: redactHeaders(response.headers),
  });
  workspace.history = workspace.history.slice(-recordLimit);
}

/** Management API endpoints that read and clear the protocol history. */
export const historyManagementRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/history$/,
    handle({ workspace, request }) {
      if (request.method === 'GET') return json(workspace.history);
      if (request.method === 'DELETE') {
        workspace.history = [];
        return noContent();
      }
    },
  },
];
