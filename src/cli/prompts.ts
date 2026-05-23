import { input, confirm, select, number } from '@inquirer/prompts';
import { DEFAULT_CONFIG, mergeConfig } from '../defaults.js';
import type { AuriskConfig, DynamicRouteMode, SourcemapMode } from '../types.js';
import { fileExists, loadConfig, writeConfig } from '../core/config.js';

export async function resolveInteractiveConfig(): Promise<AuriskConfig> {
  const maybeConfig = await input({
    message: 'Ruta del archivo de configuración (Enter para configurar manualmente):',
    default: '',
  });

  if (maybeConfig.trim()) {
    if (!(await fileExists(maybeConfig.trim()))) throw new Error(`No existe el archivo de configuración: ${maybeConfig}`);
    return loadConfig(maybeConfig.trim());
  }

  const inputDir = await input({ message: 'Ruta del directorio a ofuscar:', default: DEFAULT_CONFIG.input });
  const outputDir = await input({ message: 'Ruta de salida:', default: DEFAULT_CONFIG.output });
  const minLength = await number({ message: 'Longitud mínima de nombres random:', default: DEFAULT_CONFIG.random.minLength, required: true });
  const maxLength = await number({ message: 'Longitud máxima de nombres random:', default: DEFAULT_CONFIG.random.maxLength, required: true });
  const renameDirectories = await confirm({ message: '¿Renombrar directorios también?', default: true });
  const sourcemapMode = await select<SourcemapMode>({
    message: '¿Qué hacer con sourcemaps?',
    default: DEFAULT_CONFIG.sourcemaps.mode,
    choices: [
      { name: 'Borrarlos para producción', value: 'delete' },
      { name: 'Ignorarlos/conservarlos', value: 'ignore' },
      { name: 'Reescribirlos - no recomendado aún para v1', value: 'rewrite' },
    ],
  });
  const dynamicMode = await select<DynamicRouteMode>({
    message: '¿Qué hacer con rutas dinámicas no resolubles?',
    default: DEFAULT_CONFIG.dynamicRoutes.mode,
    choices: [
      { name: 'Advertir y continuar', value: 'warn' },
      { name: 'Fallar si encuentra algo raro', value: 'strict' },
      { name: 'Ignorar', value: 'ignore' },
      { name: 'Manifest runtime - reservado para v2', value: 'manifest' },
    ],
  });

  const config = mergeConfig(DEFAULT_CONFIG, {
    input: inputDir,
    output: outputDir,
    random: { minLength: minLength ?? 8, maxLength: maxLength ?? 14 },
    rename: { directories: renameDirectories },
    sourcemaps: { mode: sourcemapMode },
    dynamicRoutes: { mode: dynamicMode },
  });

  const shouldSave = await confirm({ message: '¿Guardar esta configuración como aurisk.veil.yml?', default: true });
  if (shouldSave) await writeConfig('aurisk.veil.yml', config);

  return config;
}
