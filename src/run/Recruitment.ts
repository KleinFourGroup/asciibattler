/**
 * Post-victory unit-offer generation.
 *
 * §61c — each offer slot is an INDEPENDENT rarity-weighted draw: roll a tier
 * (the `RECRUITMENT.rarityWeights` config, renormalized over the NON-EMPTY
 * tiers of the draft pool — an unpopulated tier costs no probability mass),
 * then uniform among that tier's draftable archetypes (`DRAFTABLE_BY_TIER` —
 * the §29-close `draftable:false` exclusions still never appear; the §63
 * character weight overrides layer WITHIN the tier, not here). Duplicate
 * archetypes in one offer are ALLOWED by design (kickoff lock: rolled levels +
 * growth differentiate, and under weight overrides dupes ARE the character
 * identity working; the named fallback if playtest shows degenerate offers is
 * one resample per duplicate — deliberately not pre-built). This replaced F1's
 * distinct-sample partial Fisher–Yates, so `size` is no longer capped at the
 * pool size.
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
 * Determinism: the sampler draws exactly 2 per slot (tier roll + within-tier
 * pick — the tier roll happens even with one non-empty tier, keeping the draw
 * shape independent of the catalog's tier occupancy); then per card the level
 * function (if supplied) draws its bonus and `rollUnit` draws `9 × (level − 1)`
 * more — all off the same `rng`. F1's distinct sampler drew 1 per slot, so §61c
 * deliberately reset the fuzz baseline (the round's first predicted stream
 * break).
 */

import type { RNG } from '../core/RNG';
import type { UnitTemplate } from '../sim/Unit';
import { rollUnit, DRAFTABLE_BY_TIER, type Archetype } from './../sim/archetypes';
import { RECRUITMENT } from '../config/recruitment';
import { RARITY_TIERS, type UnitRarity } from '../config/units';
import { LEVELING } from '../config/leveling';

export function rollOffer(
  rng: RNG,
  size: number = RECRUITMENT.defaultOfferSize,
  level: number | ((rng: RNG) => number) = 1,
): UnitTemplate[] {
  if (size <= 0) return [];
  // Sample every slot's archetype FIRST, then materialize the units — keeps the
  // two-phase draw shape the F1 sampler had (all composition draws, then the
  // per-card level/stat draws).
  const archetypes = Array.from({ length: size }, () =>
    rollArchetypeByRarity(rng, DRAFTABLE_BY_TIER, RECRUITMENT.rarityWeights),
  );
  // A function `level` is resolved PER CARD (drawing off the shared `rng`), so
  // a geometric bonus rolls independently for each offered unit; a number is a
  // flat level applied to every card (the back-compat / explicit-input form).
  return archetypes.map((a) => rollUnit(a, rng, typeof level === 'function' ? level(rng) : level));
}

/**
 * §61c — one rarity-weighted archetype draw: a weighted tier roll over the
 * non-empty tiers (renormalization = weighting only what exists), then a
 * uniform pick within the tier. Exactly 2 RNG draws, always — the tier roll is
 * taken even when only one tier is populated, so the draw shape never depends
 * on catalog occupancy (61d's tier assignments shift WHICH archetypes appear,
 * not how many draws happen).
 *
 * Pure, config-parameterized core (the `unitPriceFor` discipline): `rollOffer`
 * binds the live pools + weights; tests drive synthetic ones. Throws when every
 * non-empty tier carries zero weight — a broken config should be loud, not
 * silently uniform.
 */
export function rollArchetypeByRarity(
  rng: RNG,
  pools: Readonly<Record<UnitRarity, readonly Archetype[]>>,
  weights: Readonly<Record<UnitRarity, number>>,
): Archetype {
  const tiers = RARITY_TIERS.filter((t) => pools[t].length > 0);
  const total = tiers.reduce((acc, t) => acc + weights[t], 0);
  if (total <= 0) {
    throw new Error('rollArchetypeByRarity: every non-empty tier has zero weight');
  }
  let roll = rng.next() * total;
  let tier: UnitRarity = tiers[tiers.length - 1]!;
  for (const t of tiers) {
    roll -= weights[t];
    if (roll < 0) {
      tier = t;
      break;
    }
  }
  return rng.pick(pools[tier]);
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
