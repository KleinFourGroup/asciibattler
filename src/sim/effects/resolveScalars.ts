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
import type { DamageOp, DamageScaling, HealOp } from './schema';

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
