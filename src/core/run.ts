import fs from 'node:fs/promises';
import path from 'node:path';
import type { AuriskConfig, RewriteWarning, RunReport } from '../types.js';
import { scanTree } from './scan.js';
import { buildPlan } from './plan.js';
import { isTextFile } from './text.js';
import { rewriteContent } from './rewrite.js';

async function emptyDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function ensureDirFor(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function runVeil(config: AuriskConfig): Promise<RunReport> {
  const startedAt = new Date().toISOString();
  const rootAbs = path.resolve(config.input);
  const outputAbs = path.resolve(config.output);

  if (rootAbs === outputAbs) {
    throw new Error('La carpeta de salida no puede ser igual a la carpeta de entrada. Usa --out ./dist.veil');
  }

  const { files, dirs } = await scanTree(rootAbs);
  const plan = buildPlan(rootAbs, outputAbs, files, dirs, config);
  const fileSet = new Set(files.map((file) => file.relPath));
  const skipped = new Set(plan.skippedFiles);
  const warnings: RewriteWarning[] = [];
  let filesWritten = 0;
  let refsRewritten = 0;

  if (!config.safety.dryRun) await emptyDir(outputAbs);

  for (const file of files) {
    if (skipped.has(file.relPath)) continue;
    const newRel = plan.pathMap[file.relPath];
    if (!newRel) continue;
    const targetAbs = path.join(outputAbs, newRel);

    if (config.safety.dryRun) {
      filesWritten++;
      continue;
    }

    await ensureDirFor(targetAbs);

    if (isTextFile(file.extension, config)) {
      const raw = await fs.readFile(file.absPath, 'utf8');
      const rewritten = rewriteContent(raw, file.relPath, plan, config, fileSet, warnings);
      refsRewritten += rewritten.rewritten;
      await fs.writeFile(targetAbs, rewritten.content, 'utf8');
    } else {
      await fs.copyFile(file.absPath, targetAbs);
    }

    filesWritten++;
  }

  if (config.safety.failOnBrokenReferences && warnings.length > 0) {
    throw new Error(`Aurisk Veil encontró ${warnings.length} referencias no resueltas. Revisa el reporte o usa dynamicRoutes.mode: warn.`);
  }

  const finishedAt = new Date().toISOString();
  const report: RunReport = {
    startedAt,
    finishedAt,
    input: rootAbs,
    output: outputAbs,
    filesScanned: files.length,
    filesWritten,
    filesSkipped: skipped.size,
    dirsMapped: dirs.length,
    refsRewritten,
    warnings,
  };

  if (!config.safety.dryRun && (config.safety.generateReport || config.safety.generatePrivateMap)) {
    const reportDir = path.resolve(config.safety.reportDir);
    await fs.mkdir(reportDir, { recursive: true });

    if (config.safety.generateReport) {
      await fs.writeFile(path.join(reportDir, 'aurisk-report.json'), JSON.stringify(report, null, 2), 'utf8');
    }

    if (config.safety.generatePrivateMap) {
      await fs.writeFile(
        path.join(reportDir, 'aurisk-map.json'),
        JSON.stringify({ pathMap: plan.pathMap, inversePathMap: plan.inversePathMap, skippedFiles: plan.skippedFiles }, null, 2),
        'utf8',
      );
    }
  }

  return report;
}
