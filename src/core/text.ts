import type { AuriskConfig } from '../types.js';

const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx']);
const CSS_EXTENSIONS = new Set(['.css']);
const HTML_EXTENSIONS = new Set(['.html', '.htm']);
const JSON_EXTENSIONS = new Set(['.json']);
const WEBMANIFEST_EXTENSIONS = new Set(['.webmanifest']);

export function isTextFile(extension: string, config: AuriskConfig): boolean {
  if (config.rewrite.js && JS_EXTENSIONS.has(extension)) return true;
  if (config.rewrite.css && CSS_EXTENSIONS.has(extension)) return true;
  if (config.rewrite.html && HTML_EXTENSIONS.has(extension)) return true;
  if (config.rewrite.json && JSON_EXTENSIONS.has(extension)) return true;
  if (config.rewrite.webmanifest && WEBMANIFEST_EXTENSIONS.has(extension)) return true;
  return false;
}

export function textKind(extension: string): 'js' | 'css' | 'html' | 'json' | 'webmanifest' | 'text' {
  if (JS_EXTENSIONS.has(extension)) return 'js';
  if (CSS_EXTENSIONS.has(extension)) return 'css';
  if (HTML_EXTENSIONS.has(extension)) return 'html';
  if (JSON_EXTENSIONS.has(extension)) return 'json';
  if (WEBMANIFEST_EXTENSIONS.has(extension)) return 'webmanifest';
  return 'text';
}
