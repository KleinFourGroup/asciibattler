import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { Team, Unit, UnitStats } from './Unit';
import { ALL_UNIT_DEFS } from '../config/units';
import { pushLanding } from './push';

/**
 * A forced move's landing (`pushLanding`), one stopping rule a test. Each
 * test's expectation is worked out on the grid by hand from the rule it
 * names, not from the function.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  speed: 0, mobility: 0, power: 1,
};

function setup(): World {
  return new World(new EventBus<GameEvents>(), new RNG(1), 12, 12);
}

function spawnAt(world: World, pos: GridCoord, team: Team = 'enemy'): Unit {
  return world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
}

describe('pushLanding — away from an origin', () => {
  it('walks its cells along a row on open floor', () => {
    const world = setup();
    const v = spawnAt(world, { x: 6, y: 5 });
    expect(pushLanding(world, v, { x: 5, y: 5 }, 'away', 2)).toEqual({ cell: { x: 8, y: 5 }, cells: 2 });
  });

  it('takes the sign of the offset on each axis, so (2, 1) off goes diagonally', () => {
    const world = setup();
    const v = spawnAt(world, { x: 7, y: 6 });
    expect(pushLanding(world, v, { x: 5, y: 5 }, 'away', 2)).toEqual({ cell: { x: 9, y: 8 }, cells: 2 });
  });

  it("stops at the board's edge, and a victim on the edge does not move", () => {
    const world = setup();
    const v = spawnAt(world, { x: 10, y: 5 });
    expect(pushLanding(world, v, { x: 9, y: 5 }, 'away', 3)).toEqual({ cell: { x: 11, y: 5 }, cells: 1 });
    const w = spawnAt(world, { x: 11, y: 8 });
    expect(pushLanding(world, w, { x: 10, y: 8 }, 'away', 3)).toBeNull();
  });

  it('stops before a chasm and before deep water, as at a wall, for a victim that cannot fall', () => {
    const world = setup();
    world.tileGrid.setKind({ x: 8, y: 5 }, 'chasm');
    const v = spawnAt(world, { x: 6, y: 5 });
    expect(pushLanding(world, v, { x: 5, y: 5 }, 'away', 3)).toEqual({ cell: { x: 7, y: 5 }, cells: 1 });
    world.tileGrid.setKind({ x: 8, y: 2 }, 'deep_water');
    const w = spawnAt(world, { x: 6, y: 2 });
    expect(pushLanding(world, w, { x: 5, y: 2 }, 'away', 3)).toEqual({ cell: { x: 7, y: 2 }, cells: 1 });
  });

  it('stops before another body, a unit or scenery', () => {
    const world = setup();
    spawnAt(world, { x: 8, y: 5 }, 'player');
    const v = spawnAt(world, { x: 6, y: 5 });
    expect(pushLanding(world, v, { x: 5, y: 5 }, 'away', 3)).toEqual({ cell: { x: 7, y: 5 }, cells: 1 });
    world.spawnEnvironment({ archetype: 'wall', position: { x: 8, y: 2 } });
    const w = spawnAt(world, { x: 6, y: 2 });
    expect(pushLanding(world, w, { x: 5, y: 2 }, 'away', 3)).toEqual({ cell: { x: 7, y: 2 }, cells: 1 });
  });

  it("stops before a cell another unit has claimed, but walks through the victim's own claim", () => {
    const world = setup();
    const other = spawnAt(world, { x: 1, y: 1 }, 'player');
    world.claimCell({ x: 8, y: 5 }, other.id);
    const v = spawnAt(world, { x: 6, y: 5 });
    expect(pushLanding(world, v, { x: 5, y: 5 }, 'away', 3)).toEqual({ cell: { x: 7, y: 5 }, cells: 1 });

    const w = spawnAt(world, { x: 6, y: 2 });
    world.claimCell({ x: 7, y: 2 }, w.id); // the step it is abandoning
    expect(pushLanding(world, w, { x: 5, y: 2 }, 'away', 3)).toEqual({ cell: { x: 9, y: 2 }, cells: 3 });
  });

  it('pushes a victim on the origin away from the caster, and leaves it without one', () => {
    const world = setup();
    const v = spawnAt(world, { x: 5, y: 5 });
    expect(pushLanding(world, v, { x: 5, y: 5 }, 'away', 2, { fallback: { x: 3, y: 5 } })).toEqual({ cell: { x: 7, y: 5 }, cells: 2 });
    expect(pushLanding(world, v, { x: 5, y: 5 }, 'away', 2)).toBeNull();
  });

  it('moves nothing for no cells', () => {
    const world = setup();
    const v = spawnAt(world, { x: 6, y: 5 });
    expect(pushLanding(world, v, { x: 5, y: 5 }, 'away', 0)).toBeNull();
  });
});

describe('pushLanding — who never moves', () => {
  it('never moves scenery', () => {
    const world = setup();
    const wall = world.spawnEnvironment({ archetype: 'wall', position: { x: 6, y: 5 } });
    expect(pushLanding(world, wall, { x: 5, y: 5 }, 'away', 2)).toBeNull();
  });

  describe('a body larger than one cell', () => {
    const G2 = '__test_push_giant2';
    beforeAll(() => {
      (ALL_UNIT_DEFS as Record<string, { footprint: number }>)[G2] = { footprint: 2 };
    });
    afterAll(() => {
      delete (ALL_UNIT_DEFS as Record<string, unknown>)[G2];
    });

    it('never moves', () => {
      const world = setup();
      // The walk reads the victim's id, archetype, team, camp and cell.
      const giant = { id: 999, archetype: G2, team: 'enemy', campId: null, position: { x: 6, y: 5 } } as unknown as Unit;
      expect(pushLanding(world, giant, { x: 5, y: 5 }, 'away', 2)).toBeNull();
    });
  });
});

describe('pushLanding — toward an origin (the pull)', () => {
  it('stops beside its caster, whose body is on the origin', () => {
    const world = setup();
    const caster = spawnAt(world, { x: 2, y: 5 }, 'player');
    const v = spawnAt(world, { x: 7, y: 5 });
    expect(pushLanding(world, v, caster.position, 'toward', 10)).toEqual({ cell: { x: 3, y: 5 }, cells: 4 });
  });

  it('stops beside an empty origin rather than landing on it', () => {
    const world = setup();
    const v = spawnAt(world, { x: 8, y: 5 });
    expect(pushLanding(world, v, { x: 5, y: 5 }, 'toward', 5)).toEqual({ cell: { x: 6, y: 5 }, cells: 2 });
  });

  it('stops once a cell would bring it no nearer, so it never passes its caster', () => {
    const world = setup();
    // From (5, 7) toward (0, 5) the direction is (-1, -1): (4, 6) at 4,
    // (3, 5) at 3, (2, 4) at 2, and (1, 3) would be 2 again.
    const v = spawnAt(world, { x: 5, y: 7 });
    expect(pushLanding(world, v, { x: 0, y: 5 }, 'toward', 10)).toEqual({ cell: { x: 2, y: 4 }, cells: 3 });
  });

  it('does not move a victim already on the origin', () => {
    const world = setup();
    const v = spawnAt(world, { x: 5, y: 5 });
    expect(pushLanding(world, v, { x: 5, y: 5 }, 'toward', 3, { fallback: { x: 2, y: 5 } })).toBeNull();
  });
});
