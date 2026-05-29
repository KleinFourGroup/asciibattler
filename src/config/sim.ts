/**
 * E5 — per-subsystem sim tunables (target stickiness, and room for more
 * pathfinding/behavior knobs as Phase E/F grows). Source of truth at
 * `config/sim.json`. Mirrors the `config/spawn.json` + `config/tiles.json`
 * pattern: timings are authored in seconds (gotcha #6) and converted to
 * integer ticks at module load, so a TICK_RATE change re-derives the
 * cadence automatically.
 *
 * A4 pattern: parse at module load, throw on malformed JSON.
 *
 *   retargetCloserRatio — target stickiness keeps a unit locked onto its
 *     current enemy until another enemy is at least this many times
 *     closer (1.5 = "switch only when a rival is 1.5x nearer"). >= 1 so
 *     "switch on any closer enemy" degenerates cleanly at 1.0.
 *   rangedRetargetLosSeconds — a ranged unit that can't see its sticky
 *     target for this long drops it and re-picks. Converted to
 *     `rangedRetargetLosTicks`.
 *   occupiedCellPenalty — extra A* cost (on top of tile cost) for routing
 *     MovementBehavior's path through a cell occupied by another unit
 *     (ally / non-target enemy). The soft-block dial: high → flank around
 *     allies (the old hardcoded 100 was steep enough to favour long
 *     backward flanks off the spawn band); low → go straight and
 *     queue/sidestep when blocked. Must stay >= 0 (keeps total cost >= 1,
 *     Chebyshev admissible) and finite (no deadlock). Does NOT affect
 *     walls/half-cover — those are hard blockers, not penalised cells.
 */

import { z } from 'zod';
import simJson from '../../config/sim.json';
import { secondsToTicks } from '../config';

const SimSchema = z.object({
  retargetCloserRatio: z.number().min(1),
  rangedRetargetLosSeconds: z.number().positive(),
  occupiedCellPenalty: z.number().nonnegative(),
});

const parsed = SimSchema.parse(simJson);

export const SIM = {
  retargetCloserRatio: parsed.retargetCloserRatio,
  rangedRetargetLosTicks: Math.max(1, secondsToTicks(parsed.rangedRetargetLosSeconds)),
  occupiedCellPenalty: parsed.occupiedCellPenalty,
};
