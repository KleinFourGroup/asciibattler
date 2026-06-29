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
 *   healerPanicRangeCells — E7.B: when a healer (`SupportMovementBehavior`)
 *     has no wounded ally in heal range, it panic-retreats from the nearest
 *     enemy that is within this many cells (Chebyshev). A distance, not a
 *     timing — passed through verbatim like `occupiedCellPenalty`, not
 *     `secondsToTicks`-converted. Higher → flightier healer; 0 disables
 *     the retreat (healer only ever heals/follows).
 *   healerFollowGapCells — E7.B: when nothing is healable and no enemy is
 *     near, the healer trails the CENTROID of its living allies, stepping
 *     whenever it's more than this many cells (Chebyshev) from that point.
 *     The deadzone that turns the old static-then-lurch follow into a smooth
 *     trail: small (1) → hugs the pack centre continuously; larger → hangs
 *     back loosely. A distance, not a timing.
 *   actingCellSearchSlack — GP4: when a unit approaches a target to act on it
 *     (archers/mage shooting, the catapult lobbing, the healer healing), it
 *     paths to the nearest cell from which it can ACT (in range, + LOS where
 *     the action needs it) rather than to the target's own cell. That cell is
 *     found by a bounded BFS outward from the unit, capped at `range + this`
 *     Chebyshev steps so a far/hopeless target doesn't scan the board — beyond
 *     the cap the unit falls back to charging the target's cell (the
 *     anti-freeze guarantee) and snaps to the acting cell once it closes in.
 *     The "small slack" past pure range that lets it find a LOS-clearing cell
 *     or take a one-cell sidestep. A distance, not a timing — passed through
 *     verbatim like `occupiedCellPenalty`. 0 = only cells already in range
 *     qualify; higher → searches wider (more work) for a standoff cell.
 *   shoveSearchRadiusCells — §35c: the BFS depth the de-overlap SHOVE searches
 *     for the nearest free cell when relocating a co-located unit (the
 *     occupancy backstop / the future-knockback primitive). Co-location is
 *     local — a free cell is almost always adjacent — so a small radius keeps
 *     the shove minimal-disruption + bounded; if nothing is free within it the
 *     shove no-ops (returns false) rather than teleporting across the board. A
 *     distance, not a timing — passed through verbatim.
 */

import { z } from 'zod';
import simJson from '../../config/sim.json';
import { secondsToTicks } from '../config';

const SimSchema = z.object({
  retargetCloserRatio: z.number().min(1),
  rangedRetargetLosSeconds: z.number().positive(),
  occupiedCellPenalty: z.number().nonnegative(),
  healerPanicRangeCells: z.number().int().nonnegative(),
  healerFollowGapCells: z.number().int().nonnegative(),
  actingCellSearchSlack: z.number().int().nonnegative(),
  shoveSearchRadiusCells: z.number().int().positive(),
});

const parsed = SimSchema.parse(simJson);

export const SIM = {
  retargetCloserRatio: parsed.retargetCloserRatio,
  rangedRetargetLosTicks: Math.max(1, secondsToTicks(parsed.rangedRetargetLosSeconds)),
  occupiedCellPenalty: parsed.occupiedCellPenalty,
  healerPanicRangeCells: parsed.healerPanicRangeCells,
  healerFollowGapCells: parsed.healerFollowGapCells,
  actingCellSearchSlack: parsed.actingCellSearchSlack,
  shoveSearchRadiusCells: parsed.shoveSearchRadiusCells,
};
