/**
 * H6c → K1 — spawn-time fatigue, now a status effect.
 *
 * Fatigue is a debuff applied to a unit as it enters a battle: a unit that has
 * already fought N turns this encounter is fielded weaker. The stack count is
 * H3's per-encounter `deploymentCounts` (one stack per PRIOR turn the unit was
 * deployed); `fatigueEffect` turns it into a K1 `Fatigued` status effect that
 * scales the unit's `power` (the pool-chip stat).
 *
 * K1 migrated this off the H6c `Run.beginTurn` power-bake onto the status-
 * effect system — the eventual shape the H6c comment explicitly named. The
 * Fatigued effect is a single per-turn instance: magnitude = stacks, a
 * per-stack `power × (1 − rate)` mul. The K1 fold `(1 + (mul − 1)·m)`
 * reproduces the H6c curve `power × (1 − rate·stacks)` exactly.
 *
 * INERT by default: the shipped `fatiguePerStack` is 0, so `fatigueEffect`
 * returns `null` (no effect seeded) — the spawned unit is byte-identical to
 * the un-fatigued baseline. The real curve / magnitude is a Phase-N/O balance
 * call; this only re-homes the mechanic.
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
 * defaults to the shipped `HEALTH.fatiguePerStack` (production wiring); pass it
 * explicitly to pin the mechanic in tests without touching config.
 */
export function fatigueEffect(
  stacks: number,
  rate: number = HEALTH.fatiguePerStack,
): StatusEffect | null {
  if (rate <= 0 || stacks <= 0) return null;
  return {
    key: FATIGUE_KEY,
    magnitude: stacks,
    mods: { power: { mul: 1 - rate } },
    lifetime: { kind: 'endOfTurn' },
    merge: 'add',
  };
}
