export type DynamicRouteMode = 'strict' | 'warn' | 'ignore' | 'manifest';
export type SourcemapMode = 'delete' | 'ignore' | 'rewrite';

export interface AuriskConfig {
  input: string;
  output: string;
  random: {
    minLength: number;
    maxLength: number;
    alphabet: 'base62' | 'base58' | 'hex';
    preserveExtension: boolean;
    avoidAmbiguousChars: boolean;
  };
  rename: {
    files: boolean;
    directories: boolean;
    preserveEntryFiles: string[];
    preservePatterns: string[];
  };
  rewrite: {
    js: boolean;
    html: boolean;
    css: boolean;
    json: boolean;
    webmanifest: boolean;
    ignorePrefixes: string[];
  };
  aliases: {
    readTsconfig: boolean;
    readJsconfig: boolean;
    custom: Record<string, string>;
  };
  dynamicRoutes: {
    mode: DynamicRouteMode;
  };
  sourcemaps: {
    mode: SourcemapMode;
  };
  safety: {
    dryRun: boolean;
    failOnBrokenReferences: boolean;
    generateReport: boolean;
    generatePrivateMap: boolean;
    reportDir: string;
  };
}

export interface FileEntry {
  absPath: string;
  relPath: string;
  kind: 'file' | 'dir';
  extension: string;
  sizeBytes: number;
}

export interface VeilPlan {
  rootAbs: string;
  outputAbs: string;
  pathMap: Record<string, string>;
  inversePathMap: Record<string, string>;
  files: FileEntry[];
  dirs: FileEntry[];
  skippedFiles: string[];
}

export interface RewriteWarning {
  file: string;
  reference: string;
  reason: string;
}

export interface RunReport {
  startedAt: string;
  finishedAt: string;
  input: string;
  output: string;
  filesScanned: number;
  filesWritten: number;
  filesSkipped: number;
  dirsMapped: number;
  refsRewritten: number;
  warnings: RewriteWarning[];
}
