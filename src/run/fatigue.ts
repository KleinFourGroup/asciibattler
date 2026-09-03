/**
 * H6c → K1 → §91c — spawn-time fatigue, a status effect on CONSTITUTION.
 *
 * Fatigue is a debuff applied to a unit as it enters a battle: a unit that has
 * already fought N turns this encounter is fielded weaker. The stack count is
 * H3's per-encounter `deploymentCounts` (one stack per PRIOR turn the unit was
 * deployed); `fatigueEffect` turns it into a K1 `Fatigued` status effect that
 * scales the unit's `constitution` — its starting HP — by `1 − rate·stacks`.
 *
 * K1 migrated this off the H6c `Run.beginTurn` power-bake onto the status-
 * effect system. §91c (the casualty experiment) re-targeted it from `power` to
 * `constitution`: under the casualties chip rule `power` is what a unit COSTS
 * when it falls, so a power debuff made a tired unit CHEAPER to lose — the
 * opposite of a penalty. Fatigue now bites where it reads: a tired unit takes
 * the field with less HP. The Fatigued effect is a single per-turn instance:
 * magnitude = min(stacks, `fatigueMaxStacks`), a per-stack
 * `constitution × (1 − rate)` mul; the K1 fold `(1 + (mul − 1)·m)` reproduces
 * the curve `constitution × (1 − rate·stacks)` exactly, and the stack clamp is
 * the spec's cap (−10%/stack × 5 stacks = −50%). `Unit`'s constructor clamps
 * `currentHp` to the re-derived maxHp after seeding, so a fatigued unit never
 * spawns over its max.
 *
 * INERT by default: the shipped `fatiguePerStack` is 0, so `fatigueEffect`
 * returns `null` (no effect seeded) — the spawned unit is byte-identical to
 * the un-fatigued baseline. The rate is switched on as its own paired read
 * during the §92 rebalance (one change per paired read).
 */

import { HEALTH } from '../config/health';
import type { StatusEffect } from '../sim/statusEffects';

/** The `Fatigued` effect's stable key (merge `add` if ever applied at runtime;
 *  the per-turn seed is a single instance). */
export const FATIGUE_KEY = 'fatigued';

/**
 * The `Fatigued` debuff for a unit fielded with `stacks` prior deployments
 * this encounter, or `null` when it would be a no-op (rate 0 or 0 stacks) — so
 * the default config seeds NO effect and the unit stays byte-identical. `rate`
 * and `maxStacks` default to the shipped `HEALTH.fatiguePerStack` /
 * `HEALTH.fatigueMaxStacks` (production wiring); pass them explicitly to pin
 * the mechanic in tests without touching config.
 */
export function fatigueEffect(
  stacks: number,
  rate: number = HEALTH.fatiguePerStack,
  maxStacks: number = HEALTH.fatigueMaxStacks,
): StatusEffect | null {
  if (rate <= 0 || stacks <= 0) return null;
  return {
    key: FATIGUE_KEY,
    magnitude: Math.min(stacks, maxStacks),
    mods: { constitution: { mul: 1 - rate } },
    lifetime: { kind: 'endOfTurn' },
    merge: 'add',
  };
}
