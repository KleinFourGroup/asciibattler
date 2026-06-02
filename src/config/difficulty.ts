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
 * Knobs (enemy budget is now an AFFINE transform of the player team level —
 * a flat delta couldn't scale: a constant subtraction is swamped by the
 * player's growing summed level, so late battles stayed even. A proportional
 * `factor` holds the handicap's *ratio* at every depth):
 * - `budgetFactor`     — enemy budget = `budgetOffset + budgetFactor ×
 *                        playerTeamLevel`. `< 1` = a player edge that scales
 *                        with progression; `1` reproduces the old flat model.
 * - `budgetOffset`     — additive term (may be negative). Shifts the whole
 *                        curve up/down independent of the player's level.
 * - `unitLevelDelta`   — per-enemy cap = `highestPlayerUnitLevel + this`.
 * - `minBudget`        — safety floor so the budget can't go ≤ 0 (mostly
 *                        vestigial now the affine + `startingLevel` keep early
 *                        budgets healthy).
 * - `swarmBias`        — [0,1] count skew toward the max (0 = uniform, 1 =
 *                        always max). Higher = more reliably a swarm.
 * - `swarmMaxMultiplier`— upper bound on enemy count = `this × playerSize`.
 *                        Overflow past the spawn region streams in via the D5
 *                        spawn queue.
 *
 * ── Calibration presets (G4, all at `recruitment.startingLevel = 5`) ─────────
 * The budget is conserved, so there's a hard tradeoff: spreading it wide
 * (swarm) makes each enemy weak fodder; concentrating it (even counts) makes
 * each a half-level threat. A "half-level swarm" = equal total army = an
 * unwinnable action-economy fight, so you can't have both. Three points on
 * that spectrum (swap by editing the JSON; greedy/random win over 100 seeds):
 *   A "elite even"   factor 0.50, swarmMax 1.2 — ~even counts, enemies ≈ ½ your
 *                    level (every enemy a real threat). Gentle, tuning-robust.
 *                    Win 23% / 15%.
 *   B "swarm fodder" factor 0.25, swarmMax 2.0 — outnumbered by waves of lv-1
 *                    fodder you mow down (gap grows to 5). Win 21% / 22%, but
 *                    sits near a cliff (factor 0.30 → 0%) — tune gently.
 *   C "mild middle"  factor 0.35, swarmMax 1.5 — SHIPPED. Slightly outnumbered
 *                    by weak (lv 1–2) enemies; gap ~4–5. Tense for the dumb
 *                    fuzz bots (win 5% / 4%) but a focus-firing human handles
 *                    floor 1's 5×lv5 vs 6×lv1 easily.
 * Rebalance is expected once G5 adds smarter strategies and Phase H changes the
 * model — these are starting points, not final answers. Revisit A/B then.
 *
 * Source of truth at `config/difficulty.json`.
 */

import { z } from 'zod';
import difficultyJson from '../../config/difficulty.json';

const DifficultySchema = z.object({
  budgetFactor: z.number().nonnegative(),
  budgetOffset: z.number(),
  unitLevelDelta: z.number().int().nonnegative(),
  minBudget: z.number().int().positive(),
  swarmBias: z.number().min(0).max(1),
  swarmMaxMultiplier: z.number().positive(),
});

export type DifficultyConfig = z.infer<typeof DifficultySchema>;

export const DIFFICULTY: DifficultyConfig = DifficultySchema.parse(difficultyJson);
