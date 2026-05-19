/**
 * Shared battle-setup logic. Game.ts and the headless fuzz harness both
 * need to take a Run's `BattleEncounter` and spawn the two teams into a
 * fresh `World` at the right formation. Putting it here keeps the two
 * code paths from drifting — e.g., if formation columns ever change, the
 * fuzz harness keeps producing balance data that reflects the real game.
 *
 * The formation rule:
 *   - Player melee on row 2, ranged on row 1 (closer to enemy).
 *   - Enemy melee on row 9, ranged on row 10.
 *   - Default 3 melee + 2 ranged uses the CHECKPOINT 5 anchor columns;
 *     other sizes (post-recruit growth) spread evenly across cols 1..10.
 */

import type { World } from './World';
import { MovementBehavior } from './behaviors/MovementBehavior';
import { AttackBehavior } from './behaviors/AttackBehavior';
import type { Team, UnitTemplate } from './Unit';
import type { BattleEncounter } from '../run/Run';

/**
 * CHECKPOINT 5 formation anchors for the starting 3-melee + 2-ranged team.
 * Preserved exactly so default-team battle outcomes don't shift; recruited
 * extras fall through to `distributeColumns`.
 */
const DEFAULT_MELEE_COLUMNS = [2, 6, 10] as const;
const DEFAULT_RANGED_COLUMNS = [4, 8] as const;

/**
 * Evenly spread `count` units across grid columns 1..10 (leaving columns 0
 * and 11 as buffer). Returns integer column indices. Handles up to 10 units
 * per rank without collisions; recruitment-driven team growth bounded by
 * MVP run length stays well inside that.
 */
export function distributeColumns(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [6];
  const cols: number[] = [];
  const left = 1;
  const right = 10;
  for (let i = 0; i < count; i++) {
    cols.push(Math.round(left + ((right - left) * i) / (count - 1)));
  }
  return cols;
}

export function meleeColumnsFor(count: number): readonly number[] {
  return count === DEFAULT_MELEE_COLUMNS.length
    ? DEFAULT_MELEE_COLUMNS
    : distributeColumns(count);
}

export function rangedColumnsFor(count: number): readonly number[] {
  return count === DEFAULT_RANGED_COLUMNS.length
    ? DEFAULT_RANGED_COLUMNS
    : distributeColumns(count);
}

/**
 * Spawn a pre-rolled team into the active world. Melee fills the front
 * rank (row 2 player / 9 enemy), ranged fills the rear (row 1 / 10), each
 * spread evenly across the row so growing teams from recruitment don't
 * fall off a fixed column array. Each spawned unit gets
 * MovementBehavior + AttackBehavior — the MVP behavior pair.
 */
export function spawnTeam(
  world: World,
  team: Team,
  templates: readonly UnitTemplate[],
): void {
  const meleeRow = team === 'player' ? 2 : 9;
  const rangedRow = team === 'player' ? 1 : 10;

  const melee = templates.filter((t) => t.archetype === 'melee');
  const ranged = templates.filter((t) => t.archetype === 'ranged');
  const meleeCols = meleeColumnsFor(melee.length);
  const rangedCols = rangedColumnsFor(ranged.length);

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
 * Spawn both sides of a `BattleEncounter` into a fresh world. Convenience
 * wrapper around `spawnTeam` for the harness loop; Game spawns player and
 * enemy in two separate calls because it interleaves HUD setup between
 * them.
 */
export function spawnEncounter(world: World, encounter: BattleEncounter): void {
  spawnTeam(world, 'player', encounter.playerTeam);
  spawnTeam(world, 'enemy', encounter.enemyTeam);
}
