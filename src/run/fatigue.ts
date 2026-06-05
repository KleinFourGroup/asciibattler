/**
 * H6c — spawn-time fatigue (INERT by default).
 *
 * Fatigue is conceptually a status applied to a unit as it enters a battle: a
 * unit that has already fought N turns this encounter is fielded weaker. The
 * stack count comes from H3's per-encounter `deploymentCounts` (one stack per
 * PRIOR turn the unit was deployed); `fatigueFactor` turns that count into a
 * multiplier that `Run.beginTurn` bakes into the fielded unit's `power` (the
 * placeholder target — see below) at the spawn-prep seam.
 *
 * INERT plumbing: the shipped `fatiguePerStack` is 0, so the factor is 1.0 for
 * any stack count and nothing changes. This commit lands only the wiring +
 * the chosen application SITE (spawn time, Run-side). The real curve /
 * magnitude — and whether the eventual shape is a power scale, an attack-stat
 * debuff, or a stackable "Fatigued" status owned by a future status-effect
 * system — is deliberately deferred to H7 (a localized, known re-wire).
 *
 * `power` is the placeholder target because it's the existing fatigue-axis
 * stat: a fielded unit's `power` is what chips the opposing pool, so scaling
 * it here makes the chip fatigue-aware with zero chip-side change.
 */

import { HEALTH } from '../config/health';

/**
 * Multiplier for a unit fielded with `stacks` prior deployments this encounter.
 * Linear `1 − rate·stacks`, clamped at 0. `rate` defaults to the shipped
 * `HEALTH.fatiguePerStack` (the production wiring); pass it explicitly to pin
 * the mechanic in tests without touching config. At the default rate 0 this is
 * always 1.0 (inert).
 */
export function fatigueFactor(stacks: number, rate: number = HEALTH.fatiguePerStack): number {
  return Math.max(0, 1 - rate * stacks);
}
