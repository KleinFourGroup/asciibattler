/**
 * H4 — health-pool knobs for the multi-turn encounter loop.
 *
 * An encounter is a series of turns; two pools decide it (and the run):
 * - `playerHealthMax`  — the run-wide player pool's starting/refill value
 *                        (persists across the whole run; at 0 the run is lost).
 * - `enemyHealthMax`   — the per-encounter enemy pool's starting value (reset
 *                        every encounter; at 0 the player wins the encounter).
 * Each turn, a side's surviving units chip the OPPOSING pool by their Σ`power`
 * (× `chipMultiplier`). Balance-tuned in H6 — these are starting points.
 *
 * Rest nodes (H6a; §90 re-expressed as a FRACTION):
 * - `restHealFraction` — the share of `playerHealthMax` a rest node heals the
 *                       run-wide player pool by (capped at max). Was the
 *                       absolute `restHealAmount` 5 until §90; 0.25 × 20 is
 *                       the same 5 today, and it tracks a pool-max move (the
 *                       §92 rebalance lever) instead of silently shrinking.
 *                       Heals from packets stay ABSOLUTE by design (the spec's
 *                       hardening pass: fractions for rest + the seam floor,
 *                       absolutes for packets). Sits beside the G3 rest XP
 *                       award.
 *
 * The seam floor (§90 — the casualty experiment's "independent acts" frame):
 * - `seamHealFloor`   — 0–1 fraction of `playerHealthMax` the run-wide pool
 *                       is lifted to at every sector seam (`advanceSector`):
 *                       `pool = max(pool, floor × max)`. 0 = the pre-§90
 *                       carry (no heal); 1 = a full heal between acts (the
 *                       StS below-Ascension-5 precedent). Shipped at 1.0; the
 *                       later difficulty / meta-progression lever. Read at
 *                       CALL time (the fuzz `--set=health.seamHealFloor=0`
 *                       probe arm mutates this object in place).
 *
 * Fatigue (H6c — INERT by default):
 * - `fatiguePerStack` — the per-stack debuff rate behind `fatigueFactor`. A
 *                       unit accrues one stack per prior turn it fought THIS
 *                       encounter (off H3's `deploymentCounts`); the factor
 *                       scales its power as it's fielded. Default **0** ⇒
 *                       factor 1.0 ⇒ zero gameplay effect. The real curve /
 *                       magnitude (and whether a richer status-effect shape
 *                       replaces the power scale) is H7's call — see
 *                       `src/run/fatigue.ts`.
 *
 * Safety / termination:
 * - `maxTurns`        — hard cap on turns per encounter. A run of all-mutual-
 *                       wipe turns chips 0/0 forever; on the cap the encounter
 *                       resolves by remaining pool fraction. Bounds the loop.
 * - `maxTurnSeconds`  — per-turn wall-time budget, and the SINGLE source for it.
 *                       A turn's battle that hasn't resolved by this point is
 *                       force-resolved as a DRAW by the driver via
 *                       `World.resolveAsDraw` — uniformly across the live game
 *                       (BattleScene), the fuzz run harness, and the arena (N2
 *                       wired BattleScene + collapsed their once-hardcoded copies
 *                       onto this value). Authored in seconds; convert with
 *                       `secondsToTicks` at the consumer so it tracks `TICK_RATE`
 *                       (gotcha #6).
 *
 * Source of truth at `config/health.json`.
 */

import { z } from 'zod';
import healthJson from '../../config/health.json';

const HealthSchema = z.object({
  playerHealthMax: z.number().int().positive(),
  enemyHealthMax: z.number().int().positive(),
  maxTurns: z.number().int().positive(),
  maxTurnSeconds: z.number().positive(),
  chipMultiplier: z.number().nonnegative(),
  restHealFraction: z.number().min(0).max(1),
  seamHealFloor: z.number().min(0).max(1),
  fatiguePerStack: z.number().nonnegative(),
});

export type HealthConfig = z.infer<typeof HealthSchema>;

export const HEALTH: HealthConfig = HealthSchema.parse(healthJson);
