import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { DEFAULT_CONFIG, mergeConfig } from '../defaults.js';
import type { AuriskConfig } from '../types.js';

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadConfig(configPath: string): Promise<AuriskConfig> {
  const abs = path.resolve(configPath);
  const raw = await fs.readFile(abs, 'utf8');
  const parsed = configPath.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
  return mergeConfig(DEFAULT_CONFIG, parsed ?? {});
}

export async function writeConfig(configPath: string, config: AuriskConfig): Promise<void> {
  const abs = path.resolve(configPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, YAML.stringify(config), 'utf8');
}

export async function findDefaultConfig(cwd = process.cwd()): Promise<string | null> {
  const candidates = ['aurisk.veil.yml', 'aurisk.veil.yaml', 'aurisk.veil.json'];
  for (const candidate of candidates) {
    const full = path.resolve(cwd, candidate);
    if (await fileExists(full)) return full;
  }
  return null;
}
