/**
 * CHECKPOINT 6 difficulty knobs. Enemy team size lags the player by a
 * (typically negative) delta to give a slight per-battle edge that
 * breaks the snowball; per-floor HP multiplier toughens deeper enemies.
 * Source of truth at `config/difficulty.json`.
 */

import { z } from 'zod';
import difficultyJson from '../../config/difficulty.json';

const DifficultySchema = z.object({
  enemySizeDelta: z.number().int(),
  enemyHpPerFloor: z.number().nonnegative(),
});

export type DifficultyConfig = z.infer<typeof DifficultySchema>;

export const DIFFICULTY: DifficultyConfig = DifficultySchema.parse(difficultyJson);
