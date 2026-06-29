import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { Team, UnitStats } from './Unit';
import {
  GROUND,
  cellKey,
  cellsOccupiedBy,
  claimantOf,
  claimedCells,
  distanceBetween,
  findOverlappingCells,
  footprintFits,
  isClaimed,
  isFree,
  occupiedCells,
  planeOf,
  unitAt,
} from './occupancy';

/**
 * §35a — the occupancy core, in isolation. Mechanic tests on explicit inputs:
 * place a few units via the World API (real ids + `unitsById`) and assert the
 * point query, the set builder, the footprint/distance/plane seams. These pin
 * the single-cell / one-plane BEHAVIOR the scattered checks used to compute
 * inline — the byte-identical-refactor contract — so §39 (footprint fill) and
 * the flight build (the air plane) extend a proven seam.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

function setup() {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  return world;
}

function spawnAt(world: World, team: Team, pos: GridCoord) {
  return world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
}

function wallAt(world: World, pos: GridCoord) {
  return world.spawnEnvironment({ glyph: '#', position: pos });
}

describe('cellKey / cellsOccupiedBy / planeOf — the seams', () => {
  it('cellKey is the canonical "x,y"', () => {
    expect(cellKey({ x: 3, y: 7 })).toBe('3,7');
    expect(cellKey({ x: 0, y: 0 })).toBe('0,0');
  });

  it('cellsOccupiedBy is the single anchor cell today (the footprint seam)', () => {
    const world = setup();
    const u = spawnAt(world, 'player', { x: 4, y: 2 });
    expect(cellsOccupiedBy(u)).toEqual([{ x: 4, y: 2 }]);
  });

  it('planeOf is ground for every unit today (the plane seam)', () => {
    const world = setup();
    const u = spawnAt(world, 'player', { x: 1, y: 1 });
    const w = wallAt(world, { x: 2, y: 2 });
    expect(planeOf(u)).toBe(GROUND);
    expect(planeOf(w)).toBe(GROUND);
  });
});

describe('distanceBetween — the chebyshev distance seam', () => {
  it('is the 8-connected (Chebyshev) distance', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
    expect(distanceBetween({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe(5);
    expect(distanceBetween({ x: 0, y: 0 }, { x: 4, y: 4 })).toBe(4); // diagonal = 1 step each
    expect(distanceBetween({ x: 1, y: 2 }, { x: 4, y: 8 })).toBe(6); // max(3, 6)
    expect(distanceBetween({ x: 5, y: 5 }, { x: 2, y: 4 })).toBe(3); // order-independent
  });
});

describe('unitAt / isFree — the occupancy point query', () => {
  it('finds the unit standing on a cell and reports the cell occupied', () => {
    const world = setup();
    const u = spawnAt(world, 'player', { x: 6, y: 6 });
    expect(unitAt(world, { x: 6, y: 6 })).toBe(u);
    expect(isFree(world, { x: 6, y: 6 })).toBe(false);
  });

  it('reports an empty cell free', () => {
    const world = setup();
    spawnAt(world, 'player', { x: 6, y: 6 });
    expect(unitAt(world, { x: 7, y: 6 })).toBeUndefined();
    expect(isFree(world, { x: 7, y: 6 })).toBe(true);
  });

  it('counts neutral walls as occupying a cell (the overflow-scan contract)', () => {
    const world = setup();
    wallAt(world, { x: 3, y: 3 });
    expect(isFree(world, { x: 3, y: 3 })).toBe(false);
  });

  it('matches a manual "any unit here" scan across a populated board (byte-identical)', () => {
    const world = setup();
    spawnAt(world, 'player', { x: 2, y: 2 });
    spawnAt(world, 'enemy', { x: 5, y: 5 });
    wallAt(world, { x: 3, y: 3 });
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const cell = { x, y };
        const manual = world.units.some((u) => u.position.x === x && u.position.y === y);
        expect(isFree(world, cell)).toBe(!manual);
      }
    }
  });
});

describe('occupiedCells — the shared set builder', () => {
  it('keys every unit cell, neutrals included', () => {
    const world = setup();
    spawnAt(world, 'player', { x: 2, y: 2 });
    spawnAt(world, 'enemy', { x: 5, y: 5 });
    wallAt(world, { x: 3, y: 3 });
    expect(occupiedCells(world)).toEqual(new Set(['2,2', '5,5', '3,3']));
  });

  it('drops the excluded unit (the mover itself)', () => {
    const world = setup();
    const me = spawnAt(world, 'player', { x: 2, y: 2 });
    spawnAt(world, 'enemy', { x: 5, y: 5 });
    expect(occupiedCells(world, GROUND, { excludeId: me.id })).toEqual(new Set(['5,5']));
  });
});

describe('footprintFits — the occupancy half of the fit check', () => {
  it('is true when every cell is free, false when any is taken', () => {
    const world = setup();
    spawnAt(world, 'player', { x: 4, y: 4 });
    expect(footprintFits(world, [{ x: 5, y: 4 }, { x: 6, y: 4 }])).toBe(true);
    expect(footprintFits(world, [{ x: 4, y: 4 }, { x: 5, y: 4 }])).toBe(false); // overlaps the unit
  });

  it('single-cell footprintFits equals isFree', () => {
    const world = setup();
    spawnAt(world, 'player', { x: 4, y: 4 });
    expect(footprintFits(world, [{ x: 4, y: 4 }])).toBe(isFree(world, { x: 4, y: 4 }));
    expect(footprintFits(world, [{ x: 7, y: 7 }])).toBe(isFree(world, { x: 7, y: 7 }));
  });
});

describe('findOverlappingCells — the §35d invariant detector', () => {
  it('is empty when every unit has its own cell', () => {
    const world = setup();
    spawnAt(world, 'player', { x: 2, y: 2 });
    spawnAt(world, 'enemy', { x: 5, y: 5 });
    wallAt(world, { x: 3, y: 3 });
    expect(findOverlappingCells(world)).toEqual([]);
  });

  it('flags a cell two units share (combatant or neutral, any team)', () => {
    const world = setup();
    spawnAt(world, 'player', { x: 3, y: 3 });
    spawnAt(world, 'enemy', { x: 3, y: 3 }); // forced co-location
    expect(findOverlappingCells(world)).toEqual(['3,3']);
  });
});

describe('§36a — the claim registry queries', () => {
  it('claimCell makes a cell claimed; releaseClaim frees it', () => {
    const world = setup();
    const u = spawnAt(world, 'player', { x: 2, y: 2 });
    const cell = { x: 4, y: 4 };
    expect(isClaimed(world, cell)).toBe(false);
    expect(claimantOf(world, cell)).toBeUndefined();

    world.claimCell(cell, u.id);
    expect(isClaimed(world, cell)).toBe(true);
    expect(claimantOf(world, cell)).toBe(u.id);

    world.releaseClaim(cell);
    expect(isClaimed(world, cell)).toBe(false);
    expect(claimantOf(world, cell)).toBeUndefined();
  });

  it("claimedCells lists claimed cells and drops the building unit's own", () => {
    const world = setup();
    const a = spawnAt(world, 'player', { x: 0, y: 0 });
    const b = spawnAt(world, 'enemy', { x: 9, y: 9 });
    world.claimCell({ x: 3, y: 3 }, a.id);
    world.claimCell({ x: 5, y: 5 }, b.id);

    expect(claimedCells(world)).toEqual(new Set(['3,3', '5,5']));
    // The mover's own claim is excluded — it may step into what it reserved.
    expect(claimedCells(world, GROUND, { excludeId: a.id })).toEqual(new Set(['5,5']));
  });

  it('releaseClaimsBy drops every claim a unit holds', () => {
    const world = setup();
    const a = spawnAt(world, 'player', { x: 0, y: 0 });
    const b = spawnAt(world, 'enemy', { x: 9, y: 9 });
    world.claimCell({ x: 3, y: 3 }, a.id);
    world.claimCell({ x: 4, y: 4 }, a.id);
    world.claimCell({ x: 5, y: 5 }, b.id);

    world.releaseClaimsBy(a.id);
    expect(claimedCells(world)).toEqual(new Set(['5,5']));
  });

  it('claimCell is idempotent per cell (last writer wins)', () => {
    const world = setup();
    const a = spawnAt(world, 'player', { x: 0, y: 0 });
    const b = spawnAt(world, 'enemy', { x: 9, y: 9 });
    world.claimCell({ x: 6, y: 6 }, a.id);
    world.claimCell({ x: 6, y: 6 }, b.id); // re-claim the same cell
    expect(claimantOf(world, { x: 6, y: 6 })).toBe(b.id);
    expect(world.claims.size).toBe(1);
  });
});
