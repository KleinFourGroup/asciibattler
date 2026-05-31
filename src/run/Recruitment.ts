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
 * E3: recruits arrive at `level` (defaults to 1). Run threads
 * `currentFloor` through so a floor-N recruit gets N simulated level-ups
 * via `rollUnit` — keeps recruits in pace with the enemies on the floor
 * the player just cleared.
 *
 * Determinism: the partial Fisher–Yates below draws `min(size, pool)`
 * ints from `rng`, then each `rollUnit` draws `7 × (level − 1)` more.
 * Widening the pool changes the draw sequence, so F1 deliberately resets
 * the fuzz baseline (the E7 steps kept pools unchanged precisely to
 * avoid this; F1 spends the reset on purpose).
 */

import type { RNG } from '../core/RNG';
import type { UnitTemplate } from '../sim/Unit';
import { rollUnit, ALL_ARCHETYPES, type Archetype } from './../sim/archetypes';
import { RECRUITMENT } from '../config/recruitment';

export function rollOffer(
  rng: RNG,
  size: number = RECRUITMENT.defaultOfferSize,
  level: number = 1,
): UnitTemplate[] {
  if (size <= 0) return [];
  return sampleDistinctArchetypes(rng, size).map((a) => rollUnit(a, rng, level));
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
