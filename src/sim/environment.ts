/**
 * The scenery factories: walls, half-cover, rubble, anything on the grid
 * that isn't a combatant. Each is a neutral-team `Unit` spawned through
 * `world.spawnEnvironment`, not from a rolled template, so it is in
 * `world.units` and therefore in every pathing blocker list, with no
 * separate blocker grid, and it snapshots and rehydrates as any unit does.
 *
 * A tile's properties (its cost, its statuses) are on
 * `TileGrid`, not here.
 */

import type { GridCoord } from '../core/types';
import type { Unit } from './Unit';
import type { World } from './World';

/**
 * The neutral catalog ids walls and half-cover spawn as. `spawnEnvironment`
 * takes the glyph, the HP and the line-of-sight blocking from
 * `NEUTRAL_DEFS`, so these bind each wrapper to its entry.
 */
export const WALL_ARCHETYPE = 'wall';
export const HALF_COVER_ARCHETYPE = 'half_cover';

/**
 * The destructible wall and half-cover ids. A def is destructible when it
 * has an `hp` (`isCombatTargetable`), so a destructible wall is its own
 * neutral def, with an `hp` and no `autoTarget`: it is hit by an order, a
 * blast or focused fire, never chipped at on its own as rubble is. Each
 * shares the indestructible one's glyph (`#`, `╥`), so it reads the same
 * until it falls. `spawnWall` and `spawnHalfCover` take one when given an
 * `hp`, which overrides the def's.
 */
export const WALL_DESTRUCTIBLE_ARCHETYPE = 'wall_destructible';
export const HALF_COVER_DESTRUCTIBLE_ARCHETYPE = 'half_cover_destructible';

/**
 * Spawns a wall. Given an `hp`, it is destructible: the `wall_destructible`
 * def, with `hp` as its maxHp. Without one, it is the plain `wall`, whose
 * def has no `hp`, so it is indestructible: never targeted, skipped by
 * blasts, damaged by nothing. So a wall breaks only when its layout coord
 * carries an `hp`, and walls are unbreakable by default.
 *
 * A destructible wall that dies is reaped as any unit is (`World.reapUnit`):
 * `unit:died` with `team: 'neutral'`, which the renderer fades out, and no
 * death sound for scenery (`audibleDeath`, `eventSounds.ts`).
 *
 * Both wall defs block line of sight.
 */
export function spawnWall(world: World, position: GridCoord, hp?: number): Unit {
  return world.spawnEnvironment({
    archetype: hp !== undefined ? WALL_DESTRUCTIBLE_ARCHETYPE : WALL_ARCHETYPE,
    position,
    ...(hp !== undefined ? { maxHp: hp } : {}),
  });
}

/**
 * Spawns half-cover. Pathing blocks on it, since it is a unit like any
 * other, so units route around it as around a wall; a shot sees through
 * it, since its defs don't block line of sight, which keeps it out of
 * `collectLosBlockers`. Given an `hp`, it is the destructible def, as a
 * wall is. Neither def has `autoTarget`, so neither is chipped at on its
 * own.
 */
export function spawnHalfCover(world: World, position: GridCoord, hp?: number): Unit {
  return world.spawnEnvironment({
    archetype: hp !== undefined ? HALF_COVER_DESTRUCTIBLE_ARCHETYPE : HALF_COVER_ARCHETYPE,
    position,
    ...(hp !== undefined ? { maxHp: hp } : {}),
  });
}

/**
 * The rubble defs by footprint side, 1 to 3. A footprint is the def's
 * (`footprintOf` reads it by archetype), so each size has its own id, and
 * `spawnRubble` binds a size to its id here.
 */
export const RUBBLE_ARCHETYPE_BY_SIZE: Readonly<Record<1 | 2 | 3, string>> = {
  1: 'rubble_1x1',
  2: 'rubble_2x2',
  3: 'rubble_3x3',
};

/**
 * Spawns rubble, a destructible neutral, at `position`, its footprint's
 * minimum corner. `size` picks the N×N footprint; `maxHp` overrides the
 * def's, as a layout coord's `hp` does. Its defs let it burn and freeze but
 * not be poisoned (`statusSusceptibility`), block line of sight, and carry
 * `autoTarget`, so units chip at it on their own. It dies as a wall does
 * (`spawnWall`).
 */
export function spawnRubble(
  world: World,
  position: GridCoord,
  size: 1 | 2 | 3 = 1,
  maxHp?: number,
): Unit {
  return world.spawnEnvironment({
    archetype: RUBBLE_ARCHETYPE_BY_SIZE[size],
    position,
    ...(maxHp !== undefined ? { maxHp } : {}),
  });
}
