import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import { findTarget } from '../Targeting';
import { findPath } from '../Pathfinding';

/**
 * Per-unit movement. Reads `unit.actionCooldown` (shared with AttackBehavior
 * and any future action behavior) and only acts when it's 0. On act: pick
 * the nearest enemy, find a cell within attack range, pathfind to it, and
 * step one cell along the path. Cooldown resets only on a successful move —
 * blocked / no-target / already-in-range leaves it at 0 so the unit (or a
 * later behavior in the chain like AttackBehavior) can act this tick.
 *
 * Stateless across ticks; safe to share an instance across units, though
 * Game still creates one per unit for symmetry with future stateful
 * behaviors.
 */
export class MovementBehavior implements Behavior {
  update(unit: Unit, world: World): void {
    if (unit.actionCooldown > 0) return;

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
    // Action ticks are exactly `moveCooldownTicks` apart because World
    // decrements `actionCooldown` once per tick before behaviors run.
    // Matches `durationTicks` on the event so the sprite lerp has no idle
    // gap between consecutive steps.
    unit.actionCooldown = unit.stats.moveCooldownTicks;
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
