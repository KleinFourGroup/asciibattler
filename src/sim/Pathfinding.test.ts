import { describe, it, expect } from 'vitest';
import { findPath, type CostFn } from './Pathfinding';
import { TileGrid } from './TileGrid';
import type { GridCoord } from '../core/types';

const G = 12;

describe('Pathfinding / findPath', () => {
  it('returns [start] when start equals goal', () => {
    expect(findPath({ x: 3, y: 3 }, { x: 3, y: 3 }, [], G, G)).toEqual([{ x: 3, y: 3 }]);
  });

  it('finds a straight diagonal path on an empty grid', () => {
    const path = findPath({ x: 0, y: 0 }, { x: 3, y: 3 }, [], G, G);
    expect(path.length).toBe(4); // unit-cost diagonals: Chebyshev distance + 1 cell
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 3, y: 3 });
    assertContiguous(path);
  });

  it('finds a straight orthogonal path on an empty grid', () => {
    const path = findPath({ x: 0, y: 5 }, { x: 4, y: 5 }, [], G, G);
    expect(path.length).toBe(5);
    assertContiguous(path);
  });

  it('routes around a wall of blockers', () => {
    // Wall along x=5, y in [3..7] — agent at (3,5) wants to reach (7,5).
    const blockers: GridCoord[] = [
      { x: 5, y: 3 },
      { x: 5, y: 4 },
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 },
    ];
    const path = findPath({ x: 3, y: 5 }, { x: 7, y: 5 }, blockers, G, G);
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ x: 3, y: 5 });
    expect(path[path.length - 1]).toEqual({ x: 7, y: 5 });
    assertContiguous(path);
    // No path cell may be a blocker.
    for (const c of path) {
      expect(blockers.some((b) => b.x === c.x && b.y === c.y)).toBe(false);
    }
    // And the path must detour off y=5 at least once (straight line is walled).
    expect(path.some((c) => c.y !== 5)).toBe(true);
  });

  it('returns [] when fully walled in', () => {
    // Box the start cell at (5,5) on all 8 sides.
    const blockers: GridCoord[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        blockers.push({ x: 5 + dx, y: 5 + dy });
      }
    }
    expect(findPath({ x: 5, y: 5 }, { x: 0, y: 0 }, blockers, G, G)).toEqual([]);
  });

  it('returns [] when the goal cell itself is blocked', () => {
    expect(findPath({ x: 0, y: 0 }, { x: 5, y: 5 }, [{ x: 5, y: 5 }], G, G)).toEqual([]);
  });

  it('treats the start cell as passable even if listed as a blocker', () => {
    // A unit pathfinds out of its own cell; the world unit list naturally
    // includes its own position.
    const path = findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, [{ x: 0, y: 0 }], G, G);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 2, y: 0 });
  });

  it('returns [] for out-of-bounds endpoints', () => {
    expect(findPath({ x: -1, y: 0 }, { x: 0, y: 0 }, [], G, G)).toEqual([]);
    expect(findPath({ x: 0, y: 0 }, { x: 12, y: 0 }, [], G, G)).toEqual([]);
  });

  it('respects asymmetric bounds (D3 rectangular grids)', () => {
    // 20 wide x 10 tall — (15, 8) is in-bounds; (5, 12) is not.
    expect(findPath({ x: 0, y: 0 }, { x: 15, y: 8 }, [], 20, 10)).not.toEqual([]);
    expect(findPath({ x: 0, y: 0 }, { x: 5, y: 12 }, [], 20, 10)).toEqual([]);
    // And the reverse: 10 wide x 20 tall — (15, 5) is out of width.
    expect(findPath({ x: 0, y: 0 }, { x: 15, y: 5 }, [], 10, 20)).toEqual([]);
    expect(findPath({ x: 0, y: 0 }, { x: 5, y: 15 }, [], 10, 20)).not.toEqual([]);
  });

  it('is deterministic for the same inputs', () => {
    const a = findPath({ x: 1, y: 1 }, { x: 8, y: 6 }, [{ x: 4, y: 3 }], G, G);
    const b = findPath({ x: 1, y: 1 }, { x: 8, y: 6 }, [{ x: 4, y: 3 }], G, G);
    expect(a).toEqual(b);
  });
});

describe('Pathfinding / findPath with per-cell costs', () => {
  it('explicit unit-cost callback matches the default', () => {
    const unit: CostFn = () => 1;
    const withCallback = findPath({ x: 0, y: 0 }, { x: 5, y: 5 }, [], G, G, unit);
    const withDefault = findPath({ x: 0, y: 0 }, { x: 5, y: 5 }, [], G, G);
    expect(withCallback).toEqual(withDefault);
  });

  it('reroutes around a high-cost column when a cheaper detour exists', () => {
    // Column at x=3 costs 5; cheaper to skirt above/below. Direct line is
    // 4 steps × 1 cost = 4; route via (3,5) at cost 5 vs. detour via y=5
    // staying on cost-1 tiles. Path from (0,5) to (5,5): direct goes
    // through (3,5) for 4 unit-cost steps + 1 cost-5 step = 9. Detour
    // via (3,6) [or (3,4)] still has to cross x=3, so what we actually
    // care about is the path *length* — equal, so it picks the diagonal.
    // Better test: make one column WALL-LIKE expensive and check the path
    // crosses the cheaper cells.
    const heavyColumn = new Set(['3,3', '3,4', '3,5', '3,6', '3,7']);
    const costAt: CostFn = (c) => (heavyColumn.has(`${c.x},${c.y}`) ? 10 : 1);

    const path = findPath({ x: 0, y: 5 }, { x: 6, y: 5 }, [], G, G, costAt);
    expect(path.length).toBeGreaterThan(0);
    // The min-cost path crosses x=3 exactly once; that crossing must be at
    // y=2 or y=8 (the cheap rows above/below the heavy column).
    const xThreeCrossings = path.filter((c) => c.x === 3);
    expect(xThreeCrossings.length).toBe(1);
    const crossing = xThreeCrossings[0]!;
    expect(heavyColumn.has(`${crossing.x},${crossing.y}`)).toBe(false);
  });

  it('still routes through high-cost tile when no cheaper alternative exists', () => {
    // Whole grid is high-cost except the direct line; path should still find it.
    const onLine = (c: GridCoord): boolean => c.y === 0;
    const costAt: CostFn = (c) => (onLine(c) ? 1 : 10);

    const path = findPath({ x: 0, y: 0 }, { x: 5, y: 0 }, [], G, G, costAt);
    expect(path.length).toBe(6);
    for (const c of path) expect(c.y).toBe(0);
  });

  it('treats Infinity cost as a data-driven block (equivalent to a blocker)', () => {
    // Wall x=5 via cost=Infinity instead of the blockers list.
    const walled = new Set(['5,3', '5,4', '5,5', '5,6', '5,7']);
    const costAt: CostFn = (c) => (walled.has(`${c.x},${c.y}`) ? Infinity : 1);

    const path = findPath({ x: 3, y: 5 }, { x: 7, y: 5 }, [], G, G, costAt);
    expect(path.length).toBeGreaterThan(0);
    for (const c of path) {
      expect(walled.has(`${c.x},${c.y}`)).toBe(false);
    }
  });

  it('start cell cost is not charged (you start there for free)', () => {
    // Even if the start cell has huge cost, A* should still find a path
    // because it doesn't pay to be there.
    const costAt: CostFn = (c) => (c.x === 0 && c.y === 0 ? 1000 : 1);
    const path = findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, [], G, G, costAt);
    expect(path.length).toBe(4);
  });

  it('D7.A: chasm tiles via TileGrid.costAt block paths and route around', () => {
    // Wall x=5 via chasm (Infinity cost in TileGrid) instead of the
    // blockers list. End-to-end check that TileGrid → CostFn → A* glues
    // correctly for the D7.A chasm kind.
    const grid = new TileGrid(G, G);
    for (let y = 3; y <= 7; y++) grid.setKind({ x: 5, y }, 'chasm');
    const costAt: CostFn = (c) => grid.costAt(c);

    const path = findPath({ x: 3, y: 5 }, { x: 7, y: 5 }, [], G, G, costAt);
    expect(path.length).toBeGreaterThan(0);
    for (const c of path) {
      expect(grid.kindAt(c)).not.toBe('chasm');
    }
    // The path must detour off y=5 at least once (straight line is chasm-walled).
    expect(path.some((c) => c.y !== 5)).toBe(true);
  });
});

describe('Pathfinding / findPath best-effort (J3)', () => {
  it('routes to the closest reachable cell when the goal is a blocker', () => {
    // Strict gives up on a blocked goal; best-effort lands adjacent to it.
    expect(findPath({ x: 0, y: 0 }, { x: 5, y: 5 }, [{ x: 5, y: 5 }], G, G)).toEqual([]);
    const path = findPath({ x: 0, y: 0 }, { x: 5, y: 5 }, [{ x: 5, y: 5 }], G, G, undefined, true);
    expect(path.length).toBeGreaterThan(1);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    const end = path[path.length - 1]!;
    expect(end).not.toEqual({ x: 5, y: 5 }); // never lands ON the blocked goal
    expect(Math.max(Math.abs(end.x - 5), Math.abs(end.y - 5))).toBe(1); // as close as it can
    assertContiguous(path);
  });

  it('approaches a goal walled off behind an unbroken barrier', () => {
    // A full vertical wall at x=5 splits the grid; (10,5) is unreachable from
    // (0,5). Strict []; best-effort presses up against the wall (x=4).
    const blockers: GridCoord[] = [];
    for (let y = 0; y < G; y++) blockers.push({ x: 5, y });
    expect(findPath({ x: 0, y: 5 }, { x: 10, y: 5 }, blockers, G, G)).toEqual([]);
    const path = findPath({ x: 0, y: 5 }, { x: 10, y: 5 }, blockers, G, G, undefined, true);
    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1]!.x).toBe(4);
    assertContiguous(path);
  });

  it('is identical to strict when the goal IS reachable', () => {
    const strict = findPath({ x: 0, y: 0 }, { x: 4, y: 3 }, [{ x: 2, y: 1 }], G, G);
    const effort = findPath({ x: 0, y: 0 }, { x: 4, y: 3 }, [{ x: 2, y: 1 }], G, G, undefined, true);
    expect(effort).toEqual(strict);
    expect(effort[effort.length - 1]).toEqual({ x: 4, y: 3 });
  });

  it('returns [start] (a hold, never []) when fully walled in', () => {
    const blockers: GridCoord[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        blockers.push({ x: 5 + dx, y: 5 + dy });
      }
    }
    expect(findPath({ x: 5, y: 5 }, { x: 0, y: 0 }, blockers, G, G, undefined, true)).toEqual([
      { x: 5, y: 5 },
    ]);
  });
});

function assertContiguous(path: GridCoord[]): void {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
      throw new Error(`non-contiguous step from ${JSON.stringify(a)} to ${JSON.stringify(b)}`);
    }
  }
}
