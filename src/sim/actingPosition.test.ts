import { describe, it, expect } from 'vitest';
import { nearestActingCell } from './actingPosition';
import { spawnRubble } from './environment';
import { footprintCells } from './occupancy';
import { hasLineOfSight } from './LineOfSight';
import { World } from './World';
import { Unit } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { inertDerived } from './stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import type { GridCoord } from '../core/types';
import type { GameEvents } from '../core/events';

/** A naked World of the given size with `walls` placed as neutral units. */
function mkWorld(w: number, h: number, walls: GridCoord[] = []): World {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1), w, h);
  let id = 1;
  for (const p of walls) {
    world.units.push(
      new Unit({
        id: id++,
        team: 'neutral',
        archetype: 'environment',
        glyph: '#',
        stats: { ...ARCHETYPE_CONFIG.mercenary.baseStats },
        derived: inertDerived(1),
        position: { x: p.x, y: p.y },
      }),
    );
  }
  return world;
}

const cheb = (a: GridCoord, b: GridCoord) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe('nearestActingCell', () => {
  it('returns the nearest in-range cell on an open grid (range-only)', () => {
    const world = mkWorld(12, 12);
    const from = { x: 0, y: 0 };
    const target = { x: 8, y: 0 };
    // range 3, slack 2 → cap 5; the nearest cell within 3 of target is 5 away.
    const cell = nearestActingCell(from, target, 3, 2, world, null);
    expect(cell).not.toBeNull();
    expect(cheb(cell!, target)).toBeLessThanOrEqual(3);
    // "nearest" = it closed exactly the gap (dist-to-target − range) and no more.
    expect(cheb(cell!, from)).toBe(cheb(from, target) - 3);
  });

  it('LOS-gated: skips an in-range cell with no line of sight for one that has it', () => {
    // from is in chebyshev range of target but a wall on the line breaks LOS.
    const target = { x: 5, y: 5 };
    const wall = { x: 3, y: 5 };
    const world = mkWorld(10, 10, [wall]);
    const from = { x: 1, y: 5 };
    expect(cheb(from, target)).toBeLessThanOrEqual(4); // already in range
    expect(hasLineOfSight(from, target, [wall])).toBe(false); // but no shot

    const cell = nearestActingCell(from, target, 4, 2, world, [wall]);
    expect(cell).not.toBeNull();
    expect(cell).not.toEqual(from); // repositioned rather than holding a blocked shot
    expect(cheb(cell!, target)).toBeLessThanOrEqual(4);
    expect(hasLineOfSight(cell!, target, [wall])).toBe(true); // and now it can shoot
  });

  it('range-only (null blockers) ignores LOS — holds when already in range', () => {
    // Same geometry as the LOS test, but null blockers means the wall doesn't
    // gate the shot, so `from` itself already qualifies.
    const target = { x: 5, y: 5 };
    const wall = { x: 3, y: 5 };
    const world = mkWorld(10, 10, [wall]);
    const from = { x: 1, y: 5 };
    const cell = nearestActingCell(from, target, 4, 2, world, null);
    expect(cell).toEqual(from);
  });

  it('never returns a wall cell', () => {
    // A wall sits on the straight-line approach; the chosen acting cell is a
    // real floor cell, never the wall.
    const target = { x: 6, y: 3 };
    const wall = { x: 4, y: 3 };
    const world = mkWorld(10, 10, [wall]);
    const cell = nearestActingCell({ x: 0, y: 3 }, target, 2, 2, world, null);
    expect(cell).not.toBeNull();
    expect(cell).not.toEqual(wall);
    expect(cheb(cell!, target)).toBeLessThanOrEqual(2);
  });

  it('returns null when no in-range cell is reachable within the cap', () => {
    const world = mkWorld(30, 30);
    // Target far beyond range + slack from `from` → BFS exhausts the cap.
    const cell = nearestActingCell({ x: 0, y: 0 }, { x: 25, y: 0 }, 3, 2, world, null);
    expect(cell).toBeNull();
  });

  it('is deterministic — identical inputs yield the same cell', () => {
    const world = mkWorld(12, 12);
    const a = nearestActingCell({ x: 0, y: 0 }, { x: 8, y: 2 }, 3, 2, world, null);
    const b = nearestActingCell({ x: 0, y: 0 }, { x: 8, y: 2 }, 3, 2, world, null);
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
  });

  // O4 — the minRange band [minRange, range]. The 7th arg (default 0) makes a
  // too-close unit search OUTWARD for a standoff cell rather than holding.
  describe('minRange band (O4)', () => {
    it('minRange 0 (the default) is range-only — an in-range unit holds (byte-identical)', () => {
      // Passing minRange 0 explicitly must match the pre-O4 range-only behavior:
      // `from` is already within range, so it qualifies and the unit holds.
      const world = mkWorld(12, 12);
      const from = { x: 4, y: 5 };
      const target = { x: 5, y: 5 }; // cheby 1, in range 4
      expect(nearestActingCell(from, target, 4, 2, world, null, 0)).toEqual(from);
    });

    it('a too-close unit gets a standoff cell OUT at the band (kites away)', () => {
      const world = mkWorld(12, 12);
      const from = { x: 3, y: 5 };
      const target = { x: 5, y: 5 }; // cheby 2 — inside minRange 3
      const cell = nearestActingCell(from, target, 6, 3, world, null, 3);
      expect(cell).not.toBeNull();
      expect(cheb(cell!, target)).toBeGreaterThanOrEqual(3); // honors the floor
      expect(cheb(cell!, target)).toBeLessThanOrEqual(6); // and the ceiling
      expect(cheb(cell!, target)).toBeGreaterThan(cheb(from, target)); // moved AWAY
    });

    it('picks the NEAREST band cell — a minimal one-cell kite, not a full retreat', () => {
      const world = mkWorld(12, 12);
      const from = { x: 4, y: 5 };
      const target = { x: 5, y: 5 }; // cheby 1 — inside minRange 2
      const cell = nearestActingCell(from, target, 6, 3, world, null, 2);
      expect(cell).not.toBeNull();
      // The nearest cell satisfying the floor sits exactly at minRange (2), not
      // farther — the unit backs out one step, it doesn't flee to max range.
      expect(cheb(cell!, target)).toBe(2);
    });
  });

  // 43-pre — the wall set must cover a multi-tile neutral's WHOLE footprint
  // (`cellsOccupiedBy`), not just its canonical corner. The corner-only set let
  // the BFS return (and traverse through) rubble BODY cells — an unreachable
  // goal for `findPath` (which blocks the full footprint) → the PATHING.md
  // river `no_route` spam (78 polls, seed 100).
  describe('multi-tile neutral footprints (43-pre)', () => {
    it('never returns a rubble BODY cell — the river seed-100 repro', () => {
      const world = mkWorld(12, 12);
      spawnRubble(world, { x: 3, y: 2 }, 2); // covers (3,2)(4,2)(3,3)(4,3)
      // The bow (band [2,3]) at (5,3); its target closed to (5,4). Corner-only
      // blocking returned the body cell (4,2); the correct standoff is (5,2).
      const cell = nearestActingCell({ x: 5, y: 3 }, { x: 5, y: 4 }, 3, 2, world, null, 2);
      expect(cell).toEqual({ x: 5, y: 2 });
    });

    it('no from-position around a 3x3 rubble ever yields a footprint cell', () => {
      const world = mkWorld(12, 12);
      const corner = { x: 4, y: 4 };
      spawnRubble(world, corner, 3); // covers (4..6, 4..6)
      const body = footprintCells(corner, 3);
      // Target the rubble's CENTER at range 1: every qualifying cell (cheb ≤ 1
      // of the center) is a body cell, so the only correct answer is null —
      // any non-null result is the corner-only bug returning a body cell.
      const target = { x: 5, y: 5 };
      for (let x = 0; x < 12; x++) {
        for (let y = 0; y < 12; y++) {
          if (body.some((c) => c.x === x && c.y === y)) continue;
          expect(nearestActingCell({ x, y }, target, 1, 2, world, null)).toBeNull();
        }
      }
    });
  });
});
