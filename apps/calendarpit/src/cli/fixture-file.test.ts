import { afterAll, expect, test } from 'bun:test';
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFixtureFile } from './fixture-file';

const directory = await mkdtemp(join(tmpdir(), 'calendarpit-fixture-'));
afterAll(() => rm(directory, { recursive: true, force: true }));

test('parses a JSON fixture file', async () => {
  const path = join(directory, 'fixture.json');
  await Bun.write(path, '{"users": []}');
  expect(await readFixtureFile(path)).toEqual({ users: [] });
});

test('explains a directory left by an unshared bind mount', async () => {
  const path = join(directory, 'startup.json');
  await mkdir(path);
  const error = readFixtureFile(path);
  await expect(error).rejects.toThrow(
    `Fixture path is a directory, not a file: ${path}`,
  );
  await expect(error).rejects.toThrow('colima.yaml');
  await expect(error).rejects.toThrow('docker cp');
});

test.each([
  ['missing.json', null, 'Fixture file not found: '],
  ['broken.json', '{"users": [', 'Fixture file is not valid JSON: '],
])('names the path when %s cannot be used', async (name, content, message) => {
  const path = join(directory, name);
  if (content !== null) await Bun.write(path, content);
  await expect(readFixtureFile(path)).rejects.toThrow(`${message}${path}`);
});

test.skipIf(process.getuid?.() === 0)(
  'names the path of an unreadable file',
  async () => {
    const path = join(directory, 'private.json');
    await Bun.write(path, '{}');
    await chmod(path, 0o000);
    await expect(readFixtureFile(path)).rejects.toThrow(
      `Fixture file is not readable: ${path}`,
    );
  },
);
