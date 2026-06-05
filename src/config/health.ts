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
 * Rest nodes (H6a):
 * - `restHealAmount`  — how much a rest node heals the run-wide player pool
 *                       (capped at `playerHealthMax`). Sits beside the G3 rest
 *                       XP award; a placeholder until the real event system.
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
 * - `maxTurnSeconds`  — per-turn wall-time budget. A single turn's tactical
 *                       battle that hasn't resolved by this point is force-
 *                       resolved as a DRAW by the driver (the test harness in
 *                       H4a, BattleScene in H4b) via `World.resolveAsDraw`.
 *                       Authored in seconds; convert with `secondsToTicks` at
 *                       the consumer so it tracks `TICK_RATE` (gotcha #6).
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
  restHealAmount: z.number().int().nonnegative(),
  fatiguePerStack: z.number().nonnegative(),
});

export type HealthConfig = z.infer<typeof HealthSchema>;

export const HEALTH: HealthConfig = HealthSchema.parse(healthJson);
