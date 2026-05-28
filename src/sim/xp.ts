/**
 * E4 — XP curve. One module, one formula, easy to swap.
 *
 * `xpToNext(level)` returns the XP a unit at `level` must accumulate to
 * advance to `level + 1`. At the cap (level === LEVELING.levelCap) the
 * function returns `Infinity` — Run's level-up loop treats that as "no
 * further progression," so banked XP past the cap is silently dropped
 * (the cap is the asymptote enforcer per the ROADMAP E4 decision).
 *
 * Default shape is classic-quadratic-per-level (`baseXp * L^2`). Other
 * shapes (D&D linear-per-level, exponential 1.5, hand-authored table)
 * swap in here. The formula isolation is the contract — callers never
 * reach for `LEVELING.baseXp` directly outside this file.
 */

import { LEVELING } from '../config/leveling';

export function xpToNext(level: number): number {
  if (level >= LEVELING.levelCap) return Infinity;
  return Math.round(LEVELING.baseXp * Math.pow(level, LEVELING.exponent));
}

/**
 * Returns `true` if the unit is already at the level cap. Surfaced as a
 * helper so callers don't have to know the cap field name.
 */
export function isAtLevelCap(level: number): boolean {
  return level >= LEVELING.levelCap;
}

export interface XpAward {
  unitId: number;
  damageDealt: number;
  xpGained: number;
}

/**
 * E4 — hybrid XP source. Each surviving unit's award:
 *
 *   xpGained = LEVELING.xpFlatPerSurvivor + LEVELING.xpPerDamage × damageDealt
 *
 * The flat slice is the participation reward (tank / healer / cover
 * unit gets the same baseline as the carry); the per-damage slice
 * rewards damage carries proportionally. The caller is responsible for
 * passing only the units that should be awarded (typically surviving
 * player units on a player victory). Returns an empty array if `units`
 * is empty.
 */
export function computeXpAwards(
  units: readonly { id: number }[],
  damageDealt: ReadonlyMap<number, number>,
): XpAward[] {
  const out: XpAward[] = [];
  for (const u of units) {
    const dmg = damageDealt.get(u.id) ?? 0;
    out.push({
      unitId: u.id,
      damageDealt: dmg,
      xpGained: Math.round(LEVELING.xpFlatPerSurvivor + LEVELING.xpPerDamage * dmg),
    });
  }
  return out;
}
