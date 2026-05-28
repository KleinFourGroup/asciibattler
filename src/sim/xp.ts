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
  /**
   * Index into `Run.team` for the surviving player unit. Set by
   * `spawnTeam` at battle setup; carried verbatim into the award so
   * Run can bank XP into the right roster slot without keeping its
   * own unitId-to-rosterIndex map. Will be `null` only for the
   * pathological case of a player unit spawned without a rosterIndex
   * (e.g. directly via `World.spawnUnit` in a test) — Run skips those.
   */
  rosterIndex: number | null;
  damageDealt: number;
  xpGained: number;
}

/**
 * E4 — hybrid XP source. Each player unit's award:
 *
 *   xpGained = (alive ? xpFlatPerSurvivor : xpFlatPerFallen)
 *            + xpPerDamage × damageDealt
 *
 * The survivor flat slice is the participation reward (tank / healer /
 * cover unit gets the same baseline as the carry); the per-damage
 * slice rewards damage carries proportionally; the fallen flat slice
 * (default 0) is a separate knob — the roster persists across battles,
 * so a fallen unit isn't really *gone*, just sidelined for the next
 * battle.
 *
 * Caller passes `playerRosterIds` (every player unit that ever spawned
 * this battle — even reaped ones) keyed by unitId; `livingUnitIds`
 * (subset still alive at battle end); and the `damageDealt` ledger.
 * Iteration order is insertion order on `playerRosterIds`, which is
 * spawn order — stable for snapshot determinism.
 */
export function computeXpAwards(
  playerRosterIds: ReadonlyMap<number, number>,
  livingUnitIds: ReadonlySet<number>,
  damageDealt: ReadonlyMap<number, number>,
): XpAward[] {
  const out: XpAward[] = [];
  for (const [unitId, rosterIndex] of playerRosterIds) {
    const dmg = damageDealt.get(unitId) ?? 0;
    const alive = livingUnitIds.has(unitId);
    const flatSlice = alive ? LEVELING.xpFlatPerSurvivor : LEVELING.xpFlatPerFallen;
    out.push({
      unitId,
      rosterIndex,
      damageDealt: dmg,
      xpGained: Math.round(flatSlice + LEVELING.xpPerDamage * dmg),
    });
  }
  return out;
}
