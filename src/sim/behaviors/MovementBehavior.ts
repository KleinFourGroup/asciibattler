import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import { findTarget } from '../Targeting';
import { findPath } from '../Pathfinding';

/**
 * Per-unit movement. On each tick the cooldown counts down; when it hits 0
 * the unit picks the nearest enemy, finds a cell within attack range of that
 * enemy, pathfinds to it, and steps one cell along the path. Cooldown resets
 * only on a successful move — when blocked or already in range the unit
 * keeps trying every tick (DESIGN.md "waits 1 tick and retries").
 *
 * Cooldown lives on the behavior instance rather than the Unit so new
 * behaviors don't bloat the Unit class with their bookkeeping. One
 * MovementBehavior per Unit; never share an instance across units.
 */
export class MovementBehavior implements Behavior {
  private cooldown = 0;

  update(unit: Unit, world: World): void {
    if (this.cooldown > 0) {
      this.cooldown--;
      return;
    }

    const target = findTarget(unit, world);
    if (target === null) return;

    if (chebyshev(unit.position, target.position) <= unit.stats.attackRange) {
      return;
    }

    const goal = pickGoalCellInRange(unit, target, world);
    if (goal === null) return;

    const blockers = world.units.map((u) => u.position);
    const path = findPath(unit.position, goal, blockers, world.gridSize);
    if (path.length < 2) return;

    const from = unit.position;
    const to = path[1]!;
    unit.position = to;
    this.cooldown = unit.stats.moveCooldownTicks;
    world.emit('unit:moved', {
      unitId: unit.id,
      from,
      to,
      durationTicks: unit.stats.moveCooldownTicks,
    });
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
