/**
 * The XP curve and the battle XP awards; the knobs are in
 * `config/leveling.json`.
 *
 * `xpToNext(level)` is the XP a unit at `level` must bank to reach
 * `level + 1`: `round(baseXp × level^exponent)`. At or past
 * `LEVELING.levelCap` it returns `Infinity`, and Run's level-up loop
 * (`bankXpAwards`) drops any XP banked at the cap. The curve's knobs
 * (`baseXp`, `exponent`) are read only here, so a new curve shape is a
 * change to this file alone.
 */

import { LEVELING } from '../config/leveling';

export function xpToNext(level: number): number {
  if (level >= LEVELING.levelCap) return Infinity;
  return Math.round(LEVELING.baseXp * Math.pow(level, LEVELING.exponent));
}

/** Whether `level` is at or past the level cap. */
export function isAtLevelCap(level: number): boolean {
  return level >= LEVELING.levelCap;
}

/**
 * The integer level to show the player. Every shipped spawn path stamps a
 * whole level, so this is a no-op on them; it rounds at the display
 * boundary so that a fractional level, which `scaleStats` accepts, never
 * shows as "Lv 1.5".
 */
export function displayLevel(level: number): number {
  return Math.round(level);
}

/**
 * The XP bar's display model, kept free of the DOM so it is unit-testable.
 * `UnitCard`'s `full` mode renders `fraction` as the fill width and `need` in
 * the label, and reads MAX at the cap.
 */
interface XpProgress {
  readonly atCap: boolean;
  /** XP required to reach the next level (the bar's denominator); 0 at the cap. */
  readonly need: number;
  /** `xp / need` clamped to [0, 1], so XP banked past the threshold (a pending
   *  promotion) never overflows the bar; 1 at the cap. */
  readonly fraction: number;
}

export function xpProgress(xp: number, level: number): XpProgress {
  if (isAtLevelCap(level)) return { atCap: true, need: 0, fraction: 1 };
  const need = xpToNext(level);
  const fraction = need > 0 ? Math.max(0, Math.min(1, xp / need)) : 1;
  return { atCap: false, need, fraction };
}

interface XpAward {
  unitId: number;
  /**
   * The unit's roster slot, an index into `Run.team`, stamped at spawn
   * (`spawnTeam` passes the template's `rosterIndex`), so Run banks XP into
   * the right slot without its own unitId map. Never null in
   * `computeXpAwards`'s output: World records only player units that carry
   * a slot, so a unit spawned without one earns no award.
   */
  rosterIndex: number | null;
  damageDealt: number;
  xpGained: number;
}

/**
 * Each player unit's XP for one battle:
 *
 *   xpGained = (alive ? xpFlatPerSurvivor : xpFlatPerFallen)
 *            + xpPerDamage  × damageDealt
 *            + xpPerHealing × utilityDone
 *
 * The flat slice rewards taking part, so a tank or healer keeps the carry's
 * baseline; the damage and healing slices reward contribution, so a healer
 * that dealt no damage still levels. The fallen slice is its own knob
 * because the roster persists across battles: a fallen unit isn't really
 * gone, just sidelined for the next battle.
 *
 * Inputs:
 * - `playerRosterIds` — unitId → roster slot for every player unit with a
 *   slot that spawned this battle, reaped ones included.
 * - `livingUnitIds` — the units still alive at battle end.
 * - `damageDealt` — the damage ledger, summoners credited a share of their
 *   summons' damage.
 * - `utilityDone` — effective HP healed, overheal excluded
 *   (`World.recordHealing`).
 *
 * Awards follow `playerRosterIds`' insertion order, which is spawn order, so
 * the output is deterministic.
 */
export function computeXpAwards(
  playerRosterIds: ReadonlyMap<number, number>,
  livingUnitIds: ReadonlySet<number>,
  damageDealt: ReadonlyMap<number, number>,
  utilityDone: ReadonlyMap<number, number>,
): XpAward[] {
  const out: XpAward[] = [];
  for (const [unitId, rosterIndex] of playerRosterIds) {
    const dmg = damageDealt.get(unitId) ?? 0;
    const util = utilityDone.get(unitId) ?? 0;
    const alive = livingUnitIds.has(unitId);
    const flatSlice = alive ? LEVELING.xpFlatPerSurvivor : LEVELING.xpFlatPerFallen;
    out.push({
      unitId,
      rosterIndex,
      damageDealt: dmg,
      xpGained: Math.round(
        flatSlice + LEVELING.xpPerDamage * dmg + LEVELING.xpPerHealing * util,
      ),
    });
  }
  return out;
}
