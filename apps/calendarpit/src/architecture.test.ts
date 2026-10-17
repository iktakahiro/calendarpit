import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

/**
 * Enforces the dependency rules in `apps/calendarpit/AGENTS.md`.
 *
 * Imports are read with a regular expression instead of a TypeScript AST so the
 * check needs no dependency. It also sees `import type`, which still couples
 * modules even though it disappears at runtime.
 */
const root = import.meta.dir;
const importPattern =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

/** An import from one source file. `to` is a `src`-relative path or a package. */
type Edge = { from: string; to: string };

function resolveImport(from: string, specifier: string) {
  if (!specifier.startsWith('.')) return specifier;
  const base = posix.normalize(posix.join(posix.dirname(from), specifier));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`])
    if (existsSync(join(root, candidate)) && /\.tsx?$/.test(candidate))
      return candidate;
  return `${base}.ts`;
}

function sourceEdges(): Edge[] {
  const files = [...new Bun.Glob('**/*.{ts,tsx}').scanSync({ cwd: root })];
  return files
    .filter((file) => !/\.test\.tsx?$/.test(file) && !file.endsWith('.gen.ts'))
    .flatMap((file) =>
      [...readFileSync(join(root, file), 'utf8').matchAll(importPattern)].map(
        (match) => ({
          from: file,
          to: resolveImport(file, match[1] ?? match[2] ?? match[3]!),
        }),
      ),
    );
}

const top = (path: string) => path.split('/')[0]!;
const feature = (path: string) =>
  top(path) === 'features' ? path.split('/')[1] : undefined;
const isModel = (path: string) => path.split('/')[2] === 'models';
const isReact = (specifier: string) =>
  /^(react|react-dom)(\/|$)|^@tanstack\/react-|^@cloudflare\/kumo/.test(
    specifier,
  );

const rules: [string, (edge: Edge) => boolean][] = [
  [
    'features never import routes',
    (edge) => feature(edge.from) !== undefined && top(edge.to) === 'routes',
  ],
  [
    'shared components and lib never import features or routes',
    (edge) =>
      ['components', 'lib'].includes(top(edge.from)) &&
      ['features', 'routes'].includes(top(edge.to)),
  ],
  [
    'models stay free of React, hooks, components, and the API client',
    (edge) =>
      feature(edge.from) !== undefined &&
      isModel(edge.from) &&
      (isReact(edge.to) ||
        /\/(hooks|components)\//.test(edge.to) ||
        edge.to.startsWith('lib/management-client')),
  ],
  [
    'the CLI never imports UI modules',
    (edge) =>
      top(edge.from) === 'cli' &&
      (['routes', 'features', 'components'].includes(top(edge.to)) ||
        isReact(edge.to)),
  ],
];

/** Returns the features that reach themselves through feature-to-feature imports. */
function featureCycles(edges: Edge[]) {
  const graph = new Map<string, Set<string>>();
  for (const edge of edges) {
    const from = feature(edge.from);
    const to = feature(edge.to);
    if (!from || !to || from === to) continue;
    graph.set(from, (graph.get(from) ?? new Set()).add(to));
  }
  const reaches = (start: string, target: string) => {
    const seen = new Set<string>();
    const queue = [...(graph.get(start) ?? [])];
    while (queue.length) {
      const next = queue.shift()!;
      if (next === target) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(...(graph.get(next) ?? []));
    }
    return false;
  };
  return [...graph.keys()].filter((name) => reaches(name, name)).sort();
}

describe('app architecture', () => {
  const edges = sourceEdges();

  test('finds imports', () => {
    expect(edges.length).toBeGreaterThan(0);
  });

  test.each(rules)('%s', (_name, violates) => {
    expect(
      edges
        .filter((edge) => violates(edge))
        .map((edge) => `${edge.from} -> ${edge.to}`),
    ).toEqual([]);
  });

  test('features import each other one way', () => {
    expect(featureCycles(edges)).toEqual([]);
  });

  test.each([
    ['features/schedule/schedule-screen.tsx', 'routes/schedule.tsx'],
    ['lib/query-client.ts', 'features/workspace/hooks/use-snapshot.ts'],
    ['features/schedule/models/day-layout.ts', 'react'],
    ['features/schedule/models/day-layout.ts', 'lib/management-client.ts'],
    ['cli/runtime.ts', 'components/icon.tsx'],
  ])('flags %s -> %s', (from, to) => {
    expect(rules.some(([, violates]) => violates({ from, to }))).toBe(true);
  });

  test('detects feature cycles', () => {
    expect(
      featureCycles([
        { from: 'features/a/x.ts', to: 'features/b/y.ts' },
        { from: 'features/b/y.ts', to: 'features/a/x.ts' },
      ]),
    ).toEqual(['a', 'b']);
  });
});
