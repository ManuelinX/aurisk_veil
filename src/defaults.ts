import type { AuriskConfig } from './types.js';

export const DEFAULT_CONFIG: AuriskConfig = {
  input: './dist',
  output: './dist.veil',
  random: {
    minLength: 8,
    maxLength: 14,
    alphabet: 'base62',
    preserveExtension: true,
    avoidAmbiguousChars: true,
  },
  rename: {
    files: true,
    directories: true,
    preserveEntryFiles: [
      'index.html',
      'favicon.ico',
      'robots.txt',
      'sitemap.xml',
      'manifest.webmanifest',
      'service-worker.js',
      'sw.js',
    ],
    preservePatterns: ['*.map', '.well-known/**'],
  },
  rewrite: {
    js: true,
    html: true,
    css: true,
    json: true,
    webmanifest: true,
    ignorePrefixes: ['/api', '/auth', '/graphql', '/socket.io'],
  },
  aliases: {
    readTsconfig: true,
    readJsconfig: true,
    custom: {},
  },
  dynamicRoutes: {
    mode: 'warn',
  },
  sourcemaps: {
    mode: 'delete',
  },
  safety: {
    dryRun: false,
    failOnBrokenReferences: false,
    generateReport: true,
    generatePrivateMap: true,
    reportDir: '.aurisk',
  },
};

export function mergeConfig(base: AuriskConfig, partial: Partial<AuriskConfig>): AuriskConfig {
  return {
    ...base,
    ...partial,
    random: { ...base.random, ...partial.random },
    rename: { ...base.rename, ...partial.rename },
    rewrite: { ...base.rewrite, ...partial.rewrite },
    aliases: {
      ...base.aliases,
      ...partial.aliases,
      custom: { ...base.aliases.custom, ...partial.aliases?.custom },
    },
    dynamicRoutes: { ...base.dynamicRoutes, ...partial.dynamicRoutes },
    sourcemaps: { ...base.sourcemaps, ...partial.sourcemaps },
    safety: { ...base.safety, ...partial.safety },
  };
}
