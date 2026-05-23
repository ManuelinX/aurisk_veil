import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../types.js';
import { normalizeRel, toPosix } from '../utils/path.js';

const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.aurisk',
  '.next/cache',
]);

export async function scanTree(rootAbs: string): Promise<{ files: FileEntry[]; dirs: FileEntry[] }> {
  const files: FileEntry[] = [];
  const dirs: FileEntry[] = [];

  async function walk(currentAbs: string): Promise<void> {
    const entries = await fs.readdir(currentAbs, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = path.join(currentAbs, entry.name);
      const relPath = normalizeRel(toPosix(path.relative(rootAbs, absPath)));
      if (!relPath) continue;

      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(relPath) || DEFAULT_IGNORED_DIRS.has(entry.name)) continue;
        const stats = await fs.stat(absPath);
        dirs.push({ absPath, relPath, kind: 'dir', extension: '', sizeBytes: stats.size });
        await walk(absPath);
      } else if (entry.isFile()) {
        const stats = await fs.stat(absPath);
        files.push({
          absPath,
          relPath,
          kind: 'file',
          extension: path.posix.extname(relPath).toLowerCase(),
          sizeBytes: stats.size,
        });
      }
    }
  }

  await walk(rootAbs);

  dirs.sort((a, b) => a.relPath.split('/').length - b.relPath.split('/').length);
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));

  return { files, dirs };
}
