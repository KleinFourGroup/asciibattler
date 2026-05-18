import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { MoveAction } from '../actions/MoveAction';
import { findTarget } from '../Targeting';
import { findPath } from '../Pathfinding';

/**
 * Proposes a one-cell step toward the nearest enemy when out of attack
 * range. Abstains (returns null) when no enemy exists, when the unit is
 * already in range, or when the path is blocked — the selector treats
 * null as "I have no opinion this tick," so attack proposals from other
 * behaviors can still fire.
 *
 * Score 1 (low). Attack proposals score higher when in range; the score
 * differentiation isn't strictly needed today because movement abstains
 * when in range, but it sets the pattern for archetypes whose move and
 * attack windows overlap.
 */
export class MovementBehavior implements Behavior {
  static readonly kind = 'movement';
  readonly kind = MovementBehavior.kind;

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    const target = findTarget(unit, world);
    if (target === null) return null;

    if (chebyshev(unit.position, target.position) <= unit.stats.attackRange) {
      return null;
    }

    const goal = pickGoalCellInRange(unit, target, world);
    if (goal === null) return null;

    const blockers = world.units.map((u) => u.position);
    const path = findPath(unit.position, goal, blockers, world.gridSize);
    if (path.length < 2) return null;

    const from = unit.position;
    const to = path[1]!;
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
 * Closest unblocked cell within `unit.stats.attackRange` of the target.
 * Tiebreak by iteration order (deterministic). Returns null if every
 * candidate cell is blocked or out of bounds — caller waits a tick.
 */
function pickGoalCellInRange(unit: Unit, target: Unit, world: World): GridCoord | null {
  const r = unit.stats.attackRange;
  const tx = target.position.x;
  const ty = target.position.y;

  let best: GridCoord | null = null;
  let bestDist = Infinity;

  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      if (dx === 0 && dy === 0) continue;
      const cell: GridCoord = { x: tx + dx, y: ty + dy };
      if (cell.x < 0 || cell.y < 0 || cell.x >= world.gridSize || cell.y >= world.gridSize) {
        continue;
      }
      if (isOccupiedByOther(cell, world, unit.id)) continue;
      const d = chebyshev(unit.position, cell);
      if (d < bestDist) {
        best = cell;
        bestDist = d;
      }
    }
  }
  return best;
}

function isOccupiedByOther(cell: GridCoord, world: World, exceptUnitId: number): boolean {
  for (const u of world.units) {
    if (u.id === exceptUnitId) continue;
    if (u.position.x === cell.x && u.position.y === cell.y) return true;
  }
  return false;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
