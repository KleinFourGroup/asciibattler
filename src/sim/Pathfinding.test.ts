import { describe, it, expect } from 'vitest';
import { findPath } from './Pathfinding';
import type { GridCoord } from '../core/types';

const G = 12;

describe('Pathfinding / findPath', () => {
  it('returns [start] when start equals goal', () => {
    expect(findPath({ x: 3, y: 3 }, { x: 3, y: 3 }, [], G)).toEqual([{ x: 3, y: 3 }]);
  });

  it('finds a straight diagonal path on an empty grid', () => {
    const path = findPath({ x: 0, y: 0 }, { x: 3, y: 3 }, [], G);
    expect(path.length).toBe(4); // unit-cost diagonals: Chebyshev distance + 1 cell
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 3, y: 3 });
    assertContiguous(path);
  });

  it('finds a straight orthogonal path on an empty grid', () => {
    const path = findPath({ x: 0, y: 5 }, { x: 4, y: 5 }, [], G);
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
    const path = findPath({ x: 3, y: 5 }, { x: 7, y: 5 }, blockers, G);
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
    expect(findPath({ x: 5, y: 5 }, { x: 0, y: 0 }, blockers, G)).toEqual([]);
  });

  it('returns [] when the goal cell itself is blocked', () => {
    expect(findPath({ x: 0, y: 0 }, { x: 5, y: 5 }, [{ x: 5, y: 5 }], G)).toEqual([]);
  });

  it('treats the start cell as passable even if listed as a blocker', () => {
    // A unit pathfinds out of its own cell; the world unit list naturally
    // includes its own position.
    const path = findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, [{ x: 0, y: 0 }], G);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 2, y: 0 });
  });

  it('returns [] for out-of-bounds endpoints', () => {
    expect(findPath({ x: -1, y: 0 }, { x: 0, y: 0 }, [], G)).toEqual([]);
    expect(findPath({ x: 0, y: 0 }, { x: 12, y: 0 }, [], G)).toEqual([]);
  });

  it('is deterministic for the same inputs', () => {
    const a = findPath({ x: 1, y: 1 }, { x: 8, y: 6 }, [{ x: 4, y: 3 }], G);
    const b = findPath({ x: 1, y: 1 }, { x: 8, y: 6 }, [{ x: 4, y: 3 }], G);
    expect(a).toEqual(b);
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
