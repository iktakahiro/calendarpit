import { chmod, copyFile, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  archiveName,
  releaseDirectory,
  releaseVersion,
  repositoryRoot,
  run,
  validateVersion,
} from './release/artifacts';
import { releasePlatform, releaseTargets } from './release/targets';

validateVersion(process.env.RELEASE_TAG);
const platform = releasePlatform(
  process.argv[2] ?? `${process.platform}-${process.arch}`,
);
const name = `calendarpit-${platform}`;
const directory = join(releaseDirectory, 'packages', name);
const executable =
  releaseTargets[platform].os === 'win32' ? 'calendarpit.exe' : 'calendarpit';
await rm(directory, { recursive: true, force: true });
await mkdir(join(directory, 'bin'), { recursive: true });
await mkdir(join(releaseDirectory, 'artifacts'), { recursive: true });
await copyFile(
  resolve(import.meta.dir, '../dist/bin', executable),
  join(directory, 'bin', executable),
);
await chmod(join(directory, 'bin', executable), 0o755);
await copyFile(join(repositoryRoot, 'LICENSE'), join(directory, 'LICENSE'));
await Bun.write(
  join(directory, 'README.md'),
  `# Calendarpit ${releaseVersion}

Run bin/${executable} serve to start the local API, OAuth server, and admin UI.
No separate Bun or Node.js runtime is required.
See https://github.com/iktakahiro/calendarpit for documentation.
`,
);
await run([
  'tar',
  '-czf',
  join(releaseDirectory, 'artifacts', archiveName(platform)),
  '-C',
  directory,
  'bin',
  'LICENSE',
  'README.md',
]);
