import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { MoveAction } from '../actions/MoveAction';
import { currentTarget } from '../Targeting';
import { findPath } from '../Pathfinding';
import { SIM } from '../../config/sim';
import { hasLineOfSight } from '../LineOfSight';
import { nearestActingCell } from '../actingPosition';

/**
 * Proposes a one-cell step toward the unit's current (E5-sticky) target
 * when out of attack range. Abstains (returns null) when no enemy exists, when the unit is
 * in range AND has line-of-sight, when no path to target exists, or when
 * the next step is blocked AND no sidestep is free. Score 1 (low);
 * AbilityBehavior scores 10 (via each ability) so the selector prefers
 * attacking over moving when both fire.
 *
 * Pathing model (C1d follow-up; GP4 acting-cell refinement):
 *
 * 1. **Path to a firing cell, with a target-cell fallback.** A ranged
 *    unit (attackRange > 1) paths to the nearest cell from which it can
 *    actually shoot — `nearestActingCell`: in range AND (for LOS-gated
 *    abilities) with line of sight — instead of charging the target's own
 *    cell. So it holds at standoff with a clear shot rather than creeping
 *    into melee, or sidesteps a wall that breaks LOS rather than creeping
 *    at it. The catapult (LOS-ignoring) uses the same search range-only.
 *    **Melee (range 1) stays on target-cell pathing** — an adjacent cell
 *    always has LOS, so there's nothing to reposition for.
 *
 *    The goal **falls back to the target's cell** whenever the firing-cell
 *    approach can't produce a move — either no firing cell is reachable
 *    within the cap, OR the step toward one is blocked (a contested cell in
 *    a chokepoint: a strafing-funnel strip where every unit's nearest firing
 *    cell is the same occupied tile would otherwise strand the whole column).
 *    Charging the target then drains the chokepoint as a pre-GP4 unit would.
 *    This is the load-bearing anti-freeze guarantee. The earlier
 *    `pickGoalCellInRange` heuristic picked a single in-range goal cell and
 *    froze when every such cell was a wall or an ally (→ findPath returns []
 *    → stall), common in tight layouts; the fallback (plus `nearestActingCell`
 *    only ever returning cells reachable over findPath's own blocker graph)
 *    means we never reintroduce that freeze. The target itself is excluded
 *    from the blocker set so findPath always has a reachable goal; the unit
 *    never actually steps onto target/the firing cell because the in-range
 *    abstain at the top of `proposeAction` fires at least one cell before
 *    reaching it.
 *
 * 2. **Soft ally blocking**, not hard. Walls (neutral-team units) stay
 *    hard blockers — they're permanent terrain. Other units (allies
 *    and non-target enemies) become high-cost cells via the CostFn.
 *    A* routes around them when possible but routes through them when
 *    no alternative exists, so two units facing each other across a
 *    1-cell chokepoint don't both findPath()→[] and freeze (the
 *    Labyrinth deadlock — see tests/integration/layout-deadlock.test.ts).
 *    Chebyshev heuristic stays admissible since all costs are >= 1.
 *
 * 3. **Step collision check + boids sidestep (E5.B).** path[1] may be an
 *    ally/enemy cell A* routed through under (2). Two units can't share a
 *    cell, so the unit can't take that step. Instead of always abstaining
 *    (which on open ground reads as a stall/backpedal), it first tries a
 *    one-cell perpendicular sidestep toward the target — `sidestep()`
 *    below. Only if neither perpendicular cell is free does it abstain,
 *    so corridor queueing still emerges naturally in a 1-wide gap.
 *
 * 4. **LOS-gated in-range abstain.** The "I'm in attack range, let
 *    AbilityBehavior fire" abstain also checks line-of-sight. A ranged
 *    unit in chebyshev range with a wall between it and target would
 *    otherwise freeze (the basic-strike ability abstains on no LOS;
 *    MovementBehavior would also abstain on in-range). Now it keeps
 *    pathing forward — usually one more step brings it past the wall.
 *    EXCEPTION (E7.D): a unit carrying an LOS-ignoring ability (the
 *    catapult) abstains on range alone — it lobs over the wall, so there's
 *    nothing to path around.
 */
export class MovementBehavior implements Behavior {
  static readonly kind = 'movement';
  readonly kind = MovementBehavior.kind;

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    const target = currentTarget(unit, world);
    if (target === null) return null;

    // Split blockers by kind:
    //   neutrals          → hard blockers for pathfinding
    //   neutrals w/ LOS   → ALSO LOS occluders for the in-range abstain
    //                       (half-cover is `blocksLineOfSight: false`, so
    //                        it pathing-blocks but doesn't break LOS — D6)
    //   other units       → soft cells (high cost), tracked separately
    //                        for the step collision check
    const pathBlockers: GridCoord[] = [];
    const losBlockers: GridCoord[] = [];
    const otherUnitCells = new Set<string>();
    // E5.B — every other unit's cell (incl. neutrals + the target) so the
    // sidestep never lands on an occupied square.
    const occupied = new Set<string>();
    for (const u of world.units) {
      if (u.id === unit.id) continue;
      occupied.add(`${u.position.x},${u.position.y}`);
      if (u.team === 'neutral') {
        pathBlockers.push(u.position);
        if (u.blocksLineOfSight) losBlockers.push(u.position);
        continue;
      }
      if (u.id === target.id) continue;
      otherUnitCells.add(`${u.position.x},${u.position.y}`);
    }

    // E7.D — a unit whose engagement ability ignores LOS (the catapult's
    // arcing shot) abstains on range alone: no point creeping forward to
    // clear a wall it lobs over. LOS-gated units (strikes/ranged/magic) keep
    // the original `inRange && hasLOS` abstain so a wall between them and the
    // target makes them path for a clear shot instead of freezing.
    const ignoresLos = unit.abilities.some((a) => a.ignoresLineOfSight === true);
    const inRange = chebyshev(unit.position, target.position) <= unit.derived.attackRange;
    if (inRange && (ignoresLos || hasLineOfSight(unit.position, target.position, losBlockers))) {
      return null;
    }

    const from = unit.position;
    const durationTicks = unit.derived.moveCooldownTicks;

    // One A* step toward `goal`: the move, or null when no path exists or the
    // next cell is occupied and no perpendicular sidestep is free (1-wide
    // chokepoint → queue). Soft ally blocking + the E5.B sidestep live here so
    // both the firing-cell goal and the target-cell fallback share them.
    const stepToward = (goal: GridCoord): ActionProposal | null => {
      const path = findPath(
        from,
        goal,
        pathBlockers,
        world.gridW,
        world.gridH,
        (c) => costAt(c, world, otherUnitCells),
      );
      if (path.length < 2) return null;
      const to = path[1]!;
      if (otherUnitCells.has(`${to.x},${to.y}`)) {
        // E5.B — the A*-chosen next step is occupied. Try a perpendicular
        // sidestep toward the target before giving up.
        const side = sidestep(from, target.position, world, occupied);
        return side === null ? null : moveProposal(from, side, durationTicks);
      }
      return moveProposal(from, to, durationTicks);
    };

    // GP4 — a ranged unit heads to the nearest cell it can fire from (in range
    // + LOS, or range-only when it ignores LOS) so it holds at standoff /
    // repositions for a blocked shot instead of charging. Melee (range 1) keeps
    // target-cell pathing — an adjacent cell always has LOS.
    //
    // The fallback to charging the target's cell is load-bearing: it fires both
    // when no firing cell is reachable within the cap AND when the step toward
    // a firing cell is blocked (a contested cell in a chokepoint — e.g. a
    // strafing-funnel strip where every unit's nearest firing cell is the same
    // occupied tile). Charging the target then drains the chokepoint exactly as
    // a pre-GP4 unit would, so a contested firing cell can never strand the
    // unit (the C1d/E5 anti-freeze guarantee). Do NOT reintroduce the old
    // `pickGoalCellInRange` freeze by abstaining here.
    if (unit.derived.attackRange > 1) {
      const firingCell = nearestActingCell(
        from,
        target.position,
        unit.derived.attackRange,
        SIM.actingCellSearchSlack,
        world,
        ignoresLos ? null : losBlockers,
      );
      if (firingCell !== null) {
        const viaFiringCell = stepToward(firingCell);
        if (viaFiringCell !== null) return viaFiringCell;
      }
    }

    return stepToward(target.position);
  }
}

function moveProposal(
  from: GridCoord,
  to: GridCoord,
  durationTicks: number,
): ActionProposal {
  return {
    action: new MoveAction(from, to, durationTicks),
    score: 1,
    cooldown: durationTicks,
    // F2 — the step is applied in `start` (offset 0); the unit is then locked
    // for the move-cooldown window. Single `impact` phase = the lockout.
    phases: [{ phase: 'impact', ticks: durationTicks }],
  };
}

/**
 * E5.B — one-cell perpendicular sidestep toward `target`, used when the
 * A*-chosen next step is occupied by another unit. Considers exactly the
 * two cells perpendicular to the unit→target direction (per the E5
 * decision point: 2 candidates, not 3 — back-step-forward is what the
 * cost gradient already does). Keeps only in-bounds, finite-cost,
 * unoccupied cells, and returns the one closest to the target (Chebyshev),
 * first-candidate winning a tie for determinism. Returns null when neither
 * is viable, so the caller abstains and corridor queueing still emerges.
 */
function sidestep(
  from: GridCoord,
  target: GridCoord,
  world: World,
  occupied: ReadonlySet<string>,
): GridCoord | null {
  const sx = Math.sign(target.x - from.x);
  const sy = Math.sign(target.y - from.y);
  // Rotate the toward-target direction ±90°.
  const candidates: GridCoord[] = [
    { x: from.x - sy, y: from.y + sx },
    { x: from.x + sy, y: from.y - sx },
  ];
  let best: GridCoord | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) continue;
    if (!isFinite(world.tileGrid.costAt(c))) continue;
    if (occupied.has(`${c.x},${c.y}`)) continue;
    const dist = chebyshev(c, target);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Penalty added (on top of tile cost) for routing through a cell occupied
 * by another *unit* (ally or non-target enemy). This is the soft-block
 * knob: A* detours around an occupied cell only when the detour costs less
 * than the penalty, and routes *through* it (→ step-collision abstain /
 * E5.B sidestep) otherwise. So the value is the dial between "flank around
 * allies" (high) and "hold the line / queue" (low).
 *
 * Walls + half-cover are NOT affected — they're hard `blockers` in
 * `findPath` and never reach this function. Stays finite (and >= 0, so
 * total cost stays >= 1 and the Chebyshev heuristic stays admissible —
 * gotcha #34) so a fully clogged corridor never deadlocks the solver; the
 * E5.A note explains why the old 100 was too steep. Tunable in
 * `config/sim.json`.
 */
function costAt(c: GridCoord, world: World, occupied: ReadonlySet<string>): number {
  const tileCost = world.tileGrid.costAt(c);
  if (!isFinite(tileCost)) return tileCost;
  if (occupied.has(`${c.x},${c.y}`)) return tileCost + SIM.occupiedCellPenalty;
  return tileCost;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
