/**
 * Recruitment / starting-team knobs. The starting team is fixed-composition
 * (3M+2R for MVP); the offer size determines how many recruit cards
 * appear post-victory.
 *
 * G4: `recruitBonusChance` is the geometric "promotion" coin for recruit
 * levels. A recruit arrives at `round(avgTeamLevel) + bonus`, where the bonus
 * is the number of consecutive successes at probability `recruitBonusChance`
 * (0.5 → 50% +0, 25% +1, 12.5% +2, …). Lower it for flatter recruits, raise it
 * for the occasional over-leveled draw.
 *
 * `startingLevel` is the level every unit in the canonical starting roster
 * begins at (default 1). Raising it lifts the whole level scale of a run so
 * that a proportionally-weaker enemy swarm is meaningfully weaker in ABSOLUTE
 * terms (at level 1–4 a 30% handicap is a rounding error; at level 8–12 it's a
 * real gap). The `?roster=` dev override carries its own explicit per-unit
 * levels and is unaffected.
 *
 * Source of truth at `config/recruitment.json`.
 */

import { z } from 'zod';
import recruitmentJson from '../../config/recruitment.json';
import type { UnitRarity } from './units';

/**
 * §61c — the global rarity tier weights (the kickoff's 6/3/2/1 seed values;
 * TUNED only at the §68 balance pass). The tier roll renormalizes these over
 * the NON-EMPTY tiers of the draftable pool, so an unpopulated tier costs no
 * probability mass. Zero is legal per tier ("tier off" — and the §64
 * no-commons daemon's likely fold shape); all-zero over the non-empty tiers is
 * a config error the sampler throws on. Weights are within-RUN global — the
 * §63 character overrides are WITHIN-tier archetype weights, never these.
 */
const RarityWeightsSchema = z.object({
  common: z.number().nonnegative(),
  uncommon: z.number().nonnegative(),
  rare: z.number().nonnegative(),
  legendary: z.number().nonnegative(),
});

const RecruitmentSchema = z.object({
  startingMelee: z.number().int().nonnegative(),
  startingRanged: z.number().int().nonnegative(),
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
