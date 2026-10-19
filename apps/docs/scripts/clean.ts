import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

// Removed pages and changed asset hashes must not survive a subsequent build.
await rm(resolve(import.meta.dirname, '../dist'), {
  recursive: true,
  force: true,
});
