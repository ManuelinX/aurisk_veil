import crypto from 'node:crypto';
import path from 'node:path';
import type { AuriskConfig } from '../types.js';

const ALPHABETS: Record<string, string> = {
  base62: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  base58: 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789',
  hex: 'abcdef0123456789',
};

const AMBIGUOUS = new Set(['0', 'O', 'o', '1', 'I', 'l']);

export class NameGenerator {
  private readonly alphabet: string;
  private readonly min: number;
  private readonly max: number;

  constructor(private readonly config: AuriskConfig['random']) {
    const rawAlphabet = ALPHABETS[config.alphabet] ?? ALPHABETS.base62;
    this.alphabet = config.avoidAmbiguousChars
      ? [...rawAlphabet].filter((char) => !AMBIGUOUS.has(char)).join('')
      : rawAlphabet;
    this.min = Math.max(3, config.minLength);
    this.max = Math.max(this.min, config.maxLength);
  }

  next(extension = ''): string {
    const length = crypto.randomInt(this.min, this.max + 1);
    let name = '';
    for (let i = 0; i < length; i++) {
      name += this.alphabet[crypto.randomInt(0, this.alphabet.length)];
    }
    return `${name}${extension}`;
  }
}

export function getPreservedExtension(fileName: string, preserveExtension: boolean): string {
  if (!preserveExtension) return '';
  const ext = path.posix.extname(fileName);
  return ext;
}
