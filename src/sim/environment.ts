/**
 * Environment entity factories. Walls, future healing shrines, hazards,
 * any "thing on the grid that isn't a combatant" gets a constructor here.
 *
 * Environment entities are spawned as **neutral-team Units** via
 * `world.spawnEnvironment` rather than via the rolled-stat UnitTemplate
 * path. Reusing the Unit infrastructure means:
 *
 * - They appear in `world.units` and therefore in the blocker list
 *   MovementBehavior builds for pathfinding — no separate "blocker grid"
 *   concept.
 * - They snapshot + rehydrate through the existing UnitSnapshot path for
 *   free.
 * - Future destructibility is a matter of bumping `maxHp` and adding a
 *   "walls can be attacked" hook to Targeting.
 *
 * Tile properties (movement cost, eventually combat modifiers / LOS) live
 * on TileGrid, not here — see `src/sim/TileGrid.ts`.
 */

import type { GridCoord } from '../core/types';
import type { Unit } from './Unit';
import type { World } from './World';

/** Glyph rendered for impassable wall obstacles. Roguelike convention. */
export const WALL_GLYPH = '#';

/**
 * Spawn a wall at the given cell.
 *
 * `maxHp` defaults to 1, which makes the wall functionally indestructible
 * because nothing currently *targets* walls — Targeting filters neutrals
 * out of the candidate pool. The argument is plumbed (C1b) so the
 * destructibility path is exercisable in tests, and ready for C2's AoE
 * archetypes which will introduce damage that lands on neutral cells
 * regardless of Targeting's enemy-only filter.
 *
 * Lifecycle when a wall does take fatal damage: `World.tick`'s death
 * short-circuit picks it up the next tick, splices it from `world.units`,
 * emits `unit:died` with `team: 'neutral'`. BattleRenderer fades the
 * sprite; BattleScene's audio handler skips neutrals so the standard
 * combat death sound doesn't play for crumbling masonry.
 */
export function spawnWall(world: World, position: GridCoord, maxHp = 1): Unit {
  return world.spawnEnvironment({ glyph: WALL_GLYPH, position, maxHp });
}
