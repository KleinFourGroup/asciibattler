/**
 * The cast-time scalar math, pure (no World, no RNG), shared by the propose
 * step (`propose.ts`'s `resolveOp`) and the previews of the attack and
 * archetype editors (`tools/attack-editor`, `tools/archetype-editor`), so an
 * editor shows the numbers the sim captures, through the same arithmetic.
 *
 * The damage and heal kernels read only the caster's `UnitStats`: the op's
 * `scaling` stat, and `luck` for the crit. The op's structural params
 * (`evadable`, `accuracy`, the move mode) and the target are not inputs. What
 * they capture at cast is carried unchanged to impact.
 */

import type { UnitStats } from '../Unit';
import { critChanceFor } from '../stats';
import type { DamageOp, DamageScaling, HealOp, ScaledValue } from './schema';

/**
 * The caster stat an op's `scaling` names, added to its flat `might`; `none`
 * adds nothing. A heal op's scaling (`magic` or `none`) is a subset of
 * `DamageScaling`, so heals resolve through here too.
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

/** A `damage` op's cast-time scalars: the base output, and the crit chance (0
 *  when the op is not `critable`). */
export function resolveDamageScalars(
  op: DamageOp,
  stats: UnitStats,
): { baseDamage: number; critChance: number } {
  const baseDamage = op.might + scalingStatValue(op.scaling, stats);
  const critChance = op.critable ? critChanceFor(op.critBase, stats.luck) : 0;
  return { baseDamage, critChance };
}

/** A `heal` op's cast-time amount. A heal never rolls to hit or to crit. */
export function resolveHealAmount(op: HealOp, stats: UnitStats): number {
  return op.might + scalingStatValue(op.scaling, stats);
}

/**
 * What a `ScaledValue` reads off the caster: its `level` and its
 * `effectiveStats`. A structural subset of `Unit`, so an editor's preview can
 * pass a sample `{ level, effectiveStats }` without building a unit; a `Unit`
 * satisfies it.
 */
export interface ScalingSource {
  level: number;
  effectiveStats: UnitStats;
}

/**
 * A value of `ScalarOrScaledSchema`'s shape, evaluated against the caster at
 * cast time and frozen there; the propose step and the editors' previews share
 * it, as they share the kernels above. A number passes through. A
 * `ScaledValue` grows with its stat (`level` read off the caster, any other off
 * `effectiveStats`) and is clamped to `max` when it has one. `undefined` gives
 * `undefined`, so an optional the def leaves out stays unset and the
 * consumer's default governs.
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
