/**
 * Difficulty knobs. Enemy team size lags the player by a (typically
 * negative) delta to give a slight per-battle edge that breaks the
 * snowball; per-floor level increment toughens deeper enemies through
 * the leveling system (E3).
 *
 * E3: `enemyHpPerFloor` (a post-derive constitution multiplier) was
 * replaced with `enemyLevelPerFloor`. Enemies on floor N spawn at level
 * `1 + (N-1) × enemyLevelPerFloor`, then `scaleStats` applies the
 * archetype's `growthRates` deterministically. This moves the
 * difficulty curve onto the same axis as player progression instead of
 * sitting outside the stat system as a fixed HP buff.
 *
 * Source of truth at `config/difficulty.json`.
 */

import { z } from 'zod';
import difficultyJson from '../../config/difficulty.json';

const DifficultySchema = z.object({
  enemySizeDelta: z.number().int(),
  enemyLevelPerFloor: z.number().nonnegative(),
});

export type DifficultyConfig = z.infer<typeof DifficultySchema>;

export const DIFFICULTY: DifficultyConfig = DifficultySchema.parse(difficultyJson);
