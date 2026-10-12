/**
 * Every config loader's exported values in one JSON object, for a compare
 * across a change that moves config and is meant to move no value.
 *
 * `configHash()` covers the config as authored: each file's name and text.
 * Moving a key to another file changes it, and so does reordering two keys.
 * What the game reads is the other side of the loaders: the values the
 * modules under `src/config/` export after parsing. Dump them on the tree
 * before the move and on the tree after, and compare the two dumps path by
 * path (jsonDiff.ts). Equal dumps say every loader hands the game what it
 * handed it before.
 *
 * The dump is keyed by export name, with the module beside the value, so an
 * export that moves to another module shows as its `module` changing and
 * nothing else. Functions and zod schemas are left out: they are the
 * parsing, not what was parsed. The loaders are found by listing the
 * folder, so a new or renamed one is in the dump without a list to keep.
 */

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export interface ConfigExport {
  /** `src/config/health.ts` */
  readonly module: string;
  readonly value: unknown;
}

const CONFIG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'config');

/** The loader modules: every `.ts` file under `src/config/` that is not a test. */
export function configModules(): string[] {
  return readdirSync(CONFIG_DIR)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort();
}

/** `value` as JSON can hold it, with what JSON would drop or flatten kept visible. */
export function toJsonable(value: unknown): unknown {
  if (value === undefined) return '#undefined';
  if (typeof value === 'function') return '#function';
  if (typeof value === 'bigint') return `#bigint ${value}`;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof z.ZodType) return '#schema';
  if (Array.isArray(value)) return value.map(toJsonable);
  if (value instanceof Map) return { '#map': [...value].map(([k, v]) => [toJsonable(k), toJsonable(v)]) };
  if (value instanceof Set) return { '#set': [...value].map(toJsonable) };
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) out[key] = toJsonable(v);
  return out;
}

export async function dumpConfig(): Promise<Record<string, ConfigExport>> {
  const dump: Record<string, ConfigExport> = {};
  for (const file of configModules()) {
    const name = file.slice(0, -'.ts'.length);
    const loaded = (await import(`../../src/config/${name}.ts`)) as Record<string, unknown>;
    for (const [exported, value] of Object.entries(loaded)) {
      if (typeof value === 'function' || value instanceof z.ZodType) continue;
      const module = `src/config/${file}`;
      const earlier = dump[exported];
      if (earlier !== undefined) {
        throw new Error(`dumpConfig: ${exported} is exported by ${earlier.module} and by ${module}; the dump is keyed by export name`);
      }
      dump[exported] = { module, value: toJsonable(value) };
    }
  }
  return dump;
}
