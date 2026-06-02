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
 * Source of truth at `config/recruitment.json`.
 */

import { z } from 'zod';
import recruitmentJson from '../../config/recruitment.json';

const RecruitmentSchema = z.object({
  startingMelee: z.number().int().nonnegative(),
  startingRanged: z.number().int().nonnegative(),
  defaultOfferSize: z.number().int().positive(),
  recruitBonusChance: z.number().min(0).max(1),
});

export type RecruitmentConfig = z.infer<typeof RecruitmentSchema>;

export const RECRUITMENT: RecruitmentConfig = RecruitmentSchema.parse(recruitmentJson);
