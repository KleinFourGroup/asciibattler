/**
 * K4 — empower knobs. Source of truth at `config/empower.json`. Mirrors the
 * `config/objective.json` pattern (parse at module load, throw on malformed
 * JSON).
 *
 * At the pre-turn gate the player selects ONE drawn card per action and
 * empowers it: the configured `buff` lands on its roster slot via
 * `Run.addEncounterEffect`, so it persists for the rest of the ENCOUNTER
 * (re-seeded onto the fielded unit each turn — the K1 store's lifetime).
 *
 * - `enabled`         — master switch. L1 flipped this OFF for good: daemons
 *                       own empower availability now (`Run.turnGrants`, resolved
 *                       per turn from the owned daemons' `grantEmpowers` hooks —
 *                       47c re-authored the gates into rules), so this config
 *                       is the daemon-LESS baseline = disabled. The `buff`
 *                       below stays as the canonical "K4 default empower"
 *                       shape that tests/fixture daemons derive from.
 * - `empowersPerTurn` — empower ACTIONS allowed per turn (one card each). The
 *                       shipped default (1) makes empower a once-a-turn pick;
 *                       a daemon can raise it without new plumbing.
 * - `buff`            — the effect one empower applies, in `StatusEffect`
 *                       terms MINUS magnitude + lifetime: each apply is
 *                       magnitude 1 (stack strength lives in `mods`, so a
 *                       separate per-apply magnitude would be a redundant
 *                       dial), and the lifetime is always the encounter store's
 *                       (`endOfTurn` per seed — see `empowerEffect`). The
 *                       shipped default is the universal-offense "+4 damage":
 *                       +4 strength / ranged / magic in one effect — each
 *                       archetype only reads its own damage stat, so it plays
 *                       as "+4 damage" on any card with no dead picks (the
 *                       brief's literal "+4 strength" would be inert on an
 *                       archer). `merge: "add"` makes re-empowering the same
 *                       unit STACK (magnitude 2 → +8) — the user-locked
 *                       "invest in a carry" model.
 */

import { z } from 'zod';
import empowerJson from '../../config/empower.json';
import type { MergePolicy, StatKey, StatMod, StatusEffect } from '../sim/statusEffects';

/** The 11-stat vocabulary, as zod keys for the buff's `mods` record
 *  (`partialRecord`: any subset, every present key must be a real stat).
 *  The `satisfies` pins it to `UnitStats` — a stat rename breaks the build
 *  here rather than silently orphaning a config key. */
const STAT_KEYS = [
  'constitution',
  'strength',
  'ranged',
  'magic',
  'luck',
  'defense',
  'precision',
  'evasion',
  'speed',
  'mobility',
  'power',
] as const satisfies readonly StatKey[];

const StatModSchema = z.object({
  add: z.number().optional(),
  mul: z.number().optional(),
});

/** L1 — the buff sub-schema is shared with `config/daemons.ts` (a daemon's
 *  empower gate carries its own buff in the same shape). */
export const BuffSchema = z.object({
  key: z.string().min(1),
  mods: z.partialRecord(z.enum(STAT_KEYS), StatModSchema),
  merge: z.enum(['replace', 'add', 'multiply', 'independent']),
});

const EmpowerSchema = z.object({
  enabled: z.boolean(),
  empowersPerTurn: z.number().int().nonnegative(),
  buff: BuffSchema,
});

/** The buff in canonical `statusEffects` terms (not the zod inference — its
 *  `| undefined` optionals clash with `exactOptionalPropertyTypes`, so the
 *  parse result is normalized below). */
export interface EmpowerConfig {
  enabled: boolean;
  empowersPerTurn: number;
  buff: {
    key: string;
    mods: StatusEffect['mods'];
    merge: MergePolicy;
  };
}

const parsed = EmpowerSchema.parse(empowerJson);

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

/** L1 — parse-result → canonical buff, shared with `config/daemons.ts`. */
export function normalizeBuff(raw: z.infer<typeof BuffSchema>): EmpowerConfig['buff'] {
  return {
    key: raw.key,
    mods: normalizeMods(raw.mods),
    merge: raw.merge,
  };
}

export const EMPOWER: EmpowerConfig = {
  enabled: parsed.enabled,
  empowersPerTurn: parsed.empowersPerTurn,
  buff: normalizeBuff(parsed.buff),
};
