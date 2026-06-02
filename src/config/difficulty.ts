/**
 * Difficulty knobs — G4 enemy **level-budget** model.
 *
 * The old linear `enemyLevelForFloor` ramp (`enemySizeDelta` + per-floor level
 * increment) assumed the player levels linearly. They don't, so deep floors
 * became unwinnable (post-G2 the fuzz bots won 0% of full runs). G4 replaces it
 * with a budget derived from the player's roster: the enemy total level tracks
 * the team, spread across MORE, weaker units (up to `swarmMaxMultiplier ×
 * playerSize`) so late battles are "outnumbered but individually stronger"
 * rather than "outclassed." See `src/run/enemyBudget.ts` for the algorithm and
 * the `playerTeamLevel` seam.
 *
 * Knobs:
 * - `totalLevelDelta`  — enemy budget = `playerTeamLevel − totalLevelDelta`
 *                        (positive = player edge; may be negative for harder).
 * - `unitLevelDelta`   — per-enemy cap = `highestPlayerUnitLevel + this`.
 * - `minBudget`        — floor so floor-1 (low summed level) still fields a real
 *                        fight instead of an empty/trivial one.
 * - `swarmBias`        — [0,1] count skew toward the 2× max (0 = uniform,
 *                        1 = always max). Higher = more reliably a swarm.
 * - `swarmMaxMultiplier`— upper bound on enemy count = `this × playerSize`.
 *                        Overflow past the spawn region streams in via the D5
 *                        spawn queue.
 *
 * Source of truth at `config/difficulty.json`.
 */

import { z } from 'zod';
import difficultyJson from '../../config/difficulty.json';

const DifficultySchema = z.object({
  totalLevelDelta: z.number().int(),
  unitLevelDelta: z.number().int().nonnegative(),
  minBudget: z.number().int().positive(),
  swarmBias: z.number().min(0).max(1),
  swarmMaxMultiplier: z.number().positive(),
});

export type DifficultyConfig = z.infer<typeof DifficultySchema>;

export const DIFFICULTY: DifficultyConfig = DifficultySchema.parse(difficultyJson);
