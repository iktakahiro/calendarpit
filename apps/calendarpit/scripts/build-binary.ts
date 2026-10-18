import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assetPath } from '../src/cli/asset-path';
import { releasePlatform, releaseTargets } from './release/targets';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--platform')) {
  throw new Error('Usage: build-binary.ts [--platform <os-arch>]');
}
const platform = releasePlatform(
  args[1] ?? `${process.platform}-${process.arch}`,
);

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
  (path, index) =>
    `[${JSON.stringify(assetPath(path))}, Bun.file(asset${index})]`,
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
    '// Load the server after the CLI has applied fixture and database options.',
    `await runCli(async () => { const server = await import(${JSON.stringify(serverPath)}); return { fetch: server.default.fetch, close: server.close, assets: new Map([${entries.join(',')}]) }; });`,
  ].join('\n'),
);

const outfile = resolve(
  root,
  `dist/bin/calendarpit${releaseTargets[platform].os === 'win32' ? '.exe' : ''}`,
);
const result = await Bun.build({
  entrypoints: [entrypoint],
  target: 'bun',
  compile: {
    outfile,
    target: releaseTargets[platform].target,
    autoloadDotenv: false,
    autoloadBunfig: false,
  },
  minify: true,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
});
if (!result.success)
  throw new AggregateError(result.logs, 'Executable compilation failed.');
console.info(`Built ${outfile} with ${files.length} embedded assets.`);
