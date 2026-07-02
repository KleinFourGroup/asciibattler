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
 * §40c — the DESTRUCTIBLE wall / half-cover catalog ids. Under §40b's HP-presence
 * rule, destructibility IS `hp`-presence on the def, so a destructible wall is a
 * SEPARATE neutral `UnitDef` carrying an `hp` pool (present ⇒ `isCombatTargetable`)
 * but no `autoTarget` (⇒ never auto-chipped like rubble — manual / AoE / focused
 * fire only). They share the indestructible siblings' glyph (`#` / `╥`) so a
 * destructible wall reads identically until it crumbles (a visual "tell" is a
 * deferred polish call, not part of the mechanic). `spawnWall` / `spawnHalfCover`
 * route here when handed a per-instance `hp` (the §40c layout-schema knob); the
 * def's own `hp` is the default pool a hp-less-override spawn (or the §40d editor's
 * default fill) gets. UNTUNED — §41 balances the pools.
 */
export const WALL_DESTRUCTIBLE_ARCHETYPE = 'wall_destructible';
export const HALF_COVER_DESTRUCTIBLE_ARCHETYPE = 'half_cover_destructible';

/**
 * Spawn a wall at the given cell.
 *
 * §40c — passing an `hp` makes the wall DESTRUCTIBLE: it spawns as the
 * `wall_destructible` neutral def (whose def-level `hp` presence is the §40b
 * signal `isCombatTargetable` keys off) with `hp` as the per-instance maxHp
 * override — the layout-schema "give a wall an HP pool" knob. With no `hp`
 * (the default + every shipped layout today) it spawns as the plain `wall`
 * def, which is hp-LESS ⇒ indestructible (Targeting never picks it; AoE
 * skips it; nothing damages it). So a wall is breakable iff its layout entry
 * carries an `hp` — the locked "wall-destructibility OFF by default" rule.
 *
 * Lifecycle when a destructible wall takes fatal damage: `World.tick`'s death
 * short-circuit picks it up the next tick, splices it from `world.units`,
 * emits `unit:died` with `team: 'neutral'`. BattleRenderer fades the
 * sprite; BattleScene's audio handler skips neutrals so the standard
 * combat death sound doesn't play for crumbling masonry. (Same path §40a's
 * rubble crumble already exercises end-to-end.)
 *
 * Default `blocksLineOfSight: true` — ranged units can't shoot through
 * walls (the C1b LOS contract). Both wall defs share it.
 */
export function spawnWall(world: World, position: GridCoord, hp?: number): Unit {
  // §38d — glyph + LOS-blocking come from the catalog entry. §40c — `hp` present
  // routes to the destructible def (targetable) with `hp` as the maxHp override.
  return world.spawnEnvironment({
    archetype: hp !== undefined ? WALL_DESTRUCTIBLE_ARCHETYPE : WALL_ARCHETYPE,
    position,
    ...(hp !== undefined ? { maxHp: hp } : {}),
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
 * §40c — destructibility mirrors walls: passing an `hp` spawns the
 * `half_cover_destructible` def (targetable, `hp` = per-instance maxHp);
 * with no `hp` it's the hp-less `half_cover` def = indestructible. Neither
 * is ever auto-targeted (no `autoTarget` on either def) — manual / AoE /
 * focused fire only. The combat-modifier hook ("ranged defense bonus for
 * shooting from behind half-cover") is still C2-era and stays unbuilt.
 */
export function spawnHalfCover(world: World, position: GridCoord, hp?: number): Unit {
  // §38d — glyph + `blocksLineOfSight: false` (the D6 LOS contract) live on the
  // catalog entry. §40c — `hp` present routes to the destructible def (targetable)
  // with `hp` as the maxHp override.
  return world.spawnEnvironment({
    archetype: hp !== undefined ? HALF_COVER_DESTRUCTIBLE_ARCHETYPE : HALF_COVER_ARCHETYPE,
    position,
    ...(hp !== undefined ? { maxHp: hp } : {}),
  });
}

/**
 * §40b — the rubble neutral glyph. `▄` (U+2584 LOWER HALF BLOCK) — a true HALF-
 * height slab that sits FLUSH on the ground, reading as low rubble/debris rather
 * than a wall-height obstacle. This replaces the `%` STOPGAP (itself a fallback from
 * the first-pass `▓` U+2593 DARK SHADE, a FULL-EM block that towered over the wall
 * `#` + occluded sprites). Catalog-derived into the atlas (all three rubble sizes
 * share it — one cell); mirrors the rubble catalog entries' glyph (asserted in
 * environment.test). NATIVE-browser CONFIRMED (user, 2026-07-02) — JetBrains Mono
 * renders the lower-half block cleanly (short + ground-flush, well below the wall
 * `#`, no occlusion), NOT tofu; remote render-verify remained unreliable, so the
 * native eye was the authority.
 */
export const RUBBLE_GLYPH = '▄';

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
