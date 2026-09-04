/**
 * H4 — health-pool knobs for the multi-turn encounter loop.
 *
 * An encounter is a series of turns; two pools decide it (and the run):
 * - `playerHealthMax`  — the run-wide player pool's starting/refill value
 *                        (persists across the whole run; at 0 the run is lost).
 * - `enemyHealthMax`   — the per-encounter enemy pool's starting value (reset
 *                        every encounter; at 0 the player wins the encounter).
 * Each turn the CHIP RULE charges both pools (`src/run/chipRule.ts`, the
 * §91 casualty experiment — encounter-feel-spec §The casualty chip rule):
 * - `chipMode`        — `"survivors"`: a side's surviving units chip the
 *                       OPPOSING pool by their Σ`power` (the pre-§91 rule);
 *                       `"casualties"`: each pool loses the power of ITS OWN
 *                       fallen. Both alive all round — the paired same-seed
 *                       A/B of the flip (`--set=health.chipMode=…`) is the
 *                       experiment's instrument; the human A/B is this line.
 *                       Shipped `survivors` through the §91 seam commits;
 *                       **`casualties` since 91e** (2026-09-03) — the
 *                       experiment's default until §93 keeps or rolls back.
 * - `capPenalty`      — the rule a TICK-CAPPED turn (`battle:ended.reason ===
 *                       'cap'`) ALSO pays, on top of `chipMode`: under
 *                       (casualties, survivors) a stall pays its own fallen
 *                       PLUS the enemy's standing power — a surcharge, so
 *                       kiting to the cap is never cheaper than fighting. A
 *                       mutual wipe never reads it. Shipped `survivors` beside
 *                       `chipMode: survivors` through the seam commits (one
 *                       rule — byte-identical to pre-§91); `casualties` at 91e
 *                       (one rule again); **`survivors` since 91g** — the 91f
 *                       flip read found the cap-draw share RISING under
 *                       casualties on the deploy twin (0.034 vs 0.010), the
 *                       criterion ROADMAP §91 pre-registered for the flip, so
 *                       the shipped pair is the SURCHARGE: a stall pays its
 *                       own fallen PLUS the enemy's standing power
 *                       (user-endorsed 2026-09-04; WORKLOG §91f item 4).
 * - `chipMultiplier`  — scales every charge (× power → pool-HP).
 * Balance-tuned in H6 — these are starting points.
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
 * Fatigue (H6c → §91c — INERT by default):
 * - `fatiguePerStack` — the per-stack debuff rate. A unit accrues one stack per
 *                       prior turn it fought THIS encounter (off H3's
 *                       `deploymentCounts`); the `Fatigued` effect scales its
 *                       CONSTITUTION (starting HP) by `1 − rate·stacks` as it's
 *                       fielded. §91c re-targeted it off `power` — meaningless
 *                       under the casualties chip rule, where power is what a
 *                       fallen unit COSTS (a tired unit would have been cheaper
 *                       to lose). Default **0** ⇒ no effect seeded ⇒
 *                       byte-identical. Switched on (the spec's −10%/stack) as
 *                       its own paired read at §92 — see `src/run/fatigue.ts`.
 * - `fatigueMaxStacks` — the stack clamp: stacks beyond it add nothing. The
 *                       spec's cap (at −10%/stack, 5 stacks = −50%).
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
  chipMode: z.enum(['survivors', 'casualties']),
  capPenalty: z.enum(['survivors', 'casualties']),
  restHealFraction: z.number().min(0).max(1),
  seamHealFloor: z.number().min(0).max(1),
  fatiguePerStack: z.number().nonnegative(),
  fatigueMaxStacks: z.number().int().positive(),
});

export type HealthConfig = z.infer<typeof HealthSchema>;

export const HEALTH: HealthConfig = HealthSchema.parse(healthJson);
