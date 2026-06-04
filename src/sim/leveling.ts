/**
 * E3 — level-up math. Two functions over the same `(baseStats,
 * growthRates, n)` shape, differing only in determinism:
 *
 *   simulateLevelUps — per-stat RNG roll vs growth rate, increment on
 *     success. Drives PLAYER recruits where dice rolls feel rewarding.
 *     Consumes 9 RNG draws per level (one per stat); byte-deterministic
 *     given the same RNG fork.
 *
 *   scaleStats        — deterministic `stat += round(growth × n)` per
 *     stat. Drives ENEMIES (no per-encounter RNG state to plumb,
 *     predictable difficulty curve). No RNG draws.
 *
 * Both are pure functions of their inputs — same inputs → same outputs,
 * no shared module state, no I/O. Stat order matches `UnitStats` field
 * order; this is the canonical iteration order for the RNG draws so
 * existing seeds stay byte-stable across re-imports.
 *
 * `n` is the number of level-ups to apply. A unit at level L was
 * produced by applying `n = L - 1` level-ups on top of the archetype's
 * baseStats — level 1 is the baseline.
 */

import type { RNG } from '../core/RNG';
import type { UnitStats } from './Unit';
import type { GrowthRates } from '../config/archetypes';

const STAT_KEYS: readonly (keyof UnitStats & keyof GrowthRates)[] = [
  'constitution',
  'strength',
  'ranged',
  'magic',
  'luck',
  // GP1: `agility`/`mobility` keep the 6th/7th draw positions the old
  // `speed`/`endurance` held, so existing seeds stay byte-stable.
  'agility',
  'mobility',
  // GP2: `defense` appended last so the other stats' draw positions are
  // undisturbed (the level-up RNG stream for con/str/.../mobility is unchanged;
  // only the new 8th draw is added).
  'defense',
  // H1: `power` appended last, same rationale — each existing stat keeps its
  // within-level draw position; only the new 9th draw is added. (The shared
  // `levelupRng` stream still advances one draw further per level-up, so
  // recruited rosters across a run differ from pre-H1 — expected for any stat
  // addition, covered by the snapshot version bump.)
  'power',
];

/**
 * Apply `n` simulated level-ups on top of `base`. Each level-up rolls
 * every stat independently against its growth rate; on success the stat
 * increments by 1. Order of draws is fixed by `STAT_KEYS` so the same
 * RNG fork produces the same outcome across runs.
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
    agility: out.agility,
    mobility: out.mobility,
    defense: out.defense,
    power: out.power,
  };
}

/**
 * Apply `n` deterministic level-ups on top of `base`. Each stat gains
 * `round(growth × n)` — the expected value of `simulateLevelUps` over
 * many trials, collapsed into a single closed-form scale. No RNG.
 */
export function scaleStats(base: UnitStats, growth: GrowthRates, n: number): UnitStats {
  return {
    constitution: base.constitution + Math.round(growth.constitution * n),
    strength: base.strength + Math.round(growth.strength * n),
    ranged: base.ranged + Math.round(growth.ranged * n),
    magic: base.magic + Math.round(growth.magic * n),
    luck: base.luck + Math.round(growth.luck * n),
    agility: base.agility + Math.round(growth.agility * n),
    mobility: base.mobility + Math.round(growth.mobility * n),
    defense: base.defense + Math.round(growth.defense * n),
    power: base.power + Math.round(growth.power * n),
  };
}
