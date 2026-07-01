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

/** Glyph rendered for impassable wall obstacles. Roguelike convention. Mirrors
 *  the `wall` catalog entry's glyph (asserted in environment.test). */
export const WALL_GLYPH = '#';

/**
 * D6 — half-cover glyph. Box-drawing `╥` (U+2565): a horizontal rail
 * with two short vertical posts, reading as a low fence. JetBrains Mono
 * supports it (verified at FontAtlas build). Mirrors the `half_cover` catalog
 * entry's glyph.
 */
export const HALF_COVER_GLYPH = '╥';

/**
 * §38d — the NEUTRAL catalog ids walls / half-cover spawn as. `spawnEnvironment`
 * resolves the glyph / flat HP / LOS-blocking from `NEUTRAL_DEFS[archetype]`, so
 * these are the single source binding a spawn wrapper to its catalog entry.
 */
export const WALL_ARCHETYPE = 'wall';
export const HALF_COVER_ARCHETYPE = 'half_cover';

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
 *
 * Default `blocksLineOfSight: true` — ranged units can't shoot through
 * walls (the C1b LOS contract).
 */
export function spawnWall(world: World, position: GridCoord, maxHp?: number): Unit {
  // §38d — glyph + the flat HP default now come from the `wall` catalog entry;
  // `maxHp` still overrides (tests / future destructible variants).
  return world.spawnEnvironment({
    archetype: WALL_ARCHETYPE,
    position,
    ...(maxHp !== undefined ? { maxHp } : {}),
  });
}

/**
 * D6 — spawn half-cover at the given cell. Pathfinding still blocks
 * through it (the half-cover is a Unit, every Unit appears in the
 * MovementBehavior blocker list), so units route around exactly like
 * walls. Ranged attacks see THROUGH it: `blocksLineOfSight: false`
 * removes it from the wall pool `AttackBehavior` builds for the
 * Bresenham LOS check.
 *
 * Damage / destructibility: same plumbing as walls — `maxHp` defaults
 * to 1, no behavior targets neutrals today, so practically
 * indestructible until C2's AoE archetypes land. The combat-modifier
 * hook ("ranged defense bonus for shooting from behind half-cover")
 * is explicitly C2-era and stays unbuilt in D6.
 */
export function spawnHalfCover(world: World, position: GridCoord, maxHp?: number): Unit {
  // §38d — glyph + `blocksLineOfSight: false` (the D6 LOS contract) now live on
  // the `half_cover` catalog entry; `maxHp` still overrides the flat HP default.
  return world.spawnEnvironment({
    archetype: HALF_COVER_ARCHETYPE,
    position,
    ...(maxHp !== undefined ? { maxHp } : {}),
  });
}

/**
 * §40a — the rubble neutral glyph. `▓` (U+2593 DARK SHADE): a dense debris/
 * masonry fill, distinct from the wall `#`. Catalog-derived into the font atlas
 * (all three rubble sizes share it — one atlas cell). Mirrors the rubble catalog
 * entries' glyph (asserted in environment.test).
 */
export const RUBBLE_GLYPH = '▓';

/**
 * §40a — the rubble neutral `UnitDef` ids, keyed by footprint side (1..3, the
 * §39-LOCKED range). Rubble is the FIRST real multi-tile entity — footprint is
 * def-resolved (`footprintOf` reads the catalog by archetype), so there's one id
 * per size. `spawnRubble` + the §40d layout editor's size picker resolve through
 * here (the single binding of a size to its catalog id).
 */
export const RUBBLE_ARCHETYPE_BY_SIZE: Readonly<Record<1 | 2 | 3, string>> = {
  1: 'rubble_1x1',
  2: 'rubble_2x2',
  3: 'rubble_3x3',
};

/**
 * §40a — spawn a rubble obstacle (a destructible neutral) at `position` (its
 * canonical footprint CORNER, per §39). `size` picks the N×N footprint (1..3);
 * `maxHp` overrides the catalog default (the §40d layout schema's per-placement
 * "configurable HP" — mirrors `spawnWall`'s override). Rubble is burnable/
 * freezable but not poisonable (the `statusSusceptibility` allow-list on the
 * def) and blocks LOS by default. The 0-HP reap → `unit:died{neutral}` lifecycle
 * already runs end-to-end (see `spawnWall`). ⚠️ Nothing DAMAGES rubble until §40b
 * lifts the `isCombatTargetable` neutral guard (AoE) + adds the auto-target hook.
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
