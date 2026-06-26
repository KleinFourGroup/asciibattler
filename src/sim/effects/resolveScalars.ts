/**
 * §30c — the pure cast-time scalar math, shared by the propose-time resolver
 * (`propose.ts` `resolveOp`) and the §30 attack editor's resolution-outline
 * preview (`tools/attack-editor`). Extracted so the editor shows the REAL
 * resolved numbers through the same arithmetic the sim captures at cast — never a
 * re-implementation (the encounter editor's "preview shares `resolveWave`"
 * discipline, ROADMAP §30).
 *
 * The kernel reads only a caster's `UnitStats` (the op's `scaling` stat + `luck`);
 * the structural op params (`evadable`, `accuracy`, the move mode) and the target
 * are NOT inputs to the scalar capture. A `damage` op's cast-time scalars are
 * `baseDamage = might + scalingStat` and `critChance = critable ? critChanceFor(
 * critBase, luck) : 0` — exactly what the legacy actions resolved at propose time
 * and carried inertly to impact. Pure: no World, no RNG.
 */

import type { UnitStats } from '../Unit';
import { critChanceFor } from '../stats';
import type { DamageOp, DamageScaling, HealOp, ScaledValue } from './schema';

/**
 * The caster stat an op's `scaling` names, ADDED to its flat `might`. Mirrors
 * `damageStatFor` for the migrated verbs (sword/club/katana/whip → `strength`,
 * bow/catapult → `ranged`, magic_bolt → `magic`), but resolved off the op rather
 * than the archetype — byte-identical because each verb maps to exactly one stat
 * (see `schema.ts`). `none` = flat `might` only. `HealScaling` (`magic` | `none`)
 * is a subset of `DamageScaling`, so a heal op resolves through here too.
 */
export function scalingStatValue(scaling: DamageScaling, stats: UnitStats): number {
  switch (scaling) {
    case 'strength':
      return stats.strength;
    case 'ranged':
      return stats.ranged;
    case 'magic':
      return stats.magic;
    case 'none':
      return 0;
  }
}

/** A `damage` op's cast-time scalars: base output + crit probability (0 when the
 *  op isn't `critable`, reproducing the propose-time capture exactly). */
export function resolveDamageScalars(
  op: DamageOp,
  stats: UnitStats,
): { baseDamage: number; critChance: number } {
  const baseDamage = op.might + scalingStatValue(op.scaling, stats);
  const critChance = op.critable ? critChanceFor(op.critBase, stats.luck) : 0;
  return { baseDamage, critChance };
}

/** A `heal` op's cast-time amount (`might + magic`; never rolls to-hit or crit —
 *  mirrors `healAmountFor`). */
export function resolveHealAmount(op: HealOp, stats: UnitStats): number {
  return op.might + scalingStatValue(op.scaling, stats);
}

/**
 * §31 — what a `ScaledValue` reads off the caster: its combatant `level` + its
 * `effectiveStats`. A STRUCTURAL subset of `Unit` (not the class) so the §31d
 * editor preview can pass a synthetic sample caster — `{ level, effectiveStats }`
 * — without constructing a real unit, exactly as the `UnitStats`-only damage/heal
 * kernels above let it preview those. A full `Unit` satisfies it for free.
 */
export interface ScalingSource {
  level: number;
  effectiveStats: UnitStats;
}

/**
 * §31 — evaluate a `ScalarOrScaled` against a caster at CAST time (frozen). The
 * one genuinely new bit of cast-time math the phase adds; the `resolveScalars`
 * sibling so the editor preview (§31d) and the propose-time capture (`propose.ts`
 * `resolveOp`) share one source of truth, as §30c established for damage/heal.
 *
 * A bare number passes through untouched (the non-breaking arm — today's
 * authoring). A `ScaledValue` resolves `base + perPoint × stat(caster)`, reading
 * `level` off the unit and every other stat off `effectiveStats`, then clamps to
 * `max` when present. `undefined` in → `undefined` out, so an unauthored optional
 * (a magnitude/duration the def omits) stays unset and the consumer's `?? default`
 * still governs.
 */
export function evalScaled(
  v: number | ScaledValue | undefined,
  caster: ScalingSource,
): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'number') return v;
  const stat = v.stat === 'level' ? caster.level : caster.effectiveStats[v.stat];
  const raw = v.base + v.perPoint * stat;
  return v.max !== undefined ? Math.min(raw, v.max) : raw;
}
