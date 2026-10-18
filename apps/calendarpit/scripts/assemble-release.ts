import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  archiveName,
  releaseDirectory,
  releaseArtifactNames,
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
    for (const name of [archiveName(platform)]) {
      if (!(await Bun.file(join(artifacts, name)).exists()))
        throw new Error(`Missing release artifact: ${name}`);
    }
  }
}
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
  if (name.endsWith('.tar.gz'))
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
