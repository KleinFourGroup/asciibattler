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
 * - `enemyArcherRatio`  — [0,1] fraction of each wave that fields the ranged
 *                        archer (the rest field `bandit` melee). Hoisted from a
 *                        hardcoded 0.4 (the old 60/40 split) when the K2 hand-6
 *                        diagnostics flagged archer density as a massacre driver.
 *                        Set to 0.3 (a player-feel call — archers still read as
 *                        the threat unit, just less dense than 0.4). Re-swept
 *                        properly in N2 once the K mechanics (redraw/empower) land.
 *
 * The above feed the RANDOM `rollEnemyWave` lineage (the fuzz arena +
 * spawn-overflow). The two below are the X1 lever for the AUTHORED encounter
 * resolver — the per-run difficulty multipliers, default 1.0 (a no-op). They are
 * the *placeholder source* the per-run seam (`RunConfig.waveSizeMultiplier` /
 * `levelBudgetMultiplier`) falls back to; a future difficulty system (a chosen
 * difficulty level, hop-ramp, or ascension) sets the per-run override instead:
 * - `waveSizeMultiplier`   — scales every wave's resolved COUNT `C`
 *                            (`resolveTotalCount`) — the action-economy axis.
 * - `levelBudgetMultiplier`— scales every wave's resolved level BUDGET `L`
 *                            (`resolveLevelBudget`) — the individual-strength
 *                            axis. SATURATES against a wave's optional `levelCap`
 *                            (a capped wave clamps to `n·cap`), so the strength
 *                            axis only bites uncapped waves. The balance sweep
 *                            (X2) drives these in isolation to find an in-band
 *                            value, then the result is BAKED into the encounter's
 *                            authored wave-spec budget (the multiplier is a lever,
 *                            not persisted content). See BALANCE.md.
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
 *   B "swarm fodder" factor 0.25, swarmMax 2.0 — SHIPPED (playtested). Out-
 *                    numbered by waves of lv-1 fodder you mow down (gap grows to
 *                    5). Win 21% / 22%. Sits near a cliff (factor 0.30 → 0%) —
 *                    tune gently.
 *   C "mild middle"  factor 0.35, swarmMax 1.5 — playtested + rejected (too many
 *                    floor-1 deaths: numerous enough to overwhelm, not weak
 *                    enough to free-kill — the valley between A and B). Win 5% /
 *                    4%.
 * Rebalance is expected once G5 adds smarter strategies and Phase H changes the
 * model — these are starting points, not final answers. Revisit A/C then.
 *
 * ── K2 re-sweep (roster 10 / hand 6 / enemyArcherRatio 0.3) ──────────────────
 * K2's hand-6 change exposed a latent H5 wave-size BUG: `rollEnemyWave` sized the
 * swarm-COUNT off the whole roster (`playerTeam.length`) instead of the fielded
 * `min(roster, handSize)` — so a 10-unit roster faced `swarmMax × 10` enemies
 * against a 6-card hand (~18 at swarmMax 1.75, budget-capped). THAT was the
 * "massacre," not the budget. Fixed in `enemyBudget.ts` (count basis = the hand).
 * With the bug gone, fewer-but-stronger waves are much EASIER (action economy
 * dominates), so the band climbs: a `budgetFactor × swarmMax` sweep at 11 floors
 * (archerRatio 0.3) put the cliff at `swarmMax 2.0→2.25` (best-achievable
 * 63%→0%), with `budgetFactor` the fine lever at `swarmMax 2.0` (0.5/0.625/0.75 →
 * weak bots 62%/37%/0%). Landed `factor 0.75 × swarmMax 2.0` — best-achievable
 * ~63% (the BALANCE.md 2/3 target), weak bots ~0–10% over 20 seeds. COARSE +
 * provisional — re-swept properly in N2 once the K mechanics (redraw/empower) land.
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
  enemyArcherRatio: z.number().min(0).max(1),
  // X1 — the authored-encounter difficulty lever (default 1.0). Positive so a
  // multiplier never zeros a wave; the sweep mutates this in-memory in isolation.
  waveSizeMultiplier: z.number().positive(),
  levelBudgetMultiplier: z.number().positive(),
});

export type DifficultyConfig = z.infer<typeof DifficultySchema>;

export const DIFFICULTY: DifficultyConfig = DifficultySchema.parse(difficultyJson);

/**
 * X1 — the per-run difficulty multipliers applied to every authored-encounter
 * wave at resolve time (the K2 count-vs-strength split): `waveSize` scales the
 * resolved count, `levelBudget` the resolved level budget. Threaded through
 * `WaveContext`; absent → 1 (no scaling, byte-identical to pre-X1).
 */
export interface DifficultyMultipliers {
  readonly waveSize: number;
  readonly levelBudget: number;
}

/**
 * Resolve the effective per-run difficulty multipliers: the optional per-run
 * overrides (the future difficulty-system seam — `RunConfig`) falling back to the
 * global `difficulty.json` defaults. The APPLICATION point (the wave resolver,
 * via `WaveContext`) is fixed; this is where the SOURCE plugs in. X1 ships the
 * static config source; a dynamic difficulty system (chosen difficulty level /
 * hop-ramp / ascension) replaces the override values without touching the
 * resolver. Pure (reads only the parsed config) so it's headless-testable.
 */
export function resolveDifficultyMultipliers(overrides?: {
  readonly waveSize?: number | undefined;
  readonly levelBudget?: number | undefined;
}): DifficultyMultipliers {
  return {
    waveSize: overrides?.waveSize ?? DIFFICULTY.waveSizeMultiplier,
    levelBudget: overrides?.levelBudget ?? DIFFICULTY.levelBudgetMultiplier,
  };
}
