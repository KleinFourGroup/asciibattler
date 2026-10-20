/**
 * The per-run difficulty multipliers, and a fresh run's bits. Source of
 * truth at `config/difficulty.json`. An authored encounter sizes its own
 * waves; these scale them.
 *
 * The per-run multipliers, each 1 as shipped, are the fallback for
 * `RunConfig`'s own (`resolveDifficultyMultipliers`), and Escalation
 * multiplies them by its level's factors (`withEscalation`). The first two
 * reach the wave resolver through `WaveContext`; the last two apply at the
 * run layer.
 * - `waveSizeMultiplier` — scales every authored wave's resolved count
 *   (`resolveTotalCount`), the action-economy axis.
 * - `levelBudgetMultiplier` — scales every authored wave's resolved level
 *   budget (`resolveLevelBudget`), the strength axis. It saturates against a
 *   wave's `levelCap`: a capped wave's levels sum to at most `n × cap`, so the
 *   multiplier raises them only until they reach it.
 * - `bitsMultiplier` — scales every bits earned, at the `Run.gainBits`
 *   settle, multiplied with the `bitsGain` run stat, so reward rolls, daemon
 *   tallies and daemon hooks all scale alike.
 * - `enemyMoraleMultiplier` — scales the encounter's enemy pool where `Run`
 *   reads it (`scaledEnemyPool`).
 *
 * - `startingBits` — a fresh run's bits, read by `Run` at construction; a
 *   `RunConfig.startingBits` override wins.
 */

import { z } from 'zod';
import difficultyJson from '../../config/difficulty.json';

const DifficultySchema = z.object({
  // The multipliers are positive, so none zeroes a wave or an earn;
  // `scaledEnemyPool` also floors a pool at 1.
  waveSizeMultiplier: z.number().positive(),
  levelBudgetMultiplier: z.number().positive(),
  bitsMultiplier: z.number().positive(),
  enemyMoraleMultiplier: z.number().positive(),
  startingBits: z.number().int().nonnegative(),
});

type DifficultyConfig = z.infer<typeof DifficultySchema>;

export const DIFFICULTY: DifficultyConfig = DifficultySchema.parse(difficultyJson);

/**
 * The per-run difficulty multipliers, one for each `*Multiplier` key above;
 * at 1 a multiplier scales nothing.
 */
export interface DifficultyMultipliers {
  readonly waveSize: number;
  readonly levelBudget: number;
  readonly bits: number;
  readonly enemyMorale: number;
}

/**
 * A run's difficulty multipliers before Escalation: each `RunConfig`
 * override, else the `difficulty.json` value. The points that apply them are
 * fixed; this is where their source plugs in. It reads only the parsed
 * config.
 */
export function resolveDifficultyMultipliers(overrides?: {
  readonly waveSize?: number | undefined;
  readonly levelBudget?: number | undefined;
  readonly bits?: number | undefined;
  readonly enemyMorale?: number | undefined;
}): DifficultyMultipliers {
  return {
    waveSize: overrides?.waveSize ?? DIFFICULTY.waveSizeMultiplier,
    levelBudget: overrides?.levelBudget ?? DIFFICULTY.levelBudgetMultiplier,
    bits: overrides?.bits ?? DIFFICULTY.bitsMultiplier,
    enemyMorale: overrides?.enemyMorale ?? DIFFICULTY.enemyMoraleMultiplier,
  };
}

/**
 * An encounter's enemy pool under the enemy-morale multiplier: the authored
 * pool times the multiplier, to the nearest whole, never under 1. The count
 * and the level budget round the same way (`resolveTotalCount`,
 * `resolveLevelBudget`). At a multiplier of 1 it is the authored pool exactly,
 * since pools are whole numbers. Every read of an encounter's pool in `Run`
 * goes through this, so the pool a fight starts with, the maximum its gauges
 * show and the fraction a stage condition reads are one number.
 */
export function scaledEnemyPool(healthPool: number, multiplier: number): number {
  return Math.max(1, Math.round(healthPool * multiplier));
}
