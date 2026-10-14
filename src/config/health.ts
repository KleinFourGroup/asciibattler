/**
 * The health pools that decide an encounter and the run, and the rules that
 * charge them. Source of truth at `config/health.json`.
 *
 * - `playerHealthMax` — the run-wide player pool's starting and refill value.
 *   It carries across the run; at 0 the run is lost.
 * - `enemyHealthMax` — the enemy pool outside an encounter. Each encounter
 *   sets its own (`Encounter.healthPool`), so this is only
 *   `Run.enemyHealthPoolMax`'s answer when no encounter is selected.
 *
 * Each turn the chip rule (`src/run/chipRule.ts`) charges both pools:
 * - `chipMode` — `casualties` (shipped): each pool loses the power of its
 *   own fallen. `survivors`: each side's survivors chip the opposing pool by
 *   their summed power.
 * - `capPenalty` — the rule a turn that runs out the clock
 *   (`battle:ended.reason === 'cap'`) pays on top of `chipMode`. Shipped
 *   `survivors`, so a stall pays its own fallen and the enemy's standing
 *   power, and running out the clock is never cheaper than fighting: under
 *   `casualties` alone the share of turns that reached the cap rose. A
 *   mutual wipe never reads it.
 * - `chipMultiplier` — scales every charge, from power to pool points.
 *
 * Between fights:
 * - `restHealFraction` — the share of `playerHealthMax` a rest node heals,
 *   capped at the maximum. A fraction, so it follows a change to the
 *   maximum; a packet's heal stays absolute by design.
 * - `seamHealFloor` — the share of `playerHealthMax` the pool is lifted to
 *   at each sector seam (`pool = max(pool, floor × max)`): 0 carries the
 *   pool over, 1 (shipped) heals it full between acts. Read at call time,
 *   since the sweep's `--set` writes to this object.
 *
 * Fatigue, off as shipped:
 * - `fatiguePerStack` — a unit gains a stack for each earlier turn it fought
 *   in this encounter, and when it is fielded its constitution (its
 *   starting HP) scales by `1 − rate × stacks` (`src/run/fatigue.ts`). It
 *   scales constitution and not power because under the casualty rule power
 *   is what a fallen unit costs. At 0 no effect is seeded.
 * - `fatigueMaxStacks` — stacks past it add nothing.
 *
 * Bounds:
 * - `maxTurns` — the most turns an encounter runs, since turns of mutual
 *   wipes would chip nothing forever. At the cap the player wins only with
 *   the larger remaining pool fraction; a tie is a loss.
 * - `maxTurnSeconds` — a turn's time budget, and its one source: a battle
 *   not over by then is resolved as a draw (`World.resolveAsDraw`) by every
 *   driver, the game, the fuzz harness and the arena. Authored in seconds;
 *   readers convert with `secondsToTicks` (gotcha #6).
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
