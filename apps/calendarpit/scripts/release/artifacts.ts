import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import appMetadata from '../../package.json';
import serverMetadata from '../../../../packages/server/package.json';
import {
  releasePlatform,
  releaseTargets,
  type ReleasePlatform,
} from './targets';

/** Repository root used to read license and release inputs. */
export const repositoryRoot = resolve(import.meta.dir, '../../../..');
/** Version shared by the CLI, archives, image tags, and formula. */
export const releaseVersion = serverMetadata.version;
/** Generated release output; never committed or used as a source workspace. */
export const releaseDirectory = resolve(import.meta.dir, '../../dist/release');

/** Rejects divergent package versions and optional mismatched Git tags. */
export function validateVersion(tag?: string) {
  if (
    !/^\d+\.\d+\.\d+$/.test(releaseVersion) ||
    appMetadata.version !== releaseVersion
  ) {
    throw new Error(
      'App and server must have the same stable numeric release version.',
    );
  }
  if (tag && tag !== `v${releaseVersion}`)
    throw new Error(`Expected tag v${releaseVersion}, received ${tag}.`);
}

/** Returns the filename of a standalone release archive, including its version. */
export function archiveName(platform: ReleasePlatform) {
  return `calendarpit-${releaseVersion}-${platform}.tar.gz`;
}

/** Complete allowlist of versioned standalone archives for publication. */
export function releaseArtifactNames() {
  return Object.keys(releaseTargets).map((key) =>
    archiveName(releasePlatform(key)),
  );
}

/** Verifies a complete release before any irreversible registry publication. */
export async function verifyReleaseArtifacts(directory: string) {
  const checksums = new Map<string, string>();
  for (const line of (await Bun.file(join(directory, 'SHA256SUMS')).text())
    .trim()
    .split('\n')) {
    const match = /^([a-f0-9]{64})  ([a-zA-Z0-9.-]+)$/.exec(line);
    if (!match || checksums.has(match[2]!))
      throw new Error('Invalid or duplicate release checksum.');
    checksums.set(match[2]!, match[1]!);
  }
  const names = [...releaseArtifactNames(), 'calendarpit.rb'];
  if (checksums.size !== names.length)
    throw new Error('Release checksum manifest has unexpected entries.');
  for (const name of names) {
    const file = join(directory, name);
    if (
      !checksums.has(name) ||
      !(await Bun.file(file).exists()) ||
      (await sha256(file)) !== checksums.get(name)
    ) {
      throw new Error(`Missing or invalid release artifact: ${name}`);
    }
  }
}

/** Hashes a release file for its checksum manifest and Homebrew formula. */
export async function sha256(path: string) {
  return createHash('sha256')
    .update(new Uint8Array(await Bun.file(path).arrayBuffer()))
    .digest('hex');
}

/** Runs a packaging command, aborting on failure instead of publishing partial output. */
export async function run(command: string[], cwd = repositoryRoot) {
  const child = Bun.spawn(command, {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if ((await child.exited) !== 0)
    throw new Error(`Command failed: ${command.join(' ')}`);
}
