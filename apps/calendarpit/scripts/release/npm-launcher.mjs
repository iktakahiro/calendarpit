#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
try {
  const platform = `${process.platform}-${process.arch}`;
  const metadata = JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
  );
  const name = `${metadata.name}-${platform}`;
  if (!metadata.optionalDependencies[name]) {
    throw new Error(
      `Unsupported platform: ${platform}. Use the Docker image instead.`,
    );
  }
  if (
    process.platform === 'linux' &&
    !process.report.getReport().header.glibcVersionRuntime
  ) {
    throw new Error(
      'The Linux executable requires glibc. Use the Docker image on Alpine/musl.',
    );
  }
  let packagePath;
  try {
    packagePath = require.resolve(`${name}/package.json`);
  } catch {
    throw new Error(
      `Missing ${name}@${metadata.version}. Reinstall calendarpit with optional dependencies enabled; do not use --omit=optional.`,
    );
  }
  const installed = JSON.parse(readFileSync(packagePath, 'utf8'));
  if (installed.version !== metadata.version) {
    throw new Error(
      `Expected ${name}@${metadata.version}, found ${installed.version}. Reinstall calendarpit.`,
    );
  }
  const executable = join(
    dirname(packagePath),
    'bin',
    process.platform === 'win32' ? 'calendarpit.exe' : 'calendarpit',
  );
  const child = spawn(executable, process.argv.slice(2), { stdio: 'inherit' });
  const interrupt = () => child.kill('SIGINT');
  const terminate = () => child.kill('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  const cleanup = () => {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  };
  child.on('error', (error) => {
    cleanup();
    console.error(`Calendarpit: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    cleanup();
    process.exitCode =
      code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1);
  });
} catch (error) {
  console.error(
    `Calendarpit: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
