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
/** Version shared by the CLI, npm packages, archives, image tags, and formula. */
export const releaseVersion = serverMetadata.version;
/** npm scope owned by the project's maintainer. */
export const npmScope = '@iktakahiro';

/** Scoped npm name for the launcher or one native executable. */
export function npmPackageName(platform?: ReleasePlatform) {
  return `${npmScope}/calendarpit${platform ? `-${platform}` : ''}`;
}

/** npm's archive filename for a scoped release package. */
export function npmArchiveName(platform?: ReleasePlatform) {
  return `${npmPackageName(platform).replace('@', '').replace('/', '-')}-${releaseVersion}.tgz`;
}
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

/** Produces an exact-version npm manifest for a launcher or native package. */
export function packageManifest(platform?: ReleasePlatform) {
  const common = {
    name: npmPackageName(platform),
    version: releaseVersion,
    description:
      'A local Google Calendar-compatible service for development and repeatable tests.',
    license: 'MIT',
    homepage: 'https://iktakahiro.github.io/calendarpit/',
    repository: {
      type: 'git',
      url: 'git+https://github.com/iktakahiro/calendarpit.git',
    },
    bugs: { url: 'https://github.com/iktakahiro/calendarpit/issues' },
    publishConfig: { access: 'public' },
  };
  if (platform) {
    const { os, cpu } = releaseTargets[platform];
    return {
      ...common,
      os: [os],
      cpu: [cpu],
      ...(os === 'linux' ? { libc: ['glibc'] } : {}),
      files: ['bin', 'LICENSE', 'README.md'],
    };
  }
  return {
    ...common,
    type: 'module',
    engines: { node: '>=22' },
    bin: { calendarpit: 'cli.mjs' },
    files: ['cli.mjs', 'LICENSE', 'README.md'],
    optionalDependencies: Object.fromEntries(
      Object.keys(releaseTargets).map((key) => [
        npmPackageName(key as ReleasePlatform),
        releaseVersion,
      ]),
    ),
  };
}

/** Returns the filename of a standalone release archive, including its version. */
export function archiveName(platform: ReleasePlatform) {
  return `calendarpit-${releaseVersion}-${platform}.tar.gz`;
}

/** Complete allowlist of versioned archives and npm tarballs for publication. */
export function releaseArtifactNames() {
  return [
    npmArchiveName(),
    ...Object.keys(releaseTargets).flatMap((key) => {
      const platform = releasePlatform(key);
      return [archiveName(platform), npmArchiveName(platform)];
    }),
  ];
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
