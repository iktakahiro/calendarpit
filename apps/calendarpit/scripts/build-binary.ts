import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const clientDirectory = resolve(root, 'dist/client');
const serverPath = resolve(root, 'dist/server/server.js');
if (!(await Bun.file(serverPath).exists())) {
  throw new Error('Build the application before compiling the executable.');
}

const files = Array.from(
  new Bun.Glob('**/*').scanSync({ cwd: clientDirectory, onlyFiles: true }),
).sort();
const imports = files.map(
  (path, index) =>
    `import asset${index} from ${JSON.stringify(resolve(clientDirectory, path))} with { type: "file" };`,
);
const entries = files.map(
  (path, index) => `[${JSON.stringify(`/${path}`)}, Bun.file(asset${index})]`,
);
const generatedDirectory = resolve(root, '.calendarpit');
await mkdir(generatedDirectory, { recursive: true });
await mkdir(resolve(root, 'dist/bin'), { recursive: true });
const entrypoint = resolve(generatedDirectory, 'binary.ts');
await Bun.write(
  entrypoint,
  [
    ...imports,

    `import { runCli } from ${JSON.stringify(resolve(root, 'src/cli/runtime.ts'))};`,
    `await runCli(async () => { const server = await import(${JSON.stringify(serverPath)}); return { fetch: server.default.fetch, close: server.close, assets: new Map([${entries.join(',')}]) }; });`,
  ].join('\n'),
);

const outfile = resolve(
  root,
  `dist/bin/calendarpit${process.platform === 'win32' ? '.exe' : ''}`,
);
const result = await Bun.build({
  entrypoints: [entrypoint],
  target: 'bun',
  compile: { outfile },
  minify: true,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
});
if (!result.success)
  throw new AggregateError(result.logs, 'Executable compilation failed.');
console.info(`Built ${outfile} with ${files.length} embedded assets.`);
