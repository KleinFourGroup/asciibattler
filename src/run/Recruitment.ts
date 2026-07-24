/**
 * Post-victory unit-offer generation.
 *
 * §61c — each offer slot is an INDEPENDENT rarity-weighted draw: roll a tier
 * (the `RECRUITMENT.rarityWeights` config, renormalized over the NON-EMPTY
 * tiers of the draft pool — an unpopulated tier costs no probability mass),
 * then a WEIGHTED pick among that tier's draftable archetypes (§63b:
 * `archetypeWeights`, absent = 1 — the character weight-override seam; the
 * default pool is `DRAFTABLE_BY_TIER`, so the §29-close `draftable:false`
 * exclusions still never appear, and §63c swaps in blacklist-filtered pools). Duplicate
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

/**
 * §63b — per-archetype within-tier weights (absent key = 1, the spec's
 * default). Strictly positive by authoring contract (characters.ts forbids 0
 * — a zero is spelled "blacklist", which removes the archetype from `pools`
 * instead); the sampler still guards a zero-total pool loudly.
 */
export type ArchetypeWeights = Readonly<Partial<Record<Archetype, number>>>;

export function rollOffer(
  rng: RNG,
  size: number = RECRUITMENT.defaultOfferSize,
  level: number | ((rng: RNG) => number) = 1,
  pools: Readonly<Record<UnitRarity, readonly Archetype[]>> = DRAFTABLE_BY_TIER,
  archetypeWeights: ArchetypeWeights = {},
): UnitTemplate[] {
  if (size <= 0) return [];
  // Sample every slot's archetype FIRST, then materialize the units — keeps the
  // two-phase draw shape the F1 sampler had (all composition draws, then the
  // per-card level/stat draws). §63b: `pools`/`archetypeWeights` default to the
  // global draft pool at uniform weight — §63c passes the character-derived
  // pair (blacklist-filtered pools + the character's overrides), and the port
  // stock inherits through this same signature by construction.
  const archetypes = Array.from({ length: size }, () =>
    rollArchetypeByRarity(rng, pools, RECRUITMENT.rarityWeights, archetypeWeights),
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
 *
 * §63b — the within-tier pick is WEIGHTED (`archetypeWeights`, absent key = 1;
 * the character weight-override seam). Still exactly 1 draw: the cumulative
 * walk consumes one `next()` like `rng.pick` did, and with all-default weights
 * it selects the IDENTICAL index (`floor(next()·len)` — the `RNG.pick`/`int`
 * mapping), so a no-override draw is byte-identical to the pre-63b uniform
 * pick. The kickoff audit's identity proof; pinned in the test file.
 */
export function rollArchetypeByRarity(
  rng: RNG,
  pools: Readonly<Record<UnitRarity, readonly Archetype[]>>,
  weights: Readonly<Record<UnitRarity, number>>,
  archetypeWeights: ArchetypeWeights = {},
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
  return pickWeighted(rng, pools[tier], archetypeWeights);
}

/**
 * §63c — the character-filtered draft pool: `DRAFTABLE_BY_TIER` minus the
 * character's blacklist ADDITIONS (the global `draftable:false` exclusions are
 * already out by construction). Derived at call time from the character def
 * (derive-don't-cache — a rehydrated run recomputes identically), returning
 * the shared table untouched on the empty-blacklist fast path so the default
 * character allocates nothing per offer.
 */
export function draftPoolsFor(
  blacklist: readonly Archetype[],
): Readonly<Record<UnitRarity, readonly Archetype[]>> {
  if (blacklist.length === 0) return DRAFTABLE_BY_TIER;
  const excluded = new Set(blacklist);
  const filter = (pool: readonly Archetype[]): readonly Archetype[] =>
    pool.filter((a) => !excluded.has(a));
  return {
    common: filter(DRAFTABLE_BY_TIER.common),
    uncommon: filter(DRAFTABLE_BY_TIER.uncommon),
    rare: filter(DRAFTABLE_BY_TIER.rare),
    legendary: filter(DRAFTABLE_BY_TIER.legendary),
  };
}

/**
 * §63b — one weighted draw from a non-empty pool (absent weight = 1). The
 * equal-weights case reduces to `pool[floor(next()·len)]` — exactly
 * `RNG.pick`'s mapping off the same single draw (integer cumulative sums, no
 * float drift), which is what keeps default draft streams byte-identical
 * across the §63 landing. A zero-total pool throws (a blacklist should have
 * REMOVED the archetype from the pool; weight 0 reaching here is a bug).
 */
function pickWeighted(rng: RNG, pool: readonly Archetype[], weights: ArchetypeWeights): Archetype {
  const total = pool.reduce((acc, a) => acc + (weights[a] ?? 1), 0);
  if (total <= 0) {
    throw new Error('pickWeighted: pool has zero total weight');
  }
  let roll = rng.next() * total;
  for (const a of pool) {
    roll -= weights[a] ?? 1;
    if (roll < 0) return a;
  }
  return pool[pool.length - 1]!;
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
