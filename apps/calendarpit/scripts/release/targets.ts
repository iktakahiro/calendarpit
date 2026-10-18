/** Supported release platforms. Linux executables require glibc, not musl. */
export const releaseTargets = {
  'darwin-arm64': { os: 'darwin', cpu: 'arm64', target: 'bun-darwin-arm64' },
  'darwin-x64': { os: 'darwin', cpu: 'x64', target: 'bun-darwin-x64-baseline' },
  'linux-arm64': { os: 'linux', cpu: 'arm64', target: 'bun-linux-arm64' },
  'linux-x64': { os: 'linux', cpu: 'x64', target: 'bun-linux-x64-baseline' },
  'win32-x64': { os: 'win32', cpu: 'x64', target: 'bun-windows-x64-baseline' },
} as const;

/** An OS/CPU combination with a published standalone executable. */
export type ReleasePlatform = keyof typeof releaseTargets;

/** Validates a release platform, rejecting unsupported OS/CPU combinations. */
export function releasePlatform(value: string): ReleasePlatform {
  if (!Object.hasOwn(releaseTargets, value)) {
    throw new Error(
      `Unsupported platform: ${value}. Expected ${Object.keys(releaseTargets).join(', ')}.`,
    );
  }
  return value as ReleasePlatform;
}
