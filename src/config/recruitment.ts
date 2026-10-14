/**
 * The recruit offer after a win, and the level a run's units start at.
 * Source of truth at `config/recruitment.json`; a character's starting
 * roster is in `config/characters.json`.
 *
 * - `startingLevel` — the level of every unit in a starting roster. A higher
 *   scale makes a proportional handicap on the enemy matter: 30% of a
 *   level-2 unit is a rounding error, 30% of a level-10 unit is a real gap.
 *   The `?roster=` dev override gives its own levels.
 * - `defaultOfferSize` — how many recruit cards a win offers, the base of
 *   the `recruitOfferSize` run stat.
 * - `recruitBonusChance` — a recruit arrives at `round(avgTeamLevel) +
 *   bonus`, the bonus being the count of consecutive successes at this
 *   chance (at 0.5: +0 half the time, +1 a quarter, +2 an eighth). Lower
 *   flattens recruits; higher makes an over-levelled one likelier.
 * - `rarityWeights` — the tier weights, below.
 */

import { z } from 'zod';
import recruitmentJson from '../../config/recruitment.json';
import type { UnitRarity } from './units';

/**
 * The rarity tiers' weights for the recruit roll, the bases of the
 * `rarityWeight*` run stats. The roll renormalizes them over the tiers the
 * draftable pool populates, so an empty tier costs no probability. A tier
 * may weigh 0 (off); all zero over the populated tiers is a config error the
 * sampler throws on. A character's weights are archetype weights within a
 * tier, never these.
 */
const RarityWeightsSchema = z.object({
  common: z.number().nonnegative(),
  uncommon: z.number().nonnegative(),
  rare: z.number().nonnegative(),
  legendary: z.number().nonnegative(),
});

const RecruitmentSchema = z.object({
  startingLevel: z.number().int().positive(),
  defaultOfferSize: z.number().int().positive(),
  recruitBonusChance: z.number().min(0).max(1),
  rarityWeights: RarityWeightsSchema,
});

// Compile-time exhaustiveness: the schema's keys must cover every RARITY_TIER
// (a new tier fails this assignment, not a mid-run sampler lookup).
const _rarityWeightsCoverTiers: Record<UnitRarity, number> = {} as z.infer<
  typeof RarityWeightsSchema
>;
void _rarityWeightsCoverTiers;

export type RecruitmentConfig = z.infer<typeof RecruitmentSchema>;

export const RECRUITMENT: RecruitmentConfig = RecruitmentSchema.parse(recruitmentJson);
