import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { ALL_UNIT_DEFS } from '../config/units';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { Team, Unit, UnitStats } from './Unit';
import {
  GROUND,
  anchorFootprint,
  cellKey,
  cellsOccupiedBy,
  claimantOf,
  claimedCells,
  distanceBetween,
  findOverlappingCells,
  footprintCells,
  footprintFits,
  footprintOf,
  isClaimed,
  isFree,
  occupiedCells,
  planeOf,
  unitAt,
  unitDistance,
  cellUnitDistance,
  vacancyEtaOf,
} from './occupancy';
import { MoveAction } from './actions/MoveAction';
import { moveProposal } from './movement';
import { SIM } from '../config/sim';

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
  return world.spawnEnvironment({ archetype: 'wall', position: pos });
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

/**
 * §39a — the footprint geometry fill. `cellsOccupiedBy` returns the N×N block;
 * `unitDistance` is the body-to-body (min cell-to-cell) distance seam. §39 keeps
 * footprints INERT for the shipped roster (no multi-tile def ships until §40's
 * rubble), so the multi-tile path is exercised only here — via temp catalog ids
 * registered/removed around the block, plus `Unit`-shaped stubs (the geometry
 * only reads `.archetype` + `.position`). The single-cell path is the shipped
 * roster's, and stays byte-identical.
 */
describe('§39a — the footprint geometry seams', () => {
  const G2 = '__test_giant2'; // a 2×2 footprint
  const G3 = '__test_giant3'; // a 3×3 footprint

  beforeAll(() => {
    (ALL_UNIT_DEFS as Record<string, { footprint: number }>)[G2] = { footprint: 2 };
    (ALL_UNIT_DEFS as Record<string, { footprint: number }>)[G3] = { footprint: 3 };
  });
  afterAll(() => {
    delete (ALL_UNIT_DEFS as Record<string, unknown>)[G2];
    delete (ALL_UNIT_DEFS as Record<string, unknown>)[G3];
  });

  const stub = (archetype: string, pos: GridCoord): Unit =>
    ({ archetype, position: pos }) as unknown as Unit;

  describe('footprintCells — the pure N×N geometry core', () => {
    it('n=1 is a single copy of the corner', () => {
      expect(footprintCells({ x: 2, y: 3 }, 1)).toEqual([{ x: 2, y: 3 }]);
    });

    it('n=2 is the 4-cell block extending toward +x/+y from the corner', () => {
      expect(footprintCells({ x: 0, y: 0 }, 2)).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ]);
    });

    it('n=3 / n=4 fill the whole square (N² cells, min corner at the anchor)', () => {
      const three = footprintCells({ x: 5, y: 7 }, 3);
      expect(three).toHaveLength(9);
      expect(three).toContainEqual({ x: 5, y: 7 }); // the min corner
      expect(three).toContainEqual({ x: 7, y: 9 }); // the far corner
      expect(footprintCells({ x: 0, y: 0 }, 4)).toHaveLength(16);
    });
  });

  describe('footprintOf — the call-time catalog read', () => {
    it('reads the §38 footprint field off the catalog def', () => {
      expect(footprintOf(stub(G2, { x: 0, y: 0 }))).toBe(2);
      expect(footprintOf(stub(G3, { x: 0, y: 0 }))).toBe(3);
    });

    it('defaults to 1 for the shipped (single-cell) roster', () => {
      const world = setup();
      const merc = spawnAt(world, 'player', { x: 1, y: 1 });
      expect(footprintOf(merc)).toBe(1);
    });
  });

  describe('cellsOccupiedBy — the N×N block from the corner', () => {
    it('returns the whole 2×2 block anchored at the canonical corner', () => {
      expect(cellsOccupiedBy(stub(G2, { x: 4, y: 4 }))).toEqual([
        { x: 4, y: 4 },
        { x: 5, y: 4 },
        { x: 4, y: 5 },
        { x: 5, y: 5 },
      ]);
    });

    it('single-cell units keep the reference-identical [position] fast path', () => {
      const world = setup();
      const merc = spawnAt(world, 'player', { x: 3, y: 6 });
      const cells = cellsOccupiedBy(merc);
      expect(cells).toEqual([{ x: 3, y: 6 }]);
      expect(cells[0]).toBe(merc.position); // same object — byte-identical to pre-§39
    });
  });

  describe('footprintFits — rejects a block overlapping any occupant', () => {
    it('rejects a block overlapping a combatant', () => {
      const world = setup();
      spawnAt(world, 'player', { x: 4, y: 4 });
      expect(footprintFits(world, footprintCells({ x: 3, y: 3 }, 2))).toBe(false); // covers (4,4)
      expect(footprintFits(world, footprintCells({ x: 6, y: 6 }, 2))).toBe(true); // clear
    });

    it('rejects a block overlapping a neutral wall', () => {
      const world = setup();
      wallAt(world, { x: 5, y: 5 });
      expect(footprintFits(world, footprintCells({ x: 4, y: 4 }, 2))).toBe(false); // covers (5,5)
    });
  });

  describe('unitDistance — the footprint-aware body-to-body distance', () => {
    it('a 2×2 and a unit hugging its edge are at distance 1', () => {
      const giant = stub(G2, { x: 0, y: 0 }); // occupies (0,0),(1,0),(0,1),(1,1)
      const adjacent = stub('mercenary', { x: 2, y: 0 }); // one cell past the +x edge
      expect(unitDistance(giant, adjacent)).toBe(1);
    });

    it('overlapping bodies are at distance 0', () => {
      const giant = stub(G2, { x: 0, y: 0 });
      const inside = stub('mercenary', { x: 1, y: 1 }); // a cell the giant occupies
      expect(unitDistance(giant, inside)).toBe(0);
    });

    it('two single-cell units reduce to distanceBetween (byte-identical adjacency)', () => {
      const a = stub('mercenary', { x: 2, y: 2 });
      const b = stub('mercenary', { x: 5, y: 4 });
      expect(unitDistance(a, b)).toBe(distanceBetween({ x: 2, y: 2 }, { x: 5, y: 4 }));
    });

    it('measures from the nearest cell of each body (2×2 to a distant 3×3)', () => {
      const g2 = stub(G2, { x: 0, y: 0 }); // far edge at x=1
      const g3 = stub(G3, { x: 5, y: 0 }); // near edge at x=5
      // nearest cells (1,0)→(5,0): Chebyshev 4.
      expect(unitDistance(g2, g3)).toBe(4);
    });
  });

  describe('cellUnitDistance — the cell-to-body distance (44-pre-b)', () => {
    it('measures to the NEAREST footprint cell, not the §39 corner', () => {
      const giant = stub(G2, { x: 5, y: 5 }); // occupies (5,5)..(6,6)
      // From (8,6): corner (5,5) is Chebyshev 3, body cell (6,6) is 2.
      expect(cellUnitDistance({ x: 8, y: 6 }, giant)).toBe(2);
    });

    it('a cell inside the body is at distance 0', () => {
      const giant = stub(G3, { x: 2, y: 2 }); // occupies (2,2)..(4,4)
      expect(cellUnitDistance({ x: 4, y: 3 }, giant)).toBe(0);
      expect(cellUnitDistance({ x: 2, y: 2 }, giant)).toBe(0); // the corner too
    });

    it('single-cell units reduce to distanceBetween (byte-identical fast path)', () => {
      const merc = stub('mercenary', { x: 3, y: 7 });
      expect(cellUnitDistance({ x: 6, y: 5 }, merc)).toBe(
        distanceBetween({ x: 6, y: 5 }, { x: 3, y: 7 }),
      );
    });
  });
});

/**
 * §39c — the spawn anchoring policy (`anchorFootprint`, the `corner` policy).
 * Pure + World-free: a grid-dims record + an `isFreeCell` predicate built from a
 * key set. Inert until §40 spawns the first multi-tile body.
 */
describe('§39c — anchorFootprint (the corner spawn policy)', () => {
  const GRID = { gridW: 12, gridH: 12 };
  const freeExcept = (occupied: string[]): ((c: GridCoord) => boolean) => {
    const occ = new Set(occupied);
    return (c) => !occ.has(cellKey(c));
  };
  const allFree = () => true;

  it('extends +x/+y from a center tile (the default orientation)', () => {
    expect(anchorFootprint({ x: 2, y: 2 }, 2, GRID, allFree)).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ]);
  });

  it('keeps an edge-tile spawn on-grid by extending inward', () => {
    // Right-edge tile: the default +x block would spill to x=12, so it flips.
    const cells = anchorFootprint({ x: 11, y: 5 }, 2, GRID, allFree);
    expect(cells).not.toBeNull();
    for (const c of cells!) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(GRID.gridW);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(GRID.gridH);
    }
    expect(cells).toContainEqual({ x: 11, y: 5 }); // the spawn tile is a corner
  });

  it('anchors a bottom-right corner tile with both flips', () => {
    expect(anchorFootprint({ x: 11, y: 11 }, 2, GRID, allFree)).toEqual([
      { x: 10, y: 10 },
      { x: 11, y: 10 },
      { x: 10, y: 11 },
      { x: 11, y: 11 },
    ]);
  });

  it('size 1 collapses to the single-tile spawn check', () => {
    expect(anchorFootprint({ x: 3, y: 3 }, 1, GRID, allFree)).toEqual([{ x: 3, y: 3 }]);
    expect(anchorFootprint({ x: 3, y: 3 }, 1, GRID, freeExcept(['3,3']))).toBeNull();
  });

  it('falls through to an orientation that clears an occupied cell', () => {
    // (6,5) blocks the default +x block; the −x flip (4,5)-corner is clear.
    const cells = anchorFootprint({ x: 5, y: 5 }, 2, GRID, freeExcept(['6,5']));
    expect(cells).toEqual([
      { x: 4, y: 5 },
      { x: 5, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
    ]);
  });

  it('returns null when no orientation fits — the spawn tile itself is occupied', () => {
    // Every orientation includes the spawn tile, so occupying it rules all out.
    expect(anchorFootprint({ x: 5, y: 5 }, 2, GRID, freeExcept(['5,5']))).toBeNull();
  });

  it('returns null when the body is too big for the grid', () => {
    expect(anchorFootprint({ x: 0, y: 0 }, 4, { gridW: 3, gridH: 3 }, allFree)).toBeNull();
  });
});

describe('vacancyEtaOf — the §45a derived vacancy ETA', () => {
  // Seat a MoveAction mid-flight the way World.executeActions does, including
  // the destination claim `MoveAction.start` would have placed — `ticksAgo`
  // back-dates the start so "N ticks into the move" needs no World.tick loop.
  function seatMove(world: World, unit: Unit, to: GridCoord, travel: number, ticksAgo = 0) {
    const durationTicks = travel * 2; // moveFlipFraction 0.5 shape: travel == recovery
    const action = new MoveAction(unit.position, to, durationTicks);
    unit.activeAction = {
      action,
      startTick: world.currentTick - ticksAgo,
      finishTick: world.currentTick - ticksAgo + durationTicks,
      phases: [
        { phase: 'travel', ticks: travel },
        { phase: 'impact', ticks: 0 },
        { phase: 'recovery', ticks: durationTicks - travel },
      ],
    };
    world.claimCell(to, unit.id);
  }

  it('is undefined for an idle unit (no active action)', () => {
    const world = setup();
    const u = spawnAt(world, 'player', { x: 2, y: 2 });
    u.activeAction = null;
    expect(vacancyEtaOf(u, world)).toBeUndefined();
  });

  it('is undefined for a non-move active action (nothing vacates)', () => {
    const world = setup();
    const u = spawnAt(world, 'player', { x: 2, y: 2 });
    // spawnUnit seats a SpawnAction lockout — exactly the non-move case.
    expect(u.activeAction?.action.id).not.toBe('move');
    expect(vacancyEtaOf(u, world)).toBeUndefined();
  });

  it('pre-flip: ETA is the impact boundary minus now', () => {
    const world = setup();
    const u = spawnAt(world, 'player', { x: 2, y: 2 });
    seatMove(world, u, { x: 3, y: 2 }, 5);
    expect(vacancyEtaOf(u, world)).toBe(5);
  });

  it('counts down as ticks pass (back-dated start)', () => {
    const world = setup();
    const u = spawnAt(world, 'player', { x: 2, y: 2 });
    seatMove(world, u, { x: 3, y: 2 }, 5, 3);
    expect(vacancyEtaOf(u, world)).toBe(2);
  });

  it('clamps at 0 when the flip lands this tick', () => {
    const world = setup();
    const u = spawnAt(world, 'player', { x: 2, y: 2 });
    seatMove(world, u, { x: 3, y: 2 }, 5, 5);
    expect(vacancyEtaOf(u, world)).toBe(0);
  });

  it('is undefined POST-flip (claim released — the unit is arriving, not vacating)', () => {
    const world = setup();
    const u = spawnAt(world, 'player', { x: 2, y: 2 });
    seatMove(world, u, { x: 3, y: 2 }, 5, 7);
    // Simulate the §36b flip: position moves, the claim releases.
    u.position = { x: 3, y: 2 };
    world.releaseClaim({ x: 3, y: 2 });
    expect(vacancyEtaOf(u, world)).toBeUndefined();
  });

  it('derives the same boundary a real moveProposal timeline carries', () => {
    const world = setup();
    const u = spawnAt(world, 'player', { x: 2, y: 2 });
    const durationTicks = 8;
    const proposal = moveProposal(u.position, { x: 3, y: 2 }, durationTicks);
    u.activeAction = {
      action: proposal.action,
      startTick: world.currentTick,
      finishTick: world.currentTick + durationTicks,
      phases: proposal.phases,
    };
    world.claimCell({ x: 3, y: 2 }, u.id);
    // Balance-proof: the flip offset derives from config, never hardcoded.
    expect(vacancyEtaOf(u, world)).toBe(Math.floor(durationTicks * SIM.moveFlipFraction));
  });
});
