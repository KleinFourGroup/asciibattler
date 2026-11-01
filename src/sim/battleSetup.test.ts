import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { battleWorld, spawnEncounter, spawnLayoutNeutrals } from './battleSetup';
import { generateFromLayout, generateTerrain } from './terrainGen';
import { cellsOccupiedBy } from './occupancy';
import { RUBBLE_ARCHETYPE_BY_SIZE, TREE_ARCHETYPES, WALL_ARCHETYPE, treeAt } from './environment';
import { rollUnit, type Archetype } from './archetypes';
import { deriveRng } from '../core/RNG';
import { TERRAIN } from '../config/terrain';
import { NEUTRAL_DEFS } from '../config/units';
import type { GameEvents } from '../core/events';
import type { LayoutDef, Theme } from './layouts';
import type { BattleEncounter } from '../run/Run';

/**
 * The layout→board wiring for rubble, the multi-tile neutral. The rubble
 * ENTITY (footprint occupancy, HP override, crumble, susceptibility) is proven in
 * environment.test; this covers the glue that turns a `LayoutDef`'s `rubble` array
 * into spawned units — schema (`generateFromLayout`) through spawn (`spawnLayoutNeutrals`).
 */
describe('spawnLayoutNeutrals wires layout rubble onto the board', () => {
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

describe('a procedural forest board', () => {
  const SIDE = 18;
  const TREES = new Set<string>(TREE_ARCHETYPES);
  const forestTerrain = (seed: number) =>
    generateTerrain(deriveRng(seed, 'terrain'), SIDE, SIDE, TERRAIN, null, 'forest');
  /** A world's snapshot with every tree read as the plain wall. */
  const asWalls = (world: World) => {
    const snap = world.toJSON();
    const wall = NEUTRAL_DEFS[WALL_ARCHETYPE]!;
    return {
      ...snap,
      units: snap.units.map((u) => (TREES.has(u.archetype) ? { ...u, archetype: WALL_ARCHETYPE, glyph: wall.glyph } : u)),
    };
  };
  const encounter = (worldSeed: number, theme: Theme, enemy: Archetype): BattleEncounter => ({
    worldSeed,
    terrainSeed: 41,
    layoutId: null,
    gridW: SIDE,
    gridH: SIDE,
    theme,
    playerTeam: [rollUnit('mercenary', new RNG(worldSeed)), rollUnit('archer', new RNG(worldSeed + 1))],
    enemyTeam: [rollUnit(enemy, new RNG(worldSeed + 2)), rollUnit(enemy, new RNG(worldSeed + 3))],
  });
  const spawned = (e: BattleEncounter): World => {
    const world = battleWorld(new EventBus<GameEvents>(), e);
    spawnEncounter(world, e);
    return world;
  };
  const treeCells = (world: World): string[] =>
    world.units.filter((u) => TREES.has(u.archetype)).map((u) => `${u.position.x},${u.position.y}:${u.archetype}`);

  it('puts a tree where each wall goes, and draws nothing for it', () => {
    const terrain = forestTerrain(7);
    expect(terrain.walls.length).toBeGreaterThan(0);
    const trees = new World(new EventBus<GameEvents>(), new RNG(3), SIDE, SIDE);
    const walls = new World(new EventBus<GameEvents>(), new RNG(3), SIDE, SIDE);
    spawnLayoutNeutrals(trees, terrain, 7);
    spawnLayoutNeutrals(walls, terrain);
    expect(trees.units.some((u) => u.archetype === WALL_ARCHETYPE)).toBe(false);
    // Each unit keeps its id, its cell and its order, and every stream is
    // where the walled board left it: the snapshots are equal but for the
    // archetype and its glyph.
    expect(asWalls(trees)).toEqual(walls.toJSON());
  });

  it('is the board the game sets up: trees and no wall on a forest board, walls on another', () => {
    const forest = spawned(encounter(5, 'forest', 'wolf'));
    expect(forest.units.some((u) => u.archetype === WALL_ARCHETYPE)).toBe(false);
    expect(new Set(treeCells(forest).map((c) => c.split(':')[1])).size).toBe(TREE_ARCHETYPES.length);
    const swamp = spawned(encounter(5, 'swamp', 'wolf'));
    expect(swamp.units.some((u) => u.archetype === WALL_ARCHETYPE)).toBe(true);
    expect(treeCells(swamp)).toEqual([]);
  });

  it("keeps a board's trees where they stand when the teams and the world seed change", () => {
    const a = treeCells(spawned(encounter(5, 'forest', 'wolf')));
    const b = treeCells(spawned(encounter(900, 'forest', 'bandit')));
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
    // The control: the terrain seed is in the pick, so the same cells take
    // other trees on another board.
    const cells = a.map((c) => c.split(':')[0]!.split(',').map(Number) as [number, number]);
    const pick = (seed: number) => cells.map(([x, y]) => treeAt({ x, y }, seed));
    expect(pick(41)).toEqual(a.map((c) => c.split(':')[1]));
    expect(pick(42)).not.toEqual(pick(41));
  });
});
