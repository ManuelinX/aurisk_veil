import path from 'node:path';
import { toPosix } from '../utils/path.js';

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function simpleGlobToRegex(pattern: string): RegExp {
  const posix = toPosix(pattern);
  let regex = '';
  for (let i = 0; i < posix.length; i++) {
    const char = posix[i];
    const next = posix[i + 1];
    if (char === '*' && next === '*') {
      regex += '.*';
      i++;
    } else if (char === '*') {
      regex += '[^/]*';
    } else {
      regex += escapeRegex(char);
    }
  }
  return new RegExp(`^${regex}$`);
}

export function matchesAnyPattern(relPath: string, patterns: string[]): boolean {
  const normalized = toPosix(relPath);
  const base = path.posix.basename(normalized);

  return patterns.some((rawPattern) => {
    const pattern = toPosix(rawPattern);
    if (pattern === normalized || pattern === base) return true;
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      return normalized === prefix.slice(0, -1) || normalized.startsWith(prefix);
    }
    if (pattern.startsWith('*.')) return base.endsWith(pattern.slice(1));
    if (pattern.includes('*')) return simpleGlobToRegex(pattern).test(normalized);
    return false;
  });
}

export function shouldPreserveFileName(relPath: string, preserveEntryFiles: string[], preservePatterns: string[]): boolean {
  const normalized = toPosix(relPath);
  const base = path.posix.basename(normalized);
  if (preserveEntryFiles.some((item) => item === normalized || item === base)) return true;
  return matchesAnyPattern(normalized, preservePatterns);
}

export function shouldPreserveDirName(relPath: string, preservePatterns: string[]): boolean {
  return matchesAnyPattern(relPath, preservePatterns);
}
