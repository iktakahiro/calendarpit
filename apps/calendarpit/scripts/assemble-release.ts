import { chmod, copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  archiveName,
  npmArchiveName,
  packageManifest,
  releaseDirectory,
  releaseArtifactNames,
  repositoryRoot,
  run,
  sha256,
  validateVersion,
} from './release/artifacts';
import { homebrewFormula } from './release/homebrew';
import { releasePlatform, releaseTargets } from './release/targets';

validateVersion(process.env.RELEASE_TAG);
const artifacts = join(releaseDirectory, 'artifacts');
const local = process.argv.includes('--local');
if (!local) {
  for (const key of Object.keys(releaseTargets)) {
    const platform = releasePlatform(key);
    for (const name of [archiveName(platform), npmArchiveName(platform)]) {
      if (!(await Bun.file(join(artifacts, name)).exists()))
        throw new Error(`Missing release artifact: ${name}`);
    }
  }
}
const directory = join(releaseDirectory, 'packages/calendarpit');
await rm(directory, { recursive: true, force: true });
await mkdir(directory, { recursive: true });
await mkdir(artifacts, { recursive: true });
await Bun.write(
  join(directory, 'package.json'),
  JSON.stringify(packageManifest(), null, 2) + '\n',
);
await copyFile(
  join(import.meta.dir, 'release/npm-launcher.mjs'),
  join(directory, 'cli.mjs'),
);
await chmod(join(directory, 'cli.mjs'), 0o755);
await copyFile(join(repositoryRoot, 'LICENSE'), join(directory, 'LICENSE'));
await copyFile(
  join(import.meta.dir, 'release/npm-readme.md'),
  join(directory, 'README.md'),
);
await run(['bun', 'pm', 'pack', '--destination', artifacts], directory);
const checksums = new Map<string, string>();
const allowed = new Set(releaseArtifactNames());
for (const name of (await readdir(artifacts)).sort()) {
  if (
    !allowed.has(name) &&
    name !== 'calendarpit.rb' &&
    name !== 'SHA256SUMS'
  ) {
    throw new Error(
      `Unexpected release artifact: ${name}. Use a clean output directory.`,
    );
  }
  if (name.endsWith('.tgz') || name.endsWith('.tar.gz'))
    checksums.set(name, await sha256(join(artifacts, name)));
}
if (!local) {
  await Bun.write(
    join(artifacts, 'calendarpit.rb'),
    homebrewFormula(checksums),
  );
  checksums.set(
    'calendarpit.rb',
    await sha256(join(artifacts, 'calendarpit.rb')),
  );
}
await Bun.write(
  join(artifacts, 'SHA256SUMS'),
  [...checksums].map(([name, hash]) => `${hash}  ${name}\n`).join(''),
);
