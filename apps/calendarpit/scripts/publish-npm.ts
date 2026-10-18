import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  npmArchiveName,
  npmPackageName,
  releaseDirectory,
  releaseVersion,
  run,
  validateVersion,
  verifyReleaseArtifacts,
} from './release/artifacts';
import { releasePlatform, releaseTargets } from './release/targets';

validateVersion(process.env.RELEASE_TAG);
await verifyReleaseArtifacts(join(releaseDirectory, 'artifacts'));
// npm's OIDC authentication is used only for publication; all build work uses Bun.
for (const platform of [
  ...Object.keys(releaseTargets).map(releasePlatform),
  undefined,
]) {
  const name = npmPackageName(platform);
  const tarball = join(releaseDirectory, 'artifacts', npmArchiveName(platform));
  const file = Bun.file(tarball);
  if (!(await file.exists())) throw new Error(`Missing package ${tarball}`);
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/${releaseVersion}`,
  );
  if (response.ok) {
    const metadata: unknown = await response.json();
    const integrity = `sha512-${createHash('sha512')
      .update(new Uint8Array(await file.arrayBuffer()))
      .digest('base64')}`;
    if (
      typeof metadata !== 'object' ||
      metadata === null ||
      !('dist' in metadata) ||
      typeof metadata.dist !== 'object' ||
      metadata.dist === null ||
      !('integrity' in metadata.dist) ||
      metadata.dist.integrity !== integrity
    ) {
      throw new Error(
        `${name}@${releaseVersion} already exists with different contents. Do not overwrite releases.`,
      );
    }
    console.info(`Already published identical ${name}@${releaseVersion}`);
    continue;
  }
  if (response.status !== 404)
    throw new Error(`Registry lookup failed: ${response.status}`);
  await run([
    'npm',
    'publish',
    tarball,
    '--access',
    'public',
    ...(process.env.GITHUB_ACTIONS ? ['--provenance'] : []),
  ]);
}
