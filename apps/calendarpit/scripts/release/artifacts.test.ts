import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  archiveName,
  releaseVersion,
  validateVersion,
  verifyReleaseArtifacts,
  releaseArtifactNames,
  sha256,
} from './artifacts';
import { homebrewFormula } from './homebrew';
import { releasePlatform, releaseTargets } from './targets';

test('release tags must match both packages', () => {
  expect(() => validateVersion(`v${releaseVersion}`)).not.toThrow();
  expect(() => validateVersion('v999.0.0')).toThrow('Expected tag');
});

test('Homebrew cannot point to an archive without its checksum', () => {
  expect(() => homebrewFormula(new Map())).toThrow('Missing SHA-256');
  const checksums = new Map(
    Object.keys(releaseTargets).map((key) => [
      archiveName(releasePlatform(key)),
      'a'.repeat(64),
    ]),
  );
  const formula = homebrewFormula(checksums);
  expect(formula).toContain(`releases/download/v${releaseVersion}/`);
  expect(formula.match(/sha256 /g)).toHaveLength(4);
  expect(formula).not.toContain('latest');
});

test('publication rejects incomplete or modified releases before publishing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'calendarpit-release-test-'));
  try {
    const lines: string[] = [];
    for (const name of [...releaseArtifactNames(), 'calendarpit.rb']) {
      await Bun.write(join(directory, name), name);
      lines.push(`${await sha256(join(directory, name))}  ${name}`);
    }
    await Bun.write(join(directory, 'SHA256SUMS'), lines.join('\n') + '\n');
    await verifyReleaseArtifacts(directory);
    await Bun.write(join(directory, archiveName('darwin-arm64')), 'modified');
    await expect(verifyReleaseArtifacts(directory)).rejects.toThrow(
      'Missing or invalid release artifact',
    );
    await Bun.write(join(directory, 'SHA256SUMS'), lines.slice(1).join('\n'));
    await expect(verifyReleaseArtifacts(directory)).rejects.toThrow(
      'unexpected entries',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
