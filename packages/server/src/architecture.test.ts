import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

/**
 * Enforces the dependency rules in `packages/server/AGENTS.md`.
 *
 * Imports are read with a regular expression instead of a TypeScript AST so the
 * check needs no dependency. It sees `import type` too, which Bun's transpiler
 * scanner drops; type-only imports still couple modules.
 */
const root = import.meta.dir;
const importPattern =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

type Edge = { from: string; to: string };

function resolveImport(from: string, specifier: string) {
  const base = posix.normalize(posix.join(posix.dirname(from), specifier));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`])
    if (existsSync(join(root, candidate)) && /\.tsx?$/.test(candidate))
      return candidate;
  return `${base}.ts`;
}

function internalEdges(): Edge[] {
  const files = [...new Bun.Glob('**/*.{ts,tsx}').scanSync({ cwd: root })];
  return files
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .flatMap((file) =>
      [...readFileSync(join(root, file), 'utf8').matchAll(importPattern)]
        .map((match) => match[1] ?? match[2] ?? match[3]!)
        .filter((specifier) => specifier.startsWith('.'))
        .map((specifier) => ({
          from: file,
          to: resolveImport(file, specifier),
        })),
    );
}

const top = (path: string) => path.split('/')[0]!;
const feature = (path: string) =>
  top(path) === 'features' ? path.split('/')[1] : undefined;
const isRoutes = (path: string) => path.endsWith('-routes.ts');
const isOperations = (path: string) => path.endsWith('-operations.ts');
const allowedFrom = (from: string, allowed: string[]) => (edge: Edge) =>
  top(edge.from) === from && !allowed.includes(top(edge.to));

const rules: [string, (edge: Edge) => boolean][] = [
  ['shared imports only shared', allowedFrom('shared', ['shared'])],
  ['model imports only model', allowedFrom('model', ['model'])],
  [
    'workspace imports only shared, model, and workspace',
    allowedFrom('workspace', ['shared', 'model', 'workspace']),
  ],
  [
    'http imports only shared, model, workspace, and http',
    allowedFrom('http', ['shared', 'model', 'workspace', 'http']),
  ],
  [
    'only route modules import http',
    (edge) =>
      feature(edge.from) !== undefined &&
      top(edge.to) === 'http' &&
      !isRoutes(edge.from),
  ],
  [
    'rule modules never import workspace',
    (edge) =>
      feature(edge.from) !== undefined &&
      top(edge.to) === 'workspace' &&
      !isRoutes(edge.from) &&
      !isOperations(edge.from),
  ],
  [
    "features never import another feature's routes",
    (edge) =>
      feature(edge.from) !== undefined &&
      feature(edge.to) !== undefined &&
      feature(edge.from) !== feature(edge.to) &&
      isRoutes(edge.to),
  ],
  [
    'production code never imports the package entry point',
    (edge) => edge.to === 'index.ts' && top(edge.from) !== 'testing',
  ],
  [
    'only the entry point and testing helpers import app',
    (edge) =>
      edge.to === 'app.ts' &&
      edge.from !== 'index.ts' &&
      top(edge.from) !== 'testing',
  ],
  [
    'production code never imports testing helpers',
    (edge) => top(edge.to) === 'testing' && top(edge.from) !== 'testing',
  ],
];

describe('server architecture', () => {
  const edges = internalEdges();

  test('finds internal imports', () => {
    expect(edges.length).toBeGreaterThan(0);
  });

  test.each(rules)('%s', (_name, violates) => {
    expect(
      edges
        .filter((edge) => violates(edge))
        .map((edge) => `${edge.from} -> ${edge.to}`),
    ).toEqual([]);
  });

  test.each([
    ['shared/errors.ts', 'workspace/workspace.ts'],
    ['workspace/workspace.ts', 'features/events/event-rules.ts'],
    ['features/events/event-rules.ts', 'workspace/workspace.ts'],
    ['features/events/event-operations.ts', 'http/json.ts'],
    ['features/watch/watch-routes.ts', 'features/oauth/oauth-routes.ts'],
    ['features/events/event-operations.ts', 'testing/server-harness.ts'],
  ])('flags %s -> %s', (from, to) => {
    expect(rules.some(([, violates]) => violates({ from, to }))).toBe(true);
  });

  test('resolves imports relative to the importing file', () => {
    expect(
      resolveImport('features/events/event-routes.ts', '../../http/json'),
    ).toBe('http/json.ts');
  });
});
