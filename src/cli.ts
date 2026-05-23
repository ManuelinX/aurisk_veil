#!/usr/bin/env node
import { Command } from 'commander';
import { DEFAULT_CONFIG, mergeConfig } from './defaults.js';
import { findDefaultConfig, loadConfig, writeConfig } from './core/config.js';
import { runVeil } from './core/run.js';
import { resolveInteractiveConfig } from './cli/prompts.js';
import type { AuriskConfig } from './types.js';

const program = new Command();

program
  .name('aurisk')
  .description('Aurisk Veil - post-build asset and path obfuscator')
  .version('0.1.0');

program
  .command('init')
  .description('Create aurisk.veil.yml with recommended defaults')
  .option('-o, --output <path>', 'config output path', 'aurisk.veil.yml')
  .action(async (opts: { output: string }) => {
    await writeConfig(opts.output, DEFAULT_CONFIG);
    console.log(`✓ Config creada: ${opts.output}`);
  });

program
  .command('veil [input]')
  .description('Obfuscate a build directory into a new output directory')
  .option('-c, --config <path>', 'config file path')
  .option('-o, --out <path>', 'output directory')
  .option('--min <number>', 'minimum random name length')
  .option('--max <number>', 'maximum random name length')
  .option('--dry-run', 'only calculate the plan and report; do not write output')
  .option('--strict', 'fail when a reference cannot be resolved')
  .option('-y, --yes', 'non-interactive mode using defaults and CLI flags')
  .action(async (inputArg: string | undefined, opts: Record<string, string | boolean | undefined>) => {
    try {
      let config: AuriskConfig;

      if (typeof opts.config === 'string') {
        config = await loadConfig(opts.config);
      } else {
        const defaultConfigPath = await findDefaultConfig();
        if (defaultConfigPath) config = await loadConfig(defaultConfigPath);
        else if (opts.yes || inputArg) config = DEFAULT_CONFIG;
        else config = await resolveInteractiveConfig();
      }

      const cliOverrides: Partial<AuriskConfig> = {};
      if (inputArg) cliOverrides.input = inputArg;
      if (typeof opts.out === 'string') cliOverrides.output = opts.out;
      if (typeof opts.min === 'string' || typeof opts.max === 'string') {
        cliOverrides.random = {
          ...config.random,
          minLength: typeof opts.min === 'string' ? Number(opts.min) : config.random.minLength,
          maxLength: typeof opts.max === 'string' ? Number(opts.max) : config.random.maxLength,
        };
      }
      if (opts.dryRun || opts.strict) {
        cliOverrides.safety = {
          ...config.safety,
          dryRun: Boolean(opts.dryRun) || config.safety.dryRun,
          failOnBrokenReferences: Boolean(opts.strict) || config.safety.failOnBrokenReferences,
        };
      }
      if (opts.strict) cliOverrides.dynamicRoutes = { mode: 'strict' };

      config = mergeConfig(config, cliOverrides);

      const report = await runVeil(config);

      console.log('✓ Aurisk Veil terminó.');
      console.log(`  Entrada: ${report.input}`);
      console.log(`  Salida:  ${report.output}`);
      console.log(`  Archivos escritos: ${report.filesWritten}`);
      console.log(`  Referencias reescritas: ${report.refsRewritten}`);
      console.log(`  Warnings: ${report.warnings.length}`);
      if (config.safety.generateReport) console.log(`  Reporte: ${config.safety.reportDir}/aurisk-report.json`);
      if (config.safety.generatePrivateMap) console.log(`  Mapa privado: ${config.safety.reportDir}/aurisk-map.json`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('scan [input]')
  .description('Run a dry scan using the current config')
  .option('-c, --config <path>', 'config file path')
  .action(async (inputArg: string | undefined, opts: { config?: string }) => {
    try {
      const defaultConfigPath = opts.config ?? (await findDefaultConfig());
      const base = defaultConfigPath ? await loadConfig(defaultConfigPath) : DEFAULT_CONFIG;
      const config = mergeConfig(base, {
        input: inputArg ?? base.input,
        safety: { ...base.safety, dryRun: true, generateReport: false, generatePrivateMap: false },
      });
      const report = await runVeil(config);
      console.log('✓ Scan terminado.');
      console.log(`  Archivos detectados: ${report.filesScanned}`);
      console.log(`  Directorios mapeados: ${report.dirsMapped}`);
      console.log(`  Referencias que se podrían reescribir: ${report.refsRewritten}`);
      console.log(`  Warnings: ${report.warnings.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
