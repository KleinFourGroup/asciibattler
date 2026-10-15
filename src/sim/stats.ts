/**
 * A unit's values computed from its stats, and the curves abilities share. Pure,
 * no RNG; the knobs are in `config/stats.json`.
 *
 * The two cadence stats drive cooldowns through separate knobs so they can
 * diverge: `mobility` sets the move cooldown (`mobilityCdPerStat`,
 * `mobilityMinCdScale`) and `speed` an ability's cadence (`speedCdPerStat`,
 * `speedMinCdScale`). Both are signed: a negative value makes a unit slower
 * than the baseline, and the floor caps only the fast side. Every unit walks
 * from the one `STATS.baseMoveCooldownSeconds`, so a slow walker is one with
 * low or negative mobility.
 *
 * Cadence is not derived per unit: a unit can carry several abilities with
 * different timings, so `attackCooldownTicksFor` resolves an ability's
 * `cooldownSeconds` against the unit's `speed` when it proposes. Nor is the
 * crit chance: `critChanceFor` resolves it per damage op.
 *
 * The 1-tick floors keep a tuning that rounds to 0 from letting a unit act
 * every tick; the shipped config never reaches them.
 */

import { secondsToTicks } from '../config';
import { STATS } from '../config/stats';
import { UNIT_DEFS } from '../config/units';
import type { UnitArchetype, UnitDerived, UnitStats } from './Unit';

export function deriveStats(stats: UnitStats, attackRange: number): UnitDerived {
  return {
    maxHp: Math.max(1, Math.round(STATS.hpPerConstitution * stats.constitution)),
    moveCooldownTicks: Math.max(
      1,
      secondsToTicks(
        STATS.baseMoveCooldownSeconds *
          cooldownScale(stats.mobility, STATS.mobilityCdPerStat, STATS.mobilityMinCdScale),
      ),
    ),
    attackRange,
  };
}

/**
 * An ability's cadence in ticks for a unit: its `cooldownSeconds`
 * (`config/abilities.json`) shrunk by the unit's `speed` on the cooldown curve,
 * with the speed knobs, so a quicker unit strikes more often. At least 1 tick,
 * so no tuning gives a cadence of every tick.
 */
export function attackCooldownTicksFor(cooldownSeconds: number, speed: number): number {
  return Math.max(
    1,
    secondsToTicks(
      cooldownSeconds * cooldownScale(speed, STATS.speedCdPerStat, STATS.speedMinCdScale),
    ),
  );
}

/**
 * A phase's seconds scaled by the caster's `speed` on the cadence's curve and
 * knobs (`attackCooldownTicksFor`), for a fixed phase that `scalesWithSpeed`: a
 * charged spell's wind-up then quickens with the cadence, so speed hastens the
 * whole cast and not only the elastic `recovery`. Seconds in, seconds out; the
 * caller converts with `secondsToTicks`. Not floored at 1 tick, since a phase
 * may be 0 ticks, an instant boundary.
 */
export function speedScaledSeconds(seconds: number, speed: number): number {
  return seconds * cooldownScale(speed, STATS.speedCdPerStat, STATS.speedMinCdScale);
}

/**
 * The derived values of a neutral (a wall, half cover, rubble): the given max HP,
 * and no movement or range.
 */
export function inertDerived(maxHp: number): UnitDerived {
  return {
    maxHp,
    moveCooldownTicks: 0,
    attackRange: 0,
  };
}

/**
 * The value of the archetype's `damageStat` (`config/units.json`), or 0 when it
 * has none (the healer, the shaman, every neutral). It is for display: a damage
 * op adds its own `scaling` stat (`resolveScalars.ts`), which can differ.
 *
 * It reads `UNIT_DEFS` when called, not at module load, since stats.ts sits in
 * the `config/units` and sim import cycle, where a read at load would find the
 * catalog not yet built.
 */
export function damageStatFor(archetype: UnitArchetype, stats: UnitStats): number {
  const key = UNIT_DEFS[archetype]?.damageStat;
  return key ? stats[key] : 0;
}

/**
 * The chance a damage op authored `evadable` hits, rolled once on `combatRng` in
 * `World.applyDamage`. The ability's `accuracy` is the base; the attacker's
 * `precision` raises it and the target's `evasion` lowers it (subtractive, as in
 * Fire Emblem), clamped to the configured floor and cap. With equal precision
 * and evasion the two terms cancel and the hit sits at the ability's `accuracy`.
 * The floor keeps a weak attacker from being shut out by an evasive target, as
 * `minDamage` keeps a hit from doing nothing. Pure.
 */
export function hitChanceFor(accuracy: number, precision: number, evasion: number): number {
  const raw =
    accuracy +
    precision * STATS.hitChancePerPrecision -
    evasion * STATS.dodgeChancePerEvasion;
  return Math.min(STATS.hitChanceCap, Math.max(STATS.hitChanceFloor, raw));
}

/**
 * The crit chance of a `critable` damage op: its `critBase` plus the wielder's
 * `luck × critPerLuck`, clamped to `[0, critCap]`. Pure; the damage op rolls
 * `combatRng` against it once. A damage op that is not `critable` has a chance
 * of 0 and does not call this.
 */
export function critChanceFor(critBase: number, luck: number): number {
  const raw = critBase + luck * STATS.critPerLuck;
  return Math.min(STATS.critCap, Math.max(0, raw));
}

/**
 * The cooldown curve, over its slope (`perStat`) and fast-side floor
 * (`minScale`), so the move axis and the cadence axis take their own knobs.
 * `max(minScale, …)` caps only the fast side: a negative `stat` gives a scale
 * above 1, slower than the baseline, which wins the `max`, so the slow side is
 * unbounded.
 */
function cooldownScale(stat: number, perStat: number, minScale: number): number {
  return Math.max(minScale, 1 - stat * perStat);
}

/** A stat block of zeros, for the neutrals, which have no stats; one frozen
 *  instance shared by every spawn. */
export const ZERO_STATS: UnitStats = Object.freeze({
  constitution: 0,
  strength: 0,
  ranged: 0,
  magic: 0,
  luck: 0,
  defense: 0,
  precision: 0,
  evasion: 0,
  speed: 0,
  mobility: 0,
  power: 0,
});
