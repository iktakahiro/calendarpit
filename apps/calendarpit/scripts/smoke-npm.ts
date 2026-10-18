import assert from 'node:assert/strict';
import { mkdtemp, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  npmArchiveName,
  npmPackageName,
  releaseDirectory,
  releaseVersion,
  repositoryRoot,
  run,
} from './release/artifacts';
import { releasePlatform } from './release/targets';

const platform = releasePlatform(`${process.platform}-${process.arch}`);
const directory = await mkdtemp(join(tmpdir(), 'calendarpit-npm-'));
try {
  await Bun.write(
    join(directory, 'package.json'),
    '{"name":"calendarpit-consumer","private":true}\n',
  );
  await copyFile(
    join(repositoryRoot, 'bunfig.toml'),
    join(directory, 'bunfig.toml'),
  );
  // npm is exercised as a consumer; builds, packaging and the test harness use Bun.
  await run(
    [
      'npm',
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      join(releaseDirectory, 'artifacts', npmArchiveName(platform)),
      join(releaseDirectory, 'artifacts', npmArchiveName()),
    ],
    directory,
  );
  const launcher = join(directory, 'node_modules', npmPackageName(), 'cli.mjs');
  const version = Bun.spawn(['node', launcher, '--version'], {
    cwd: directory,
    stdout: 'pipe',
    stderr: 'inherit',
  });
  assert.equal(
    (await new Response(version.stdout).text()).trim(),
    releaseVersion,
  );
  assert.equal(await version.exited, 0);
  const child = Bun.spawn(['bun', join(import.meta.dir, 'smoke.ts')], {
    env: {
      ...process.env,
      CALENDARPIT_SMOKE_COMMAND: JSON.stringify(['node', launcher]),
    },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  assert.equal(await child.exited, 0);
  console.info(
    'npm tarballs installed offline without lifecycle scripts; Node launcher passed the binary lifecycle smoke suite.',
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
