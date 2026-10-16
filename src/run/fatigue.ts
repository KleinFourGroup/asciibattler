/**
 * Fatigue, a debuff on a unit fielded again in the same encounter. Its stacks
 * are the unit's earlier deployments this encounter (`Run.deploymentCounts`,
 * read before the turn's own deployment is recorded, so a unit's first turn
 * takes none), and the `Fatigued` status scales its constitution, its
 * starting HP, by `1 − rate × stacks`. The rule, and why it scales
 * constitution and not power: `fatiguePerStack` in `config/health.ts`.
 *
 * The status is one instance a turn: magnitude `min(stacks, maxStacks)` over
 * a per-stack mul of `1 − rate`, which the stat fold (`1 + (mul − 1) × m`,
 * `statusEffects.ts`) makes exactly `1 − rate × stacks`. `Unit`'s constructor
 * clamps `currentHp` to the derived maximum after seeding, so a fatigued unit
 * never spawns over it.
 */

import { HEALTH } from '../config/health';
import type { StatusEffect } from '../sim/statusEffects';

/** The `Fatigued` status's key. */
export const FATIGUE_KEY = 'fatigued';

/**
 * The `Fatigued` status for a unit fielded with `stacks` earlier deployments
 * this encounter, or `null` when it would do nothing (a rate or stack count
 * of 0), so the shipped config seeds no effect at all. `rate` and
 * `maxStacks` default to `HEALTH`'s; a test passes its own.
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
