/**
 * E1 — derive per-unit computed values from base stats + archetype
 * context. Pure functions: same inputs → same outputs, no RNG. Crit
 * RNG rolls happen at action-start time inside AttackAction, NOT
 * here — `critChance` is just the probability that gets fed into that
 * roll.
 *
 * Formula sources (`config/stats.json`):
 *
 *   maxHp           = max(1, round(hpPerConstitution * constitution))
 *   critChance      = min(critCap, luck * critPerLuck)
 *   attackCooldown  = max(1, secondsToTicks(baseAtkCD * cooldownScale(speed)))
 *   moveCooldown    = max(1, secondsToTicks(baseMoveCD * cooldownScale(endurance)))
 *   cooldownScale s = max(minCdScale, 1 - s * cdPerStat)
 *   attackRange     = per-archetype primitive, passed through verbatim
 *
 * The 1-tick cooldown floor catches future tuning where `minCdScale`
 * or base values drop low enough to round to 0; at default config it's
 * unreachable.
 *
 * E3: `baseMoveCooldownSeconds` is now overridable per archetype. The
 * argument defaults to the global `STATS.baseMoveCooldownSeconds`
 * (which most archetypes still inherit); slow-walking archetypes can
 * pass a higher value to lengthen their move CD without touching the
 * global. Attack CD does NOT have an analogous override here on
 * purpose — attack timing belongs on the Ability layer (one unit can
 * carry several abilities with different timings).
 *
 * `inertDerived` is the environment-entity path (walls / half-cover) —
 * non-combatants need a maxHp anchor for HP display and the future
 * destructibility plumbing, but no cooldowns / crit / range.
 *
 * `basicAttackDamage` answers "which stat drives this unit's basic
 * strike?" — melee → strength, ranged → ranged. Lives here (not inside
 * AttackBehavior) so E2's Ability system can generalize the lookup to
 * a per-ability stat tag without duplicating the per-archetype switch.
 */

import { secondsToTicks } from '../config';
import { STATS } from '../config/stats';
import type { Unit, UnitDerived, UnitStats } from './Unit';

export function deriveStats(
  stats: UnitStats,
  attackRange: number,
  baseMoveCooldownSeconds: number = STATS.baseMoveCooldownSeconds,
): UnitDerived {
  return {
    maxHp: Math.max(1, Math.round(STATS.hpPerConstitution * stats.constitution)),
    critChance: Math.min(STATS.critCap, stats.luck * STATS.critPerLuck),
    attackCooldownTicks: Math.max(
      1,
      secondsToTicks(STATS.baseAttackCooldownSeconds * cooldownScale(stats.speed)),
    ),
    moveCooldownTicks: Math.max(
      1,
      secondsToTicks(baseMoveCooldownSeconds * cooldownScale(stats.endurance)),
    ),
    attackRange,
  };
}

/**
 * Environment entity derived values. Caller passes the desired maxHp;
 * the rest are zero/no-op. Walls + half-cover go through this path.
 */
export function inertDerived(maxHp: number): UnitDerived {
  return {
    maxHp,
    critChance: 0,
    attackCooldownTicks: 0,
    moveCooldownTicks: 0,
    attackRange: 0,
  };
}

/**
 * E1 — basic-strike damage source. Melee strikes use `strength`; ranged
 * strikes use `ranged`. Environment entities don't strike (their team
 * has no behaviors), but the 0 fallback is here for type-completeness
 * and as a guard if a future code path ever asks.
 */
export function basicAttackDamage(unit: Unit): number {
  switch (unit.archetype) {
    case 'melee':
      return unit.stats.strength;
    case 'ranged':
      return unit.stats.ranged;
    case 'environment':
      return 0;
  }
}

function cooldownScale(stat: number): number {
  return Math.max(STATS.minCdScale, 1 - stat * STATS.cdPerStat);
}

/**
 * All-zero stat block. Used for environment entities (walls,
 * half-cover) — they have no meaningful stats, but UnitStats is a
 * required init field. Kept as a single shared frozen literal so
 * spawn sites don't reconstruct it.
 */
export const ZERO_STATS: UnitStats = Object.freeze({
  constitution: 0,
  strength: 0,
  ranged: 0,
  magic: 0,
  luck: 0,
  speed: 0,
  endurance: 0,
});
