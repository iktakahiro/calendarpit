import { expect, test } from 'bun:test';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { npmPackageName, packageManifest } from './artifacts';
import { releasePlatform } from './targets';

test('launcher explains missing optional packages and rejects mismatched versions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'calendarpit-launcher-test-'));
  try {
    const launcher = join(directory, 'cli.mjs');
    await copyFile(join(import.meta.dir, 'npm-launcher.mjs'), launcher);
    await Bun.write(
      join(directory, 'package.json'),
      JSON.stringify(packageManifest()),
    );
    async function invoke() {
      const child = Bun.spawn([process.execPath, launcher, '--version'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const error = await new Response(child.stderr).text();
      expect(await child.exited).toBe(1);
      return error;
    }
    expect(await invoke()).toContain('optional dependencies enabled');
    const platform = releasePlatform(`${process.platform}-${process.arch}`);
    const nativeDirectory = join(
      directory,
      'node_modules',
      npmPackageName(platform),
    );
    await mkdir(nativeDirectory, { recursive: true });
    await Bun.write(
      join(nativeDirectory, 'package.json'),
      JSON.stringify({ ...packageManifest(platform), version: '999.0.0' }),
    );
    expect(await invoke()).toContain('found 999.0.0');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
