/**
 * Level-up math: two functions over the same `(baseStats, growthRates, n)`,
 * one rolled and one not.
 *
 * - `simulateLevelUps` rolls each stat against its growth rate and adds 1 on
 *   a success. The player's units level this way, where the dice feel
 *   rewarding; it draws one RNG value per stat per level.
 * - `scaleStats` adds `round(growth × n)` to each stat. Enemies and summons
 *   level this way: no RNG state to carry per encounter, and a predictable
 *   difficulty curve. It draws nothing.
 *
 * Both are pure. `n` is the number of level-ups: a unit at level L is its
 * archetype's base stats with `n = L − 1` applied, so level 1 is the base.
 */

import type { RNG } from '../core/RNG';
import type { UnitStats } from './Unit';
import type { GrowthRates } from '../config/units';

// The canonical stat order (combat, then dodge, then cadence, then meta): the
// order of the level-up draws and of the card's stat rows (`STAT_LABELS`), so
// the two read alike. Reordering it moves every level-up roll; snapshots key
// stats by name, so they are unaffected.
const STAT_KEYS: readonly (keyof UnitStats & keyof GrowthRates)[] = [
  'constitution',
  'strength',
  'ranged',
  'magic',
  'luck',
  'defense',
  'precision',
  'evasion',
  'speed',
  'mobility',
  'power',
];

/**
 * `n` rolled level-ups on top of `base`. Each level-up rolls every stat on its
 * own against its growth rate and adds 1 on a success, drawing in `STAT_KEYS`
 * order, so the same stream gives the same result.
 */
export function simulateLevelUps(
  base: UnitStats,
  growth: GrowthRates,
  n: number,
  rng: RNG,
): UnitStats {
  const out: Record<keyof UnitStats, number> = { ...base };
  for (let level = 0; level < n; level++) {
    for (const key of STAT_KEYS) {
      if (rng.next() < growth[key]) {
        out[key] += 1;
      }
    }
  }
  return {
    constitution: out.constitution,
    strength: out.strength,
    ranged: out.ranged,
    magic: out.magic,
    luck: out.luck,
    defense: out.defense,
    precision: out.precision,
    evasion: out.evasion,
    speed: out.speed,
    mobility: out.mobility,
    power: out.power,
  };
}

/**
 * `n` level-ups on top of `base` with no roll: each stat gains
 * `round(growth × n)`, the expected value of `simulateLevelUps`.
 */
export function scaleStats(base: UnitStats, growth: GrowthRates, n: number): UnitStats {
  return {
    constitution: base.constitution + Math.round(growth.constitution * n),
    strength: base.strength + Math.round(growth.strength * n),
    ranged: base.ranged + Math.round(growth.ranged * n),
    magic: base.magic + Math.round(growth.magic * n),
    luck: base.luck + Math.round(growth.luck * n),
    defense: base.defense + Math.round(growth.defense * n),
    precision: base.precision + Math.round(growth.precision * n),
    evasion: base.evasion + Math.round(growth.evasion * n),
    speed: base.speed + Math.round(growth.speed * n),
    mobility: base.mobility + Math.round(growth.mobility * n),
    power: base.power + Math.round(growth.power * n),
  };
}
