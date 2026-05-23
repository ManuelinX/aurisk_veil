import path from 'node:path';

export function toPosix(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
}

export function normalizeRel(value: string): string {
  const normalized = path.posix.normalize(toPosix(value));
  return normalized === '.' ? '' : normalized.replace(/^\.\//, '');
}

export function dirname(relPath: string): string {
  const dir = path.posix.dirname(relPath);
  return dir === '.' ? '' : dir;
}

export function joinRel(...parts: string[]): string {
  return normalizeRel(path.posix.join(...parts.filter(Boolean)));
}

export function relFrom(fromDir: string, toFile: string): string {
  let out = path.posix.relative(fromDir || '.', toFile);
  if (!out.startsWith('.') && !out.startsWith('/')) out = `./${out}`;
  return toPosix(out);
}

export function stripLeadingSlash(value: string): string {
  return value.replace(/^\/+/, '');
}

export function splitUrlSuffix(ref: string): { cleanPath: string; suffix: string } {
  const queryIndex = ref.search(/[?#]/);
  if (queryIndex === -1) return { cleanPath: ref, suffix: '' };
  return { cleanPath: ref.slice(0, queryIndex), suffix: ref.slice(queryIndex) };
}
