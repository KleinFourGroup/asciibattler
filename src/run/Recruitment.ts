/**
 * The unit offers: the post-battle recruit offer, and a port's unit stock.
 *
 * Each offer slot is its own rarity-weighted draw: a tier, by the tier
 * weights over the tiers of the draft pool that hold archetypes (so an empty
 * tier takes no probability from the others), then a weighted pick among
 * that tier's archetypes (`archetypeWeights`, 1 when absent, the character's
 * overrides). The default pool is `DRAFTABLE_BY_TIER`, so an archetype
 * marked `draftable: false` never appears, and `Run` passes the character's
 * pools with its blacklist taken out. The same archetype may fill two slots
 * of one offer: rolled levels and growth tell them apart, and under weight
 * overrides a repeat is the character working.
 *
 * Recruits arrive at `level`, a number or a per-card `(rng) => number`.
 * `Run` passes a function, `round(avgTeamLevel) + recruitLevelBonus(...)`
 * capped at the level cap, so recruits scale with the team, and the bonus is
 * drawn for each card, so a lucky offer shows one over-leveled standout
 * rather than raising every card.
 *
 * Draws, all from the one `rng`: two a slot, the tier roll and the pick
 * within it (the tier roll is made even when one tier holds archetypes, so
 * the draw count does not depend on which tiers the catalog fills); then for
 * each card the level function's bonus, if a function is passed, and
 * `rollUnit`'s level-ups, one draw per growth stat for each level above 1.
 */

import type { RNG } from '../core/RNG';
import type { UnitTemplate } from '../sim/Unit';
import { rollUnit, DRAFTABLE_BY_TIER, type Archetype } from './../sim/archetypes';
import { RECRUITMENT } from '../config/recruitment';
import { RARITY_TIERS, type UnitRarity } from '../config/units';
import { LEVELING } from '../config/leveling';

/**
 * Each archetype's weight within its tier, 1 when absent. Positive, since
 * the character schema refuses 0 (a zero is spelled as a blacklist, which
 * takes the archetype out of `pools`); the sampler still throws on a pool
 * whose weights sum to 0.
 */
type ArchetypeWeights = Readonly<Partial<Record<Archetype, number>>>;

export function rollOffer(
  rng: RNG,
  size: number = RECRUITMENT.defaultOfferSize,
  level: number | ((rng: RNG) => number) = 1,
  pools: Readonly<Record<UnitRarity, readonly Archetype[]>> = DRAFTABLE_BY_TIER,
  archetypeWeights: ArchetypeWeights = {},
  // The tier weights: `Run` passes the run-stat fold's (where Patrician's
  // Seal zeroes common); the default is the config's.
  rarityWeights: Readonly<Record<UnitRarity, number>> = RECRUITMENT.rarityWeights,
  // Per-slot tier forcing (the Idol of Portunus, at the port): slot `i`
  // draws within `forcedTiers[i]`, its tier roll made and then overridden so
  // the draw count does not change; slots past the list roll as usual. A
  // forced tier with no archetypes falls back to the usual roll for that
  // slot, so a blacklist that empties the legendary pool cannot break the
  // port.
  forcedTiers: readonly UnitRarity[] = [],
): UnitTemplate[] {
  if (size <= 0) return [];
  // Every slot's archetype first, then the units: all the composition draws,
  // then each card's level and stat draws.
  const archetypes = Array.from({ length: size }, (_, i) =>
    rollArchetypeByRarity(rng, pools, rarityWeights, archetypeWeights, forcedTiers[i]),
  );
  // A function `level` is called for each card, on the shared `rng`, so the
  // bonus rolls for each offered unit; a number is one level for every card.
  return archetypes.map((a) => rollUnit(a, rng, typeof level === 'function' ? level(rng) : level));
}

/**
 * One rarity-weighted archetype draw: a weighted tier roll over the tiers
 * that hold archetypes, then a weighted pick within the tier
 * (`archetypeWeights`, 1 when absent). Two draws, always: the tier roll is
 * made even when one tier holds archetypes, so the draw count never depends
 * on which tiers the catalog fills.
 *
 * Pure, with the pools and weights passed in, so a test passes its own.
 * Throws when every tier with archetypes has weight 0, since a broken config
 * should fail loudly rather than fall back to uniform.
 */
export function rollArchetypeByRarity(
  rng: RNG,
  pools: Readonly<Record<UnitRarity, readonly Archetype[]>>,
  weights: Readonly<Record<UnitRarity, number>>,
  archetypeWeights: ArchetypeWeights = {},
  forceTier?: UnitRarity,
): Archetype {
  // A forced tier: the tier draw is made and then overridden, so a slot
  // draws twice whether forced or not, and the pick within the tier goes as
  // usual, under the character's weights. Forcing ignores the tier weights.
  // A forced tier with no archetypes falls through to the usual roll.
  if (forceTier !== undefined && pools[forceTier].length > 0) {
    rng.next();
    return pickWeighted(rng, pools[forceTier], archetypeWeights);
  }
  const tiers = RARITY_TIERS.filter((t) => pools[t].length > 0);
  const total = tiers.reduce((acc, t) => acc + weights[t], 0);
  if (total <= 0) {
    throw new Error('rollArchetypeByRarity: every non-empty tier has zero weight');
  }
  let roll = rng.next() * total;
  // The fallback for float rounding is the last tier with a positive
  // weight, not merely the last with archetypes: with a weight zeroed
  // (Patrician's Seal), a rounding edge could otherwise land in a tier that
  // holds no probability at all.
  let tier: UnitRarity = [...tiers].reverse().find((t) => weights[t] > 0)!;
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
 * A character's draft pool: `DRAFTABLE_BY_TIER` without the character's
 * blacklist (archetypes marked `draftable: false` are already out of the
 * table). Derived on each call from the character, so a loaded run derives
 * the same pool; an empty blacklist returns the shared table itself, so the
 * default character allocates nothing an offer.
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
 * One weighted draw from a pool with archetypes in it (1 for an absent
 * weight). With equal weights it reduces to `pool[floor(next() × len)]`,
 * `RNG.pick`'s mapping from the same single draw, since integer sums carry
 * no float drift (`Recruitment.test.ts`). A pool whose weights sum to 0
 * throws: a blacklist takes an
 * archetype out of the pool, so a weight of 0 here is a bug.
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
 * The roster's mean level, the basis of a recruit's level (`Run`). An empty
 * roster is 1, so a recruit onto an empty team arrives at level 1 plus its
 * bonus.
 */
export function avgTeamLevel(team: readonly UnitTemplate[]): number {
  return team.length === 0 ? 1 : team.reduce((sum, u) => sum + u.level, 0) / team.length;
}

/**
 * A recruit's geometric level bonus over `round(avgTeamLevel)`:
 * `P(+k) = (1 − chance) × chance^k`, each successful coin adding a level and
 * the first miss stopping. At the shipped 0.5 that is 50% +0, 25% +1,
 * 12.5% +2 and so on, so most recruits match the team's average and a few
 * stand out. At most `LEVELING.levelCap` coins, so a `chance` near 1 cannot
 * loop without end; the caller also caps the final level.
 */
export function recruitLevelBonus(rng: RNG, chance: number): number {
  let bonus = 0;
  while (bonus < LEVELING.levelCap && rng.next() < chance) bonus++;
  return bonus;
}
