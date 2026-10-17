import type { Workspace } from '../workspace/workspace';

/** Everything a route handler needs about the current request. */
export type RouteContext = {
  workspace: Workspace;
  request: Request;
  url: URL;
  /** The already-read request body. */
  body: string;
};

/**
 * One path pattern and its handler. A handler returns `undefined` when the
 * method does not apply, so the router keeps looking for a later match.
 */
export type Route = {
  pattern: RegExp;
  handle(
    context: RouteContext,
    params: string[],
  ): Response | undefined | Promise<Response | undefined>;
};

/**
 * Runs the first route whose pattern matches and whose handler returns a
 * response. Capture groups are passed URL-decoded; an undefined group stays
 * undefined.
 *
 * @returns The response, or `undefined` when no route produced one.
 * @throws URIError when a path segment has invalid percent-encoding.
 */
export async function dispatch(
  routes: Route[],
  context: RouteContext,
): Promise<Response | undefined> {
  for (const route of routes) {
    const match = route.pattern.exec(context.url.pathname);
    if (!match) continue;
    const params = match
      .slice(1)
      .map((value) =>
        value === undefined ? value : decodeURIComponent(value),
      );
    const response = await route.handle(context, params as string[]);
    if (response) return response;
  }
  return undefined;
}
