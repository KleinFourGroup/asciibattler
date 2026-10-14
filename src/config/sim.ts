/**
 * The battle sim's tunables: targeting, pathing, healers, camps and the
 * mid-battle spawn. Source of truth at `config/sim.json`, parsed at module
 * load (malformed JSON throws). Timings are authored in seconds and
 * converted to ticks here, so a change to `TICK_RATE` re-derives them
 * (gotcha #6); distances and step counts pass through as written.
 *
 * - `retargetCloserRatio` — a unit keeps its current enemy until another is
 *   at least this many times closer. At least 1; at 1 it switches to any
 *   closer enemy.
 * - `rangedRetargetLosSeconds` — a ranged unit that cannot see its target
 *   for this long drops it and picks again. Converted to
 *   `rangedRetargetLosTicks`, at least 1.
 *
 * The pather prices a cell's occupant in three tiers. They choose a route
 * only: the step-commit collision check and the execution gate stay hard,
 * so two units never end in one cell whatever these are. Each must stay at
 * or above 0, which keeps every step's cost at least 1 and the Chebyshev
 * heuristic admissible, and finite, so nothing deadlocks. Walls and half
 * cover are hard blockers, not priced cells.
 * - `occupiedCellPenalty` — a cell held by a unit with no move in flight.
 *   High: units flank around allies. Low: they go straight, and queue or
 *   sidestep when blocked.
 * - `vacatingCellPenalty` — a cell whose occupant's move will leave it
 *   within the pather's arrival window. Near 0, a column moving down a
 *   corridor stops reading as a wall. Keep it below `occupiedCellPenalty`.
 *   When the cell frees is derived from the mover's action
 *   (`occupancy.vacancyEtaOf`), never stored.
 * - `inboundClaimPenalty` — a cell claimed as an in-flight move's
 *   destination. Keep it above `occupiedCellPenalty`: a standing unit may
 *   move away, and a claimed cell will be filled.
 *
 * Counts below are in the pather's own steps, so they scale with its speed.
 * - `vacancyWindowOwnSteps` — the slack in the arrival window: a cell frees
 *   in time when it frees within (its Chebyshev distance + this) steps. 0:
 *   only cells free by the strict estimate.
 * - `waitForVacancyOwnSteps` — when the next cell on the route holds a unit
 *   that will leave within this many steps, the pather waits in lane;
 *   otherwise, or when no leaving time can be derived (a standing unit, a
 *   claim), it sidesteps or queues. 0: it waits only for a same-tick flip.
 *   Kept apart from `vacancyWindowOwnSteps` so patience in a queue and
 *   optimism in a route tune separately.
 * - `routeSwitchMargin` — hysteresis, in A* cost. When passing traffic
 *   (claims, units about to move) turns the live route's first step off the
 *   stable route (the same route without that traffic), the pather takes
 *   the detour only if it is cheaper by more than this; otherwise it holds
 *   its lane and waits, sidesteps or queues. One pulsing claim or unit (+4
 *   to +8) stays under 8; a real crossing column (+12 and up) still turns
 *   it. 0: the live route always wins. Derived on each poll from stored
 *   state, so a resumed snapshot chooses the same.
 * - `stableRouteHorizonOwnSteps` — what counts as passing traffic: a
 *   leaving unit or a claim that resolves within this many steps is left out
 *   of the stable route. Past it, it stays a cost, so a blocker that leaves
 *   slowly is routed around rather than queued behind.
 *
 * - `healerPanicRangeCells` — a healer with no wounded ally in range backs
 *   away from the nearest enemy within this many cells. 0: it never does.
 * - `healerFollowGapCells` — with nothing to heal and no enemy near, a healer
 *   trails the centre of its living allies, stepping when it is farther than
 *   this from it. 1 hugs the pack; more hangs back.
 * - `actingCellSearchSlack` — a unit closing on a target to act on it paths
 *   to the nearest cell it can act from (in range, with line of sight where
 *   the action needs it), searched out to its range plus this many steps.
 *   Past that it heads for the target's own cell, so it never stands still,
 *   and finds the acting cell once closer. 0: only cells already in range.
 * - `shoveSearchRadiusCells` — how far the shove that parts two units in one
 *   cell looks for a free cell. One is almost always adjacent, so a small
 *   radius keeps the shove local; with none in reach the shove does nothing
 *   rather than carry a unit across the board.
 * - `moveFlipFraction` — the point in a one-cell move's busy window at which
 *   the unit's logical position flips from `from` to `to` and its claim on
 *   the destination is released: tick `startTick + floor(durationTicks ×
 *   this)`, carried by the move's phase timeline, not a stored field. At 0.5
 *   a slow unit struck mid-step still stands on its old cell. 0: instant; 1:
 *   on arrival. `floor` keeps a one-tick move instant.
 *
 * - `campWanderChancePerSecond` — the chance per second that an idle camp
 *   member takes one wander step inside its leash. The behaviour polls every
 *   tick, so the loader derives `campWanderChancePerTick`
 *   (`1 − (1 − perSecond)^(1/TICK_RATE)`), which keeps the rate when
 *   `TICK_RATE` changes. It rolls on `campRng`: the one exception, signed by
 *   the user, to movement without randomness, since a camp's wander is
 *   scenery and not pathing. 0: camps stand still (a member dripped onto the
 *   anchor still steps off it); 1: a step on every eligible poll.
 * - `enemyPullChance` — per turn on a layout with camps, the chance that the
 *   enemy team opens by pulling a camp: its objective is set to engage one
 *   camp's primed member. The camp is not marked hostile, since only damage
 *   makes a camp hostile, so it reads passive until the enemy strikes it.
 *   Rolls on `deriveRng(terrainSeed, 'enemyPull', worldSeed)`, the world seed
 *   making it per turn, and the stream is derived only when this is above 0
 *   and the layout has camps. Shipped 0.25; 0.15 played as too rare.
 * - `campsStartHostile` — a measurement switch, shipped 0 and never shipped
 *   above it. Above 0, every camp starts hostile to the player, so the bot,
 *   which does not seek camps, fights them, and the hold on an uncleared
 *   hostile camp runs each fight to its end and pays its rewards. Player
 *   side only, since an enemy's camp kills pay nothing. Marking is
 *   idempotent (`hostileTo` is a stored set), so a snapshot load re-applies
 *   it harmlessly. A number and not a boolean, so `--set` can address it; it
 *   draws nothing.
 *
 * - `spawnDurationSeconds` — the lockout of a unit that joins a battle under
 *   way (a reinforcement from the overflow queue, a camp's drip): its first
 *   action is a `SpawnAction` this long, and the renderer fades its sprite
 *   and bar in over the same window, so the lockout and the fade line up.
 *   Units placed at the battle's start appear at once with no lockout; the
 *   pre-battle countdown (`config/playback.json`) is their reaction window.
 *   Converted to `spawnDurationTicks`.
 * - `rangedLeashCells` — the leash (Chebyshev) within which a player unit
 *   pursuing the team objective breaks off to engage an enemy. Its engage
 *   radius is `min(attackRange, rangedLeashCells)`, so this caps a
 *   long-range unit well below its reach (an archer does not leave the
 *   objective to shoot every distant enemy) and leaves melee untouched.
 *   Beyond the leash only retaliation, an enemy attacking the unit within
 *   its own attack range, pulls it off the objective. Under a tile focus a
 *   unit stops heading for the tile and engages around it once within this
 *   radius (`src/sim/focusTile.ts`).
 */

import { z } from 'zod';
import simJson from '../../config/sim.json';
import { secondsToTicks, TICK_RATE } from '../config';

const SimSchema = z.object({
  retargetCloserRatio: z.number().min(1),
  rangedRetargetLosSeconds: z.number().positive(),
  occupiedCellPenalty: z.number().nonnegative(),
  vacatingCellPenalty: z.number().nonnegative(),
  inboundClaimPenalty: z.number().nonnegative(),
  vacancyWindowOwnSteps: z.number().nonnegative(),
  waitForVacancyOwnSteps: z.number().nonnegative(),
  routeSwitchMargin: z.number().nonnegative(),
  stableRouteHorizonOwnSteps: z.number().nonnegative(),
  healerPanicRangeCells: z.number().int().nonnegative(),
  healerFollowGapCells: z.number().int().nonnegative(),
  actingCellSearchSlack: z.number().int().nonnegative(),
  shoveSearchRadiusCells: z.number().int().positive(),
  moveFlipFraction: z.number().min(0).max(1),
  campWanderChancePerSecond: z.number().min(0).max(1),
  enemyPullChance: z.number().min(0).max(1),
  campsStartHostile: z.number().min(0).max(1),
  spawnDurationSeconds: z.number().positive(),
  rangedLeashCells: z.number().int().positive(),
});

const parsed = SimSchema.parse(simJson);

export const SIM = {
  retargetCloserRatio: parsed.retargetCloserRatio,
  rangedRetargetLosTicks: Math.max(1, secondsToTicks(parsed.rangedRetargetLosSeconds)),
  occupiedCellPenalty: parsed.occupiedCellPenalty,
  vacatingCellPenalty: parsed.vacatingCellPenalty,
  inboundClaimPenalty: parsed.inboundClaimPenalty,
  vacancyWindowOwnSteps: parsed.vacancyWindowOwnSteps,
  waitForVacancyOwnSteps: parsed.waitForVacancyOwnSteps,
  routeSwitchMargin: parsed.routeSwitchMargin,
  stableRouteHorizonOwnSteps: parsed.stableRouteHorizonOwnSteps,
  healerPanicRangeCells: parsed.healerPanicRangeCells,
  healerFollowGapCells: parsed.healerFollowGapCells,
  actingCellSearchSlack: parsed.actingCellSearchSlack,
  shoveSearchRadiusCells: parsed.shoveSearchRadiusCells,
  moveFlipFraction: parsed.moveFlipFraction,
  // Derived from the per-second value (see above); at 1 it is exactly 1.
  campWanderChancePerTick: 1 - (1 - parsed.campWanderChancePerSecond) ** (1 / TICK_RATE),
  enemyPullChance: parsed.enemyPullChance,
  campsStartHostile: parsed.campsStartHostile,
  spawnDurationSeconds: parsed.spawnDurationSeconds,
  spawnDurationTicks: secondsToTicks(parsed.spawnDurationSeconds),
  rangedLeashCells: parsed.rangedLeashCells,
};
