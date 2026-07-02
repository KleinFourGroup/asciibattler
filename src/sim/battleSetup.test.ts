import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { spawnLayoutNeutrals } from './battleSetup';
import { generateFromLayout } from './terrainGen';
import { cellsOccupiedBy } from './occupancy';
import { RUBBLE_ARCHETYPE_BY_SIZE } from './environment';
import { NEUTRAL_DEFS } from '../config/units';
import type { GameEvents } from '../core/events';
import type { LayoutDef } from './layouts';

/**
 * §40d — the layout→board wiring for the first multi-tile neutral. The rubble
 * ENTITY (footprint occupancy, HP override, crumble, susceptibility) is proven in
 * environment.test; this covers the glue that turns a `LayoutDef`'s `rubble` array
 * into spawned units — schema (`generateFromLayout`) through spawn (`spawnLayoutNeutrals`).
 */
describe('§40d — spawnLayoutNeutrals wires layout rubble onto the board', () => {
  const fixture: LayoutDef = {
    id: 'neutrals-fixture',
    name: 'Neutrals Fixture',
    description: '§40d — walls + half-cover + multi-tile rubble for the spawn wiring test.',
    gridW: 10,
    gridH: 10,
    theme: 'grassland',
    walls: [{ x: 0, y: 5 }],
    halfCovers: [{ x: 9, y: 5 }],
    rubble: [{ x: 1, y: 1, size: 2, hp: 99 }, { x: 6, y: 6 }],
    spawns: [
      { availability: 'player', tiles: [{ x: 0, y: 0 }] },
      { availability: 'enemy', tiles: [{ x: 9, y: 9 }] },
    ],
  };

  function setup(): World {
    const world = new World(new EventBus<GameEvents>(), new RNG(1), 10, 10);
    spawnLayoutNeutrals(world, generateFromLayout(fixture, 10, 10));
    return world;
  }

  it('spawns a 2×2 rubble at its corner with the overridden HP, occupying its whole footprint', () => {
    const world = setup();
    const big = world.units.find((u) => u.archetype === RUBBLE_ARCHETYPE_BY_SIZE[2]);
    expect(big).toBeDefined();
    expect(big!.team).toBe('neutral');
    expect(big!.position).toEqual({ x: 1, y: 1 }); // the canonical footprint corner
    expect(big!.derived.maxHp).toBe(99); // the per-placement HP override
    const keys = new Set(cellsOccupiedBy(big!).map((c) => `${c.x},${c.y}`));
    expect(keys).toEqual(new Set(['1,1', '2,1', '1,2', '2,2']));
  });

  it('spawns a bare rubble as 1×1 at the catalog default HP', () => {
    const world = setup();
    const small = world.units.filter((u) => u.archetype === RUBBLE_ARCHETYPE_BY_SIZE[1]);
    expect(small).toHaveLength(1);
    expect(small[0]!.position).toEqual({ x: 6, y: 6 });
    // Balance-proof: the default HP is the catalog def's, never hardcoded here.
    expect(small[0]!.derived.maxHp).toBe(NEUTRAL_DEFS[RUBBLE_ARCHETYPE_BY_SIZE[1]]!.hp);
    expect(cellsOccupiedBy(small[0]!)).toHaveLength(1);
  });

  it('also spawns the walls + half-cover — 4 neutral obstacles, no combatants', () => {
    const world = setup();
    expect(world.units.filter((u) => u.archetype === 'wall')).toHaveLength(1);
    expect(world.units.filter((u) => u.archetype === 'half_cover')).toHaveLength(1);
    // 2 rubble + 1 wall + 1 half-cover; a fresh world has no other units.
    expect(world.units).toHaveLength(4);
  });
});
