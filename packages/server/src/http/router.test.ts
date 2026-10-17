import { expect, test } from 'bun:test';
import type { Workspace } from '../workspace/workspace';
import { dispatch, type Route, type RouteContext } from './router';

const context = (path: string): RouteContext => ({
  workspace: {} as Workspace,
  request: new Request(`http://local${path}`),
  url: new URL(`http://local${path}`),
  body: '',
});

test('passes decoded captures and keeps missing groups undefined', async () => {
  const seen: (string | undefined)[][] = [];
  const routes: Route[] = [
    {
      pattern: /^\/items\/([^/]+)(?:\/([^/]+))?$/,
      handle: (_context, params) => {
        seen.push(params);
        return new Response('ok');
      },
    },
  ];
  await dispatch(routes, context('/items/a%2Fb'));
  expect(seen).toEqual([['a/b', undefined]]);
});

test('falls through when a handler returns undefined', async () => {
  const routes: Route[] = [
    { pattern: /^\/x$/, handle: () => undefined },
    { pattern: /^\/x$/, handle: () => new Response('second') },
  ];
  expect(await (await dispatch(routes, context('/x')))!.text()).toBe('second');
  expect(await dispatch(routes, context('/y'))).toBeUndefined();
});

test('surfaces malformed percent-encoding as a URIError', async () => {
  const routes: Route[] = [
    { pattern: /^\/([^/]+)$/, handle: () => new Response('') },
  ];
  await expect(dispatch(routes, context('/%E0%A4%A'))).rejects.toBeInstanceOf(
    URIError,
  );
});
