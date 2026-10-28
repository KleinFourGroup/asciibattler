/**
 * The buff vocabulary a daemon's `grantEmpowers` rule and a packet's
 * `applyBuff` op are written in: the schema, its normalized type, and the
 * normalizer both loaders share.
 *
 * A buff is a `StatusEffect` without magnitude or lifetime: each apply is
 * magnitude 1 (stack strength lives in `mods`), and the lifetime is the
 * encounter store's (`empowerEffect`). `merge: "add"` makes re-empowering
 * the same unit stack.
 */

import { z } from 'zod';
import type { MergePolicy, StatKey, StatMod, StatusEffect } from '../sim/statusEffects';

/** The nine stats, as zod keys for the buff's `mods` record: any subset,
 *  each key a real stat. The `satisfies` pins it to `StatKey`, so a stat
 *  rename breaks the build here rather than orphaning a config key. */
const STAT_KEYS = [
  'constitution',
  'strength',
  'ranged',
  'magic',
  'luck',
  'defense',
  'speed',
  'mobility',
  'power',
] as const satisfies readonly StatKey[];

const StatModSchema = z.object({
  add: z.number().optional(),
  mul: z.number().optional(),
});

export const BuffSchema = z.object({
  key: z.string().min(1),
  mods: z.partialRecord(z.enum(STAT_KEYS), StatModSchema),
  merge: z.enum(['replace', 'add', 'multiply', 'independent']),
});

/** The buff in canonical `statusEffects` terms (not the zod inference — its
 *  `| undefined` optionals clash with `exactOptionalPropertyTypes`, so the
 *  parse result is normalized below). */
export interface EmpowerConfig {
  buff: {
    key: string;
    mods: StatusEffect['mods'];
    merge: MergePolicy;
  };
}

/** Strip zod's explicit-`undefined` optionals into exact `StatMod` objects. */
function normalizeMods(raw: z.infer<typeof BuffSchema>['mods']): StatusEffect['mods'] {
  const mods: Partial<Record<StatKey, StatMod>> = {};
  for (const [stat, mod] of Object.entries(raw)) {
    const out: StatMod = {};
    if (mod.add !== undefined) out.add = mod.add;
    if (mod.mul !== undefined) out.mul = mod.mul;
    mods[stat as StatKey] = out;
  }
  return mods;
}

/** The parse result as the canonical buff. */
export function normalizeBuff(raw: z.infer<typeof BuffSchema>): EmpowerConfig['buff'] {
  return {
    key: raw.key,
    mods: normalizeMods(raw.mods),
    merge: raw.merge,
  };
}
