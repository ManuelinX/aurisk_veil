import path from 'node:path';
import type { AuriskConfig, FileEntry, VeilPlan } from '../types.js';
import { dirname, joinRel } from '../utils/path.js';
import { getPreservedExtension, NameGenerator } from './name-generator.js';
import { shouldPreserveDirName, shouldPreserveFileName } from './preserve.js';

function ensureUniqueName(parentNewRel: string, wanted: string, usedByParent: Map<string, Set<string>>, generator: NameGenerator, ext = ''): string {
  const used = usedByParent.get(parentNewRel) ?? new Set<string>();
  usedByParent.set(parentNewRel, used);

  if (!used.has(wanted)) {
    used.add(wanted);
    return wanted;
  }

  let candidate = generator.next(ext);
  while (used.has(candidate)) candidate = generator.next(ext);
  used.add(candidate);
  return candidate;
}

export function buildPlan(rootAbs: string, outputAbs: string, files: FileEntry[], dirs: FileEntry[], config: AuriskConfig): VeilPlan {
  const generator = new NameGenerator(config.random);
  const pathMap: Record<string, string> = {};
  const inversePathMap: Record<string, string> = {};
  const skippedFiles: string[] = [];
  const usedByParent = new Map<string, Set<string>>();

  pathMap[''] = '';
  inversePathMap[''] = '';

  for (const dir of dirs) {
    const parentOld = dirname(dir.relPath);
    const parentNew = pathMap[parentOld] ?? parentOld;
    const originalBase = path.posix.basename(dir.relPath);
    const shouldPreserve = !config.rename.directories || shouldPreserveDirName(dir.relPath, config.rename.preservePatterns);
    const wantedBase = shouldPreserve ? originalBase : generator.next('');
    const newBase = ensureUniqueName(parentNew, wantedBase, usedByParent, generator);
    const newRel = joinRel(parentNew, newBase);
    pathMap[dir.relPath] = newRel;
    inversePathMap[newRel] = dir.relPath;
  }

  for (const file of files) {
    if (config.sourcemaps.mode === 'delete' && file.relPath.endsWith('.map')) {
      skippedFiles.push(file.relPath);
      continue;
    }

    const parentOld = dirname(file.relPath);
    const parentNew = pathMap[parentOld] ?? parentOld;
    const originalBase = path.posix.basename(file.relPath);
    const shouldPreserve = !config.rename.files || shouldPreserveFileName(file.relPath, config.rename.preserveEntryFiles, config.rename.preservePatterns);
    const ext = getPreservedExtension(originalBase, config.random.preserveExtension);
    const wantedBase = shouldPreserve ? originalBase : generator.next(ext);
    const newBase = ensureUniqueName(parentNew, wantedBase, usedByParent, generator, ext);
    const newRel = joinRel(parentNew, newBase);
    pathMap[file.relPath] = newRel;
    inversePathMap[newRel] = file.relPath;
  }

  return { rootAbs, outputAbs, pathMap, inversePathMap, files, dirs, skippedFiles };
}
