import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Where the fixture troubleshooting steps live. */
const troubleshooting =
  'See https://calendarpit.dev/troubleshooting/#fixture-path-is-a-directory';

/**
 * Reads and parses the startup fixture named by `--config` or
 * `CALENDARPIT_CONFIG`. Fixture validation happens later, in the server.
 *
 * Errors name the resolved path. A directory gets its own message because
 * a container bind mount produces one when the container runtime cannot see
 * the host file, such as a path outside Colima's shared directories.
 *
 * @param path - The configured path, resolved from the working directory.
 * @returns The parsed JSON value.
 * @throws Error when the file is missing, is a directory, cannot be read, or
 * is not valid JSON.
 */
export async function readFixtureFile(path: string): Promise<unknown> {
  const absolute = resolve(path);
  let text: string;
  try {
    text = await readFile(absolute, 'utf8');
  } catch (error) {
    throw new Error(describeReadError(absolute, error), { cause: error });
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Fixture file is not valid JSON: ${absolute} (${reason})`, {
      cause: error,
    });
  }
}

/** Turns a file system error into a message that names the fixture path. */
function describeReadError(path: string, error: unknown) {
  const code =
    error instanceof Error && 'code' in error ? String(error.code) : undefined;
  if (code === 'EISDIR')
    return [
      `Fixture path is a directory, not a file: ${path}`,
      'In a container, this usually means the bind mount source was not shared with the container runtime, so an empty directory was mounted instead.',
      'Share the host directory (for Colima, add it to "mounts" in colima.yaml), or copy the file into the container with "docker cp".',
      troubleshooting,
    ].join('\n');
  if (code === 'ENOENT')
    return `Fixture file not found: ${path}. Relative paths resolve from the working directory; in a container, use the path inside the container.`;
  if (code === 'EACCES')
    return `Fixture file is not readable: ${path}. In a container, the file must be readable by the non-root "bun" user.`;
  const reason = error instanceof Error ? error.message : String(error);
  return `Cannot read fixture file: ${path} (${reason})`;
}
