#!/usr/bin/env bun
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli, type Application } from '../src/cli/runtime';

await runCli(async () => {
  const directory = resolve(import.meta.dir, '../dist');
  const serverPath = resolve(directory, 'server/server.js');
  if (!(await Bun.file(serverPath).exists())) {
    throw new Error('Build the application first with "bun run build".');
  }

  const { default: server, close } = (await import(
    pathToFileURL(serverPath).href
  )) as {
    default: Pick<Application, 'fetch'>;
    close: () => void;
  };
  const assets = new Map<string, ReturnType<typeof Bun.file>>();
  const clientDirectory = resolve(directory, 'client');
  for await (const path of new Bun.Glob('**/*').scan({
    cwd: clientDirectory,
    onlyFiles: true,
  })) {
    assets.set(`/${path}`, Bun.file(resolve(clientDirectory, path)));
  }
  return { fetch: server.fetch, assets, close };
});
