/**
 * Recruitment / starting-team knobs. The starting team is fixed-composition
 * (3M+2R for MVP); the offer size determines how many recruit cards
 * appear post-victory. Source of truth at `config/recruitment.json`.
 */

import { z } from 'zod';
import recruitmentJson from '../../config/recruitment.json';

const RecruitmentSchema = z.object({
  startingMelee: z.number().int().nonnegative(),
  startingRanged: z.number().int().nonnegative(),
  defaultOfferSize: z.number().int().positive(),
});

export type RecruitmentConfig = z.infer<typeof RecruitmentSchema>;

export const RECRUITMENT: RecruitmentConfig = RecruitmentSchema.parse(recruitmentJson);
