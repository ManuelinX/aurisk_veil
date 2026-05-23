import path from 'node:path';
import type { AuriskConfig, RewriteWarning, VeilPlan } from '../types.js';
import { dirname, normalizeRel, relFrom, splitUrlSuffix, stripLeadingSlash, toPosix } from '../utils/path.js';
import { textKind } from './text.js';

interface RewriteContext {
  config: AuriskConfig;
  plan: VeilPlan;
  fileSet: Set<string>;
  warnings: RewriteWarning[];
  rewritten: number;
}

const COMMON_EXTENSIONS = [
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  '.css', '.html', '.htm', '.json', '.webmanifest',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.otf',
  '.mp3', '.wav', '.ogg', '.mp4', '.webm',
  '.wasm', '.txt', '.xml', '.pdf',
];

function hasKnownExtension(value: string): boolean {
  return COMMON_EXTENSIONS.includes(path.posix.extname(value).toLowerCase());
}

function isExternalOrSpecial(ref: string): boolean {
  const trimmed = ref.trim();
  if (!trimmed || trimmed.startsWith('#')) return true;
  return /^(https?:|data:|blob:|mailto:|tel:|javascript:|chrome:|about:)/i.test(trimmed) || trimmed.startsWith('//');
}

function shouldIgnorePrefix(cleanPath: string, config: AuriskConfig): boolean {
  return config.rewrite.ignorePrefixes.some((prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`));
}

function aliasMatch(cleanPath: string, aliases: Record<string, string>): { alias: string; targetRoot: string } | null {
  const keys = Object.keys(aliases).sort((a, b) => b.length - a.length);
  for (const alias of keys) {
    if (cleanPath === alias || cleanPath.startsWith(`${alias}/`)) {
      return { alias, targetRoot: aliases[alias] };
    }
  }
  return null;
}

function resolveCandidate(baseRel: string, fileSet: Set<string>): string | null {
  const normalized = normalizeRel(baseRel);
  if (fileSet.has(normalized)) return normalized;

  if (!path.posix.extname(normalized)) {
    for (const ext of COMMON_EXTENSIONS) {
      const candidate = `${normalized}${ext}`;
      if (fileSet.has(candidate)) return candidate;
    }
    const indexCandidate = path.posix.join(normalized, 'index.html');
    if (fileSet.has(indexCandidate)) return indexCandidate;
  }

  return null;
}

function resolveReference(ref: string, currentOldRel: string, ctx: RewriteContext): { targetOldRel: string; suffix: string } | null {
  if (isExternalOrSpecial(ref)) return null;

  const { cleanPath, suffix } = splitUrlSuffix(toPosix(ref));
  if (!cleanPath || shouldIgnorePrefix(cleanPath, ctx.config)) return null;

  let candidateBase: string | null = null;

  if (cleanPath.startsWith('/')) {
    const rel = stripLeadingSlash(cleanPath);
    if (!hasKnownExtension(rel) && !ctx.fileSet.has(rel)) return null;
    candidateBase = rel;
  } else if (cleanPath.startsWith('./') || cleanPath.startsWith('../')) {
    candidateBase = normalizeRel(path.posix.join(dirname(currentOldRel), cleanPath));
  } else {
    const match = aliasMatch(cleanPath, ctx.config.aliases.custom);
    if (!match) return null;

    const rest = cleanPath.slice(match.alias.length).replace(/^\//, '');
    const targetRoot = normalizeRel(match.targetRoot);
    candidateBase = normalizeRel(path.posix.join(targetRoot, rest));
  }

  const resolved = resolveCandidate(candidateBase, ctx.fileSet);
  if (!resolved) {
    if (ctx.config.dynamicRoutes.mode === 'strict' || ctx.config.dynamicRoutes.mode === 'warn') {
      ctx.warnings.push({
        file: currentOldRel,
        reference: ref,
        reason: 'No se pudo resolver la referencia a un archivo existente del build.',
      });
    }
    return null;
  }

  return { targetOldRel: resolved, suffix };
}

function rewriteReference(ref: string, currentOldRel: string, ctx: RewriteContext): string {
  const resolved = resolveReference(ref, currentOldRel, ctx);
  if (!resolved) return ref;

  const newTarget = ctx.plan.pathMap[resolved.targetOldRel];
  const currentNew = ctx.plan.pathMap[currentOldRel];

  if (!newTarget || !currentNew) return ref;

  ctx.rewritten++;

  if (ref.startsWith('/')) return `/${newTarget}${resolved.suffix}`;

  const relative = relFrom(dirname(currentNew), newTarget);
  return `${relative}${resolved.suffix}`;
}

function rewriteSrcset(srcset: string, currentOldRel: string, ctx: RewriteContext): string {
  return srcset
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return part;
      const [url, ...descriptor] = trimmed.split(/\s+/);
      const rewritten = rewriteReference(url, currentOldRel, ctx);
      return [rewritten, ...descriptor].join(' ');
    })
    .join(', ');
}

function removeSourceMapComments(content: string): string {
  return content
    .replace(/^\s*\/\/# sourceMappingURL=.*$/gm, '')
    .replace(/\/\*# sourceMappingURL=.*?\*\//gs, '');
}

function rewriteHtml(content: string, currentOldRel: string, ctx: RewriteContext): string {
  let out = content;

  out = out.replace(/\b(srcset)\s*=\s*(["'])(.*?)\2/gis, (_match, attr: string, quote: string, value: string) => {
    return `${attr}=${quote}${rewriteSrcset(value, currentOldRel, ctx)}${quote}`;
  });

  out = out.replace(/\b(src|href|poster|content)\s*=\s*(["'])(.*?)\2/gis, (_match, attr: string, quote: string, value: string) => {
    return `${attr}=${quote}${rewriteReference(value, currentOldRel, ctx)}${quote}`;
  });

  return out;
}

function rewriteCss(content: string, currentOldRel: string, ctx: RewriteContext): string {
  let out = content;

  out = out.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (_match, quote: string, value: string) => {
    const rewritten = rewriteReference(value.trim(), currentOldRel, ctx);
    return `url(${quote}${rewritten}${quote})`;
  });

  out = out.replace(/@import\s+(["'])(.*?)\1/gi, (_match, quote: string, value: string) => {
    return `@import ${quote}${rewriteReference(value, currentOldRel, ctx)}${quote}`;
  });

  if (ctx.config.sourcemaps.mode === 'delete') out = removeSourceMapComments(out);

  return out;
}

function rewriteJsLike(content: string, currentOldRel: string, ctx: RewriteContext): string {
  let out = content;

  out = out.replace(/(from\s*)(["'`])([^"'`]+)\2/g, (_match, prefix: string, quote: string, value: string) => {
    return `${prefix}${quote}${rewriteReference(value, currentOldRel, ctx)}${quote}`;
  });

  out = out.replace(/(import\s*\(\s*)(["'`])([^"'`]+)\2(\s*\))/g, (_match, prefix: string, quote: string, value: string, suffix: string) => {
    return `${prefix}${quote}${rewriteReference(value, currentOldRel, ctx)}${quote}${suffix}`;
  });

  out = out.replace(/(new\s+URL\s*\(\s*)(["'`])([^"'`]+)\2/g, (_match, prefix: string, quote: string, value: string) => {
    return `${prefix}${quote}${rewriteReference(value, currentOldRel, ctx)}${quote}`;
  });

  // V1 heuristic: rewrite obvious path-like strings used by fetch(), Image.src, Audio(), etc.
  out = out.replace(/(["'`])((?:\.\.?\/|\/)[^"'`\s<>]+?)\1/g, (_match, quote: string, value: string) => {
    return `${quote}${rewriteReference(value, currentOldRel, ctx)}${quote}`;
  });

  if (ctx.config.sourcemaps.mode === 'delete') out = removeSourceMapComments(out);

  return out;
}

function rewriteJsonValues(value: unknown, currentOldRel: string, ctx: RewriteContext): unknown {
  if (typeof value === 'string') return rewriteReference(value, currentOldRel, ctx);
  if (Array.isArray(value)) return value.map((item) => rewriteJsonValues(item, currentOldRel, ctx));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) out[key] = rewriteJsonValues(child, currentOldRel, ctx);
    return out;
  }
  return value;
}

function rewriteJson(content: string, currentOldRel: string, ctx: RewriteContext): string {
  try {
    const parsed = JSON.parse(content) as unknown;
    return `${JSON.stringify(rewriteJsonValues(parsed, currentOldRel, ctx), null, 2)}\n`;
  } catch {
    return content.replace(/(["'])((?:\.\.?\/|\/)[^"']+?)\1/g, (_match, quote: string, value: string) => {
      return `${quote}${rewriteReference(value, currentOldRel, ctx)}${quote}`;
    });
  }
}

export function rewriteContent(content: string, currentOldRel: string, plan: VeilPlan, config: AuriskConfig, fileSet: Set<string>, warnings: RewriteWarning[]): { content: string; rewritten: number } {
  const ctx: RewriteContext = { config, plan, fileSet, warnings, rewritten: 0 };
  const ext = path.posix.extname(currentOldRel).toLowerCase();
  const kind = textKind(ext);

  let output = content;
  if (kind === 'html') output = rewriteHtml(content, currentOldRel, ctx);
  else if (kind === 'css') output = rewriteCss(content, currentOldRel, ctx);
  else if (kind === 'js') output = rewriteJsLike(content, currentOldRel, ctx);
  else if (kind === 'json' || kind === 'webmanifest') output = rewriteJson(content, currentOldRel, ctx);

  return { content: output, rewritten: ctx.rewritten };
}
