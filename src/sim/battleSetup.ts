/**
 * Shared battle-setup logic. Game.ts and the headless fuzz harness both
 * need to take a Run's `BattleEncounter` and spawn the two teams into a
 * fresh `World` at the right formation. Putting it here keeps the two
 * code paths from drifting — e.g., if formation columns ever change, the
 * fuzz harness keeps producing balance data that reflects the real game.
 *
 * The formation rule (D3 — rectangular-arena-aware):
 *   - Player melee on row 2, ranged on row 1 (closer to enemy).
 *   - Enemy melee on row `gridH - 3`, ranged on row `gridH - 2`.
 *   - Default 3 melee + 2 ranged uses the CHECKPOINT 5 anchor columns
 *     on a 12-wide grid; other sizes (post-recruit growth) spread evenly
 *     across cols 1..gridW-2.
 *
 * The rows are pinned to the bottom and top edges so the gap between
 * teams scales with `gridH`: a tall arena gives ranged time to fire
 * before melee closes; a short one collapses to a brawl. The reserved
 * rows in `terrainGen.reservedSpawnRows(gridH)` mirror this formation
 * one-for-one, so terrain never spawns walls / water on a spawn cell.
 */

import type { World } from './World';
import { MovementBehavior } from './behaviors/MovementBehavior';
import { AttackBehavior } from './behaviors/AttackBehavior';
import type { Team, UnitTemplate } from './Unit';
import type { BattleEncounter } from '../run/Run';
import { RNG } from '../core/RNG';
import { TERRAIN } from '../config/terrain';
import { generateTerrain } from './terrainGen';
import { spawnWall } from './environment';

/**
 * CHECKPOINT 5 formation anchors for the starting 3-melee + 2-ranged team
 * on the canonical 12-wide arena. Preserved exactly so default-team
 * battle outcomes on `gridW=12` don't shift; wider/narrower arenas and
 * recruited extras fall through to `distributeColumns`.
 */
const DEFAULT_GRID_W = 12;
const DEFAULT_MELEE_COLUMNS = [2, 6, 10] as const;
const DEFAULT_RANGED_COLUMNS = [4, 8] as const;

/**
 * Evenly spread `count` units across grid columns 1..gridW-2 (leaving
 * column 0 and column `gridW-1` as buffer). Returns integer column
 * indices. Handles up to `gridW - 2` units per rank without collisions;
 * MVP team sizes stay well inside that on every D3-allowed width.
 */
export function distributeColumns(count: number, gridW: number): number[] {
  if (count === 0) return [];
  const left = 1;
  const right = Math.max(left, gridW - 2);
  if (count === 1) return [Math.round((left + right) / 2)];
  const cols: number[] = [];
  for (let i = 0; i < count; i++) {
    cols.push(Math.round(left + ((right - left) * i) / (count - 1)));
  }
  return cols;
}

export function meleeColumnsFor(count: number, gridW: number): readonly number[] {
  return gridW === DEFAULT_GRID_W && count === DEFAULT_MELEE_COLUMNS.length
    ? DEFAULT_MELEE_COLUMNS
    : distributeColumns(count, gridW);
}

export function rangedColumnsFor(count: number, gridW: number): readonly number[] {
  return gridW === DEFAULT_GRID_W && count === DEFAULT_RANGED_COLUMNS.length
    ? DEFAULT_RANGED_COLUMNS
    : distributeColumns(count, gridW);
}

/**
 * Spawn a pre-rolled team into the active world. Melee fills the front
 * rank (row 2 player / `gridH-3` enemy), ranged fills the rear (row 1 /
 * `gridH-2`), each spread evenly across the row so growing teams from
 * recruitment don't fall off a fixed column array. Each spawned unit
 * gets MovementBehavior + AttackBehavior — the MVP behavior pair.
 */
export function spawnTeam(
  world: World,
  team: Team,
  templates: readonly UnitTemplate[],
): void {
  const meleeRow = team === 'player' ? 2 : world.gridH - 3;
  const rangedRow = team === 'player' ? 1 : world.gridH - 2;

  const melee = templates.filter((t) => t.archetype === 'melee');
  const ranged = templates.filter((t) => t.archetype === 'ranged');
  const meleeCols = meleeColumnsFor(melee.length, world.gridW);
  const rangedCols = rangedColumnsFor(ranged.length, world.gridW);

  for (let i = 0; i < melee.length; i++) {
    const u = world.spawnUnit(melee[i]!, team, { x: meleeCols[i]!, y: meleeRow });
    u.behaviors.push(new MovementBehavior(), new AttackBehavior());
  }
  for (let i = 0; i < ranged.length; i++) {
    const u = world.spawnUnit(ranged[i]!, team, { x: rangedCols[i]!, y: rangedRow });
    u.behaviors.push(new MovementBehavior(), new AttackBehavior());
  }
}

/**
 * C1a terrain application. Generates the per-encounter tile layout +
 * wall coords from the encounter's terrain seed, copies the tiles onto
 * `world.tileGrid` in place (World.tileGrid is constructed at World
 * construction time and stays referenced; we mutate kinds rather than
 * swapping the instance), and spawns each wall as a neutral-team Unit so
 * pathfinding's blocker list includes them for free.
 *
 * Must run BEFORE any `spawnTeam` so the spawn rows are guaranteed clear
 * of walls. Both call sites (`spawnEncounter` and `BattleScene.mount`)
 * follow that order — if you add a third, mirror it.
 */
export function applyTerrain(world: World, encounter: BattleEncounter): void {
  const { tileGrid, walls } = generateTerrain(
    new RNG(encounter.terrainSeed),
    world.gridW,
    world.gridH,
    TERRAIN,
    encounter.layoutId,
  );
  // Copy tile kinds onto the World's TileGrid (kept-by-reference so
  // existing handles to world.tileGrid stay valid post-application).
  for (const cell of tileGrid.cells()) {
    world.tileGrid.setKind({ x: cell.x, y: cell.y }, cell.kind);
  }
  for (const coord of walls) {
    spawnWall(world, coord);
  }
}

/**
 * Spawn both sides of a `BattleEncounter` into a fresh world. Convenience
 * wrapper for the harness loop; Game spawns player and enemy in two
 * separate calls because it interleaves HUD setup between them. Terrain
 * is applied first so spawn rows are guaranteed clear of obstacles.
 */
export function spawnEncounter(world: World, encounter: BattleEncounter): void {
  applyTerrain(world, encounter);
  spawnTeam(world, 'player', encounter.playerTeam);
  spawnTeam(world, 'enemy', encounter.enemyTeam);
}
