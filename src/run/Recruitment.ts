/**
 * Post-victory unit-offer generation.
 *
 * F1 (draft-pool pull-forward): each offer is a set of DISTINCT
 * archetypes sampled uniformly from the full pool (`ALL_ARCHETYPES` —
 * all six: melee, ranged, rogue, healer, mage, catapult), so the four
 * E7 archetypes are draftable for playtest balancing instead of being
 * dev-only `?roster=` units. Distinctness replaces the old "guarantee
 * >=1 melee + >=1 ranged" reservation: with six archetypes an all-same
 * offer can't happen anyway, and three *different* choices is the point.
 * The sample is capped at the pool size (can't draw more distinct than
 * exist). Rarity tiers + floor-depth weighting + enemy-side
 * diversification land in Phase G — F1 is recruit-only at uniform weight
 * (enemies stay melee/ranged, so you draft the new archetypes before you
 * fight them).
 *
 * Recruits arrive at `level`, which is either a flat number OR a per-card
 * function `(rng) => number`. G4: Run computes the level off the team —
 * `round(avgTeamLevel) + recruitLevelBonus(...)` (replacing E3's `currentFloor`
 * basis) so recruits scale with the *team*, not the floor. Post-G5 the
 * geometric bonus is drawn INDEPENDENTLY per card (Run passes a function over a
 * shared `round(avgTeamLevel)` base), so a lucky offer surfaces one
 * over-leveled standout rather than boosting all three cards together. Each
 * card's `rollUnit` then runs the level-ups for that card's own level.
 *
 * Determinism: the partial Fisher–Yates below draws `min(size, pool)` ints
 * from `rng`; then per card the level function (if supplied) draws its bonus
 * and `rollUnit` draws `7 × (level − 1)` more — all off the same `rng`.
 * Widening the pool (F1) or changing the per-card draw (this post-G5 tweak)
 * shifts the draw sequence, so each deliberately resets the fuzz baseline.
 */

import type { RNG } from '../core/RNG';
import type { UnitTemplate } from '../sim/Unit';
import { rollUnit, ALL_ARCHETYPES, type Archetype } from './../sim/archetypes';
import { RECRUITMENT } from '../config/recruitment';
import { LEVELING } from '../config/leveling';

export function rollOffer(
  rng: RNG,
  size: number = RECRUITMENT.defaultOfferSize,
  level: number | ((rng: RNG) => number) = 1,
): UnitTemplate[] {
  if (size <= 0) return [];
  // A function `level` is resolved PER CARD (drawing off the shared `rng`), so
  // a geometric bonus rolls independently for each offered unit; a number is a
  // flat level applied to every card (the back-compat / explicit-input form).
  return sampleDistinctArchetypes(rng, size).map((a) =>
    rollUnit(a, rng, typeof level === 'function' ? level(rng) : level),
  );
}

/**
 * G4 — the geometric level bonus stacked on `round(avgTeamLevel)` for a
 * recruit. `P(+k) = (1 − chance) · chance^k`: each successful coin (prob
 * `chance`) adds a level, the first miss stops. With chance 0.5 that's
 * 50% +0 / 25% +1 / 12.5% +2 / … — most recruits match the team average,
 * with an occasional over-leveled standout. Bounded by `LEVELING.levelCap`
 * iterations so a pathological `chance ≈ 1` can't loop unboundedly (the
 * caller also clamps the final level to the cap).
 */
export function recruitLevelBonus(rng: RNG, chance: number): number {
  let bonus = 0;
  while (bonus < LEVELING.levelCap && rng.next() < chance) bonus++;
  return bonus;
}

/**
 * Sample up to `count` distinct archetypes uniformly from `ALL_ARCHETYPES`
 * via a partial Fisher–Yates shuffle: swap each of the first `n` slots
 * with a uniformly-random later-or-equal slot. Capped at the pool size.
 * Works on a fresh copy — never mutates the shared pool.
 */
function sampleDistinctArchetypes(rng: RNG, count: number): Archetype[] {
  const pool = [...ALL_ARCHETYPES];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = rng.int(i, pool.length - 1);
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, n);
}
