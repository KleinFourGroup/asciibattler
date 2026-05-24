import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { MoveAction } from '../actions/MoveAction';
import { findTarget } from '../Targeting';
import { findPath } from '../Pathfinding';
import { hasLineOfSight } from '../LineOfSight';

/**
 * Proposes a one-cell step toward the nearest enemy when out of attack
 * range. Abstains (returns null) when no enemy exists, when the unit is
 * in range AND has line-of-sight, when no path to target exists, or when
 * the next step is currently occupied by another unit. Score 1 (low);
 * AttackBehavior scores 10 so the selector prefers attacking over moving
 * when both fire.
 *
 * Pathing model (C1d follow-up):
 *
 * 1. **Path to the target's cell**, not to a precomputed "goal cell
 *    within attackRange of target." The earlier `pickGoalCellInRange`
 *    heuristic froze when every range-1 neighbor of the target was a
 *    wall or an ally — common in tight layouts. The target itself is
 *    excluded from the blocker set so findPath has a reachable goal;
 *    the unit never actually steps onto target because the in-range
 *    abstain at the top of `proposeAction` fires at least one cell
 *    before reaching it.
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
 * 3. **Step collision check.** path[1] may be an ally/enemy cell A*
 *    routed through under (2). Two units can't share a cell, so abstain
 *    this tick — the blocker may move out of the way next tick. This
 *    creates queueing behavior in corridors without explicit
 *    coordination.
 *
 * 4. **LOS-gated in-range abstain.** The "I'm in attack range, let
 *    AttackBehavior fire" abstain also checks line-of-sight. A ranged
 *    unit in chebyshev range with a wall between it and target would
 *    otherwise freeze (AttackBehavior abstains on no LOS; MovementBehavior
 *    would also abstain on in-range). Now it keeps pathing forward —
 *    usually one more step brings it past the wall.
 */
export class MovementBehavior implements Behavior {
  static readonly kind = 'movement';
  readonly kind = MovementBehavior.kind;

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    const target = findTarget(unit, world);
    if (target === null) return null;

    // Split blockers by kind:
    //   walls (neutral)   → hard blockers + LOS occluders
    //   other units       → soft cells (high cost), tracked separately
    //                        for the step collision check
    const walls: GridCoord[] = [];
    const otherUnitCells = new Set<string>();
    for (const u of world.units) {
      if (u.id === unit.id) continue;
      if (u.team === 'neutral') {
        walls.push(u.position);
        continue;
      }
      if (u.id === target.id) continue;
      otherUnitCells.add(`${u.position.x},${u.position.y}`);
    }

    const inRange = chebyshev(unit.position, target.position) <= unit.stats.attackRange;
    if (inRange && hasLineOfSight(unit.position, target.position, walls)) {
      return null;
    }

    const path = findPath(
      unit.position,
      target.position,
      walls,
      world.gridW,
      world.gridH,
      (c) => costAt(c, world, otherUnitCells),
    );
    if (path.length < 2) return null;

    const to = path[1]!;
    if (otherUnitCells.has(`${to.x},${to.y}`)) return null;

    const from = unit.position;
    const durationTicks = unit.stats.moveCooldownTicks;

    return {
      action: new MoveAction(from, to, durationTicks),
      score: 1,
      cooldown: durationTicks,
      duration: durationTicks,
    };
  }
}

/**
 * Penalty for routing through a cell currently occupied by another unit
 * (ally or non-target enemy). Picked to be a lot larger than any
 * realistic detour on a D3-allowed grid (up to 32×32) — so A* prefers
 * any wall-free route up to ~100 cells long over going through a single
 * occupied cell — but
 * still finite, so a fully clogged corridor doesn't lock the path
 * solver. Chebyshev heuristic stays admissible (all costs are >= 1).
 */
const OCCUPIED_CELL_PENALTY = 100;

function costAt(c: GridCoord, world: World, occupied: ReadonlySet<string>): number {
  const tileCost = world.tileGrid.costAt(c);
  if (!isFinite(tileCost)) return tileCost;
  if (occupied.has(`${c.x},${c.y}`)) return tileCost + OCCUPIED_CELL_PENALTY;
  return tileCost;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
