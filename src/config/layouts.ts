/**
 * The hand-authored battlefields. Source of truth at `config/layouts.json`, a
 * flat array; a layout reaches a battle only through a sector's pool
 * (sectors.ts). Each pins a tactical situation onto a rectangular arena: its
 * own grid size, walls, optional water and tiles, spawn regions, and a `name`
 * and `description` for the UI and the editor.
 *
 * To add one, paint and export it in `tools/layout-editor/`, or append it to
 * the JSON. Its `id` must be unique, and `name`, `description`, `gridW`,
 * `gridH`, `spawns` and `theme` are required. The parse checks bounds,
 * overlaps and the spawn regions; the tests in `src/sim/layouts.test.ts` and
 * `layoutConnectivity.test.ts` also check connectivity.
 */

import { z } from 'zod';
import { prose } from '../i18n/prose';
import { loadProse } from '../i18n/locale';
import layoutsJson from '../../config/layouts.json';

const CoordSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

/**
 * A wall or half-cover coord, with an optional `hp` for that placement. With
 * it, the cell spawns the `wall_destructible` or `half_cover_destructible`
 * def, whose `hp` makes it targetable in combat; without it, the
 * indestructible `wall` or `half_cover`, so a wall is indestructible unless
 * authored otherwise. The cap matches the neutral def's and catches typos.
 */
const NeutralCoordSchema = CoordSchema.extend({
  hp: z.number().int().positive().max(999).optional(),
});

/** The rubble footprint's side range, matching the `rubble_1x1`, `2x2` and
 *  `3x3` defs. */
const RUBBLE_MIN_SIZE = 1;
const RUBBLE_MAX_SIZE = 3;

/**
 * A rubble placement: its footprint's min corner `{x, y}`, the block extending
 * toward +x and +y, an optional `size` (default 1, which picks the def) and an
 * optional `hp` for that placement. Rubble is always destructible, since its
 * def has an `hp` pool, so `hp` here only tunes the pool; absent, the def's
 * own. The whole block's bounds and overlaps are checked in
 * `LayoutSchema.superRefine`.
 */
const RubbleCoordSchema = CoordSchema.extend({
  size: z.number().int().min(RUBBLE_MIN_SIZE).max(RUBBLE_MAX_SIZE).optional(),
  hp: z.number().int().positive().max(999).optional(),
});

/** Hand-authored layouts pick their own grid size in this range. */
export const LAYOUT_MIN_SIDE = 8;
export const LAYOUT_MAX_SIDE = 32;

/**
 * A weighted camp reference on a layout: a camp (camps.ts) the layout's
 * camp-spawn tiles may roll, weight omitted being 1. Each camp-spawn tile
 * draws one camp from the list at battle setup. camps.ts checks the `campId`
 * (`assertLayoutCampRefs`); it imports this module, never the reverse.
 */
const CampRefSchema = z.object({
  campId: z.string().min(1),
  weight: z.number().positive().optional(),
});
export type CampRef = z.infer<typeof CampRefSchema>;

/**
 * Default tiles per spawn region — the procedural top/bottom edge bands
 * and the layout editor's starting region template are both this wide.
 * Hand-authored regions are NOT pinned to it: they may hold anywhere
 * from `SPAWN_REGION_MIN_TILES` to `SPAWN_REGION_MAX_TILES` tiles.
 */
export const SPAWN_REGION_TILE_COUNT = 8;

/**
 * The tile-count range of a hand-authored spawn region. The sim does not
 * depend on the count: `spawnTeam` places `min(team, tiles)` units on a
 * random subset and queues the rest, and every other reader takes
 * `region.tiles.length`. A region smaller than the team trickles the rest in
 * as tiles empty; a larger one places the team on a random subset, which
 * varies positions.
 */
export const SPAWN_REGION_MIN_TILES = 1;
export const SPAWN_REGION_MAX_TILES = 10;

const SideSchema = z.number().int().min(LAYOUT_MIN_SIDE).max(LAYOUT_MAX_SIDE);

const SpawnAvailabilitySchema = z.enum(['player', 'enemy', 'both']);
export type SpawnAvailability = z.infer<typeof SpawnAvailabilitySchema>;

/**
 * The theme: a tile palette. On a hand-authored layout it is cosmetic, with
 * no sim effect; on a procedural board the sector's theme also picks the
 * tiles and camps (`terrain.json`). A closed set, so nothing can name a theme
 * that has no palette.
 *
 * - `grassland` — the DARK_TERMINAL_GREEN to DARK_TERMINAL_AMBER lerp.
 * - `barren` — greys, variants of TERMINAL_STONE.
 * - `volcanic` — a dark red base with amber accents, which suits fire tiles.
 * - `tundra` — blue-white snow.
 * - `desert` — warm sand.
 * - `swamp` — murky brown-greens.
 *
 * `theme` is serialized in the RunSnapshot, so renaming one needs a snapshot
 * bump. To add one, extend `ThemeSchema` and `THEMES`, give it a palette in
 * `TerrainRenderer.topColorFor`, and give it a `themeTiles` entry in
 * `terrain.json`, which the parse requires.
 */
export const ThemeSchema = z.enum([
  'grassland',
  'barren',
  'volcanic',
  'tundra',
  'desert',
  'swamp',
]);
export type Theme = z.infer<typeof ThemeSchema>;
/** The themes as a list, for the editors and terrain.json's per-theme
 *  tables; kept in step with `ThemeSchema`. */
export const THEMES: readonly Theme[] = [
  'grassland',
  'barren',
  'volcanic',
  'tundra',
  'desert',
  'swamp',
];

export const SpawnRegionSchema = z
  .object({
    tiles: z.array(CoordSchema).min(SPAWN_REGION_MIN_TILES).max(SPAWN_REGION_MAX_TILES),
    availability: SpawnAvailabilitySchema,
  })
  .superRefine((region, ctx) => {
    const seen = new Set<string>();
    region.tiles.forEach((t, i) => {
      const k = `${t.x},${t.y}`;
      if (seen.has(k)) {
        ctx.addIssue({
          code: 'custom',
          path: ['tiles', i],
          message: `SpawnRegion: duplicate tile (${t.x},${t.y})`,
        });
      }
      seen.add(k);
    });
  });

export type SpawnRegion = z.infer<typeof SpawnRegionSchema>;

const LayoutSchema = z
  .object({
    id: z.string().min(1),
    name: prose(),
    description: z.string().min(1),
    gridW: SideSchema,
    gridH: SideSchema,
    /** Each coord may carry an `hp`, making that wall destructible
     *  (`NeutralCoordSchema`); a bare `{x, y}` is an indestructible wall. */
    walls: z.array(NeutralCoordSchema),
    water: z.array(CoordSchema).optional(),
    /** Neutral half-cover: pathing is blocked at it as at a wall, and ranged
     *  sight passes over it. An `hp` on a coord makes that cover
     *  destructible. */
    halfCovers: z.array(NeutralCoordSchema).optional(),
    /** Destructible rubble (`RubbleCoordSchema`), spawned by `spawnRubble` in
     *  `battleSetup.applyTerrain`. Its whole block refuses spawns, since a
     *  unit cannot stand on rubble. */
    rubble: z.array(RubbleCoordSchema).optional(),
    /** Single-tile camp spawn points. Each spawns a camp rolled from `camps`
     *  at battle setup; its units appear on the tile and wander off within
     *  the leash. A spawn tile must be a cell a unit can occupy, as in a
     *  spawn region. */
    campSpawns: z.array(CoordSchema).optional(),
    /** The weighted camps the spawn tiles roll from (weight omitted is 1);
     *  required non-empty when `campSpawns` is present. */
    camps: z.array(CampRefSchema).optional(),
    /** Impassable tiles (infinite path cost) that sight passes over, since
     *  sight never reads tiles. Procedural boards have none. */
    chasms: z.array(CoordSchema).optional(),
    /** Fire tiles: normal path cost, and damage each tick to a combatant
     *  standing in one. */
    fires: z.array(CoordSchema).optional(),
    /** Healing tiles: normal path cost, and a heal each tick to a combatant
     *  standing in one, capped at its max HP. */
    healings: z.array(CoordSchema).optional(),
    /** The terrain tiles, each an optional coord list applied to the TileGrid
     *  by `terrainGen` (`setKind`). `deepWater` is impassable like a chasm;
     *  `hills`, `ice`, `sand` and `mud` are passable, with their own costs and
     *  combat mods. */
    deepWater: z.array(CoordSchema).optional(),
    hills: z.array(CoordSchema).optional(),
    ice: z.array(CoordSchema).optional(),
    sand: z.array(CoordSchema).optional(),
    mud: z.array(CoordSchema).optional(),
    spawns: z.array(SpawnRegionSchema).min(2),
    /** Required, so every layout names its palette. A procedural board takes
     *  its sector's theme. */
    theme: ThemeSchema,
  })
  .superRefine((layout, ctx) => {
    // Overlap is checked within each layer, not across: a terrain tile and a
    // neutral obstacle (wall, half-cover, rubble) may share a cell, so a
    // destructible wall on sand leaves sand when it breaks. `terrainGen` sets
    // the tile kind and `battleSetup` spawns the obstacle as a neutral unit
    // standing on it. `terrainBlocked` keeps terrain kinds one to a cell, and
    // `neutralBlocked` obstacles.
    const terrainBlocked = new Set<string>(); // water, chasm, fire, healing, the terrain tiles
    const neutralBlocked = new Set<string>(); // walls / half-covers / rubble
    for (const w of layout.walls) neutralBlocked.add(`${w.x},${w.y}`);
    for (const w of layout.water ?? []) terrainBlocked.add(`${w.x},${w.y}`);

    // Chasm is impassable terrain, one terrain kind to a cell; it may sit under
    // a neutral.
    const seenChasms = new Set<string>();
    (layout.chasms ?? []).forEach((ch, idx) => {
      const k = `${ch.x},${ch.y}`;
      if (ch.x < 0 || ch.x >= layout.gridW || ch.y < 0 || ch.y >= layout.gridH) {
        ctx.addIssue({
          code: 'custom',
          path: ['chasms', idx],
          message: `chasm (${ch.x},${ch.y}) out of bounds for ${layout.gridW}x${layout.gridH}`,
        });
      }
      if (terrainBlocked.has(k)) {
        ctx.addIssue({
          code: 'custom',
          path: ['chasms', idx],
          message: `chasm (${ch.x},${ch.y}) overlaps another terrain tile`,
        });
      }
      if (seenChasms.has(k)) {
        ctx.addIssue({
          code: 'custom',
          path: ['chasms', idx],
          message: `duplicate chasm (${ch.x},${ch.y})`,
        });
      }
      seenChasms.add(k);
      terrainBlocked.add(k);
    });

    // The tile kinds: one to a cell, each coord unique and clear of every
    // earlier terrain tile.
    const checkTileEffect = (
      coords: ReadonlyArray<{ x: number; y: number }> | undefined,
      pathKey: 'fires' | 'healings' | 'deepWater' | 'hills' | 'ice' | 'sand' | 'mud',
      label: string,
    ): void => {
      if (!coords) return;
      const seen = new Set<string>();
      coords.forEach((t, idx) => {
        const k = `${t.x},${t.y}`;
        if (t.x < 0 || t.x >= layout.gridW || t.y < 0 || t.y >= layout.gridH) {
          ctx.addIssue({
            code: 'custom',
            path: [pathKey, idx],
            message: `${label} (${t.x},${t.y}) out of bounds for ${layout.gridW}x${layout.gridH}`,
          });
        }
        if (terrainBlocked.has(k)) {
          ctx.addIssue({
            code: 'custom',
            path: [pathKey, idx],
            message: `${label} (${t.x},${t.y}) overlaps another terrain tile`,
          });
        }
        if (seen.has(k)) {
          ctx.addIssue({
            code: 'custom',
            path: [pathKey, idx],
            message: `duplicate ${label} (${t.x},${t.y})`,
          });
        }
        seen.add(k);
        terrainBlocked.add(k);
      });
    };
    checkTileEffect(layout.fires, 'fires', 'fire');
    checkTileEffect(layout.healings, 'healings', 'healing');
    // The terrain tiles, under the same rule.
    checkTileEffect(layout.deepWater, 'deepWater', 'deep water');
    checkTileEffect(layout.hills, 'hills', 'hills');
    checkTileEffect(layout.ice, 'ice', 'ice');
    checkTileEffect(layout.sand, 'sand', 'sand');
    checkTileEffect(layout.mud, 'mud', 'mud');

    // Half-cover is a neutral obstacle: one obstacle to a cell, on any terrain.
    const seenHalfCovers = new Set<string>();
    (layout.halfCovers ?? []).forEach((hc, idx) => {
      const k = `${hc.x},${hc.y}`;
      if (hc.x < 0 || hc.x >= layout.gridW || hc.y < 0 || hc.y >= layout.gridH) {
        ctx.addIssue({
          code: 'custom',
          path: ['halfCovers', idx],
          message: `half-cover (${hc.x},${hc.y}) out of bounds for ${layout.gridW}x${layout.gridH}`,
        });
      }
      if (neutralBlocked.has(k)) {
        ctx.addIssue({
          code: 'custom',
          path: ['halfCovers', idx],
          message: `half-cover (${hc.x},${hc.y}) overlaps a wall or another half-cover`,
        });
      }
      if (seenHalfCovers.has(k)) {
        ctx.addIssue({
          code: 'custom',
          path: ['halfCovers', idx],
          message: `duplicate half-cover (${hc.x},${hc.y})`,
        });
      }
      seenHalfCovers.add(k);
      neutralBlocked.add(k);
    });

    // Rubble footprints, each an N×N block from its min corner toward +x and
    // +y. The whole block must be in bounds and clear of every other neutral
    // (walls, half-cover, other rubble); it may sit on terrain.
    (layout.rubble ?? []).forEach((r, idx) => {
      const size = r.size ?? 1;
      if (
        r.x < 0 ||
        r.y < 0 ||
        r.x + size - 1 >= layout.gridW ||
        r.y + size - 1 >= layout.gridH
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['rubble', idx],
          message: `rubble (${r.x},${r.y}) size ${size} extends out of bounds for ${layout.gridW}x${layout.gridH}`,
        });
        return; // an out-of-bounds block reserves nothing (its cells are off-grid)
      }
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const cx = r.x + dx;
          const cy = r.y + dy;
          const k = `${cx},${cy}`;
          if (neutralBlocked.has(k)) {
            ctx.addIssue({
              code: 'custom',
              path: ['rubble', idx],
              message: `rubble (${r.x},${r.y}) size ${size} overlaps a wall, half-cover, or other rubble at (${cx},${cy})`,
            });
          }
          neutralBlocked.add(k);
        }
      }
    });

    // A spawn region may sit on any passable tile (water, fire, healing, hills,
    // ice, sand, mud): a unit can stand and fight there, with the tile's combat
    // mods and wading cost applied live (`defAt(position)`), so an author can
    // seat a team on chosen ground. Only cells a unit cannot occupy are refused:
    // impassable tiles (chasm, deep water) and neutral cells (wall, half-cover,
    // rubble), the set the connectivity check treats as blockers.
    const spawnBlocked = new Set<string>();
    for (const w of layout.walls) spawnBlocked.add(`${w.x},${w.y}`);
    for (const hc of layout.halfCovers ?? []) spawnBlocked.add(`${hc.x},${hc.y}`);
    for (const ch of layout.chasms ?? []) spawnBlocked.add(`${ch.x},${ch.y}`);
    for (const dw of layout.deepWater ?? []) spawnBlocked.add(`${dw.x},${dw.y}`);
    // A rubble block occupies its whole footprint.
    for (const r of layout.rubble ?? []) {
      const size = r.size ?? 1;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) spawnBlocked.add(`${r.x + dx},${r.y + dy}`);
      }
    }

    // Camp-spawn tiles follow the spawn regions' rule (a camp unit must be able
    // to appear there) and are unique. Spawn tiles with no camps to roll are an
    // authoring error, refused here rather than given a fallback, and a camp
    // listed twice is refused, since two weights on one id mean nothing.
    const seenCampSpawns = new Set<string>();
    (layout.campSpawns ?? []).forEach((t, idx) => {
      const k = `${t.x},${t.y}`;
      if (t.x < 0 || t.x >= layout.gridW || t.y < 0 || t.y >= layout.gridH) {
        ctx.addIssue({
          code: 'custom',
          path: ['campSpawns', idx],
          message: `camp spawn (${t.x},${t.y}) out of bounds for ${layout.gridW}x${layout.gridH}`,
        });
      }
      if (spawnBlocked.has(k)) {
        ctx.addIssue({
          code: 'custom',
          path: ['campSpawns', idx],
          message: `camp spawn (${t.x},${t.y}) sits on an impassable or occupied cell (wall, half-cover, chasm, deep water, or rubble)`,
        });
      }
      if (seenCampSpawns.has(k)) {
        ctx.addIssue({
          code: 'custom',
          path: ['campSpawns', idx],
          message: `duplicate camp spawn (${t.x},${t.y})`,
        });
      }
      seenCampSpawns.add(k);
    });
    if ((layout.campSpawns?.length ?? 0) > 0 && (layout.camps?.length ?? 0) === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['camps'],
        message: 'campSpawns present but the camps list is empty — a spawn tile has nothing to roll',
      });
    }
    const seenCampIds = new Set<string>();
    (layout.camps ?? []).forEach((ref, idx) => {
      if (seenCampIds.has(ref.campId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['camps', idx],
          message: `duplicate camp "${ref.campId}" in the camps list`,
        });
      }
      seenCampIds.add(ref.campId);
    });

    layout.spawns.forEach((region, regionIdx) => {
      region.tiles.forEach((t, tileIdx) => {
        if (t.x < 0 || t.x >= layout.gridW || t.y < 0 || t.y >= layout.gridH) {
          ctx.addIssue({
            code: 'custom',
            path: ['spawns', regionIdx, 'tiles', tileIdx],
            message: `tile (${t.x},${t.y}) out of bounds for ${layout.gridW}x${layout.gridH}`,
          });
        }
        if (spawnBlocked.has(`${t.x},${t.y}`)) {
          ctx.addIssue({
            code: 'custom',
            path: ['spawns', regionIdx, 'tiles', tileIdx],
            message: `spawn tile (${t.x},${t.y}) sits on an impassable or occupied cell (wall, half-cover, chasm, deep water, or rubble)`,
          });
        }
      });
    });

    // The battle picker draws the player region first, then the enemy
    // region from { enemy | both } \ { player's }. A valid layout needs
    // at least one (P, E) pair where P ≠ E, P ∈ player-pool, E ∈ enemy-
    // pool. This rule subsumes "≥1 player-available" + "≥1 enemy-
    // available" and also catches the degenerate "one 'both' region"
    // case where the enemy pool would be empty after the player draws.
    const playerPool: SpawnRegion[] = [];
    const enemyPool: SpawnRegion[] = [];
    for (const region of layout.spawns) {
      if (region.availability === 'player' || region.availability === 'both') playerPool.push(region);
      if (region.availability === 'enemy' || region.availability === 'both') enemyPool.push(region);
    }
    const hasValidPair = playerPool.some((p) => enemyPool.some((e) => e !== p));
    if (!hasValidPair) {
      ctx.addIssue({
        code: 'custom',
        path: ['spawns'],
        message:
          'layout must allow at least one (player, enemy) region pair with player ≠ enemy',
      });
    }
  });

/** The whole-file schema, exported for the layout editor's formatter test,
 *  which round-trips its output through it. */
export const LayoutsSchema = z.array(LayoutSchema).min(1);

export type LayoutDef = z.infer<typeof LayoutSchema>;

const LAYOUTS_LIST: readonly LayoutDef[] = LayoutsSchema.parse(layoutsJson);
// `name` is prose, shown in three places, the boss forewarning among them;
// `description` is editor metadata, never shown, and stays plain.
export const LAYOUTS_PROSE = loadProse('layouts', LayoutsSchema, LAYOUTS_LIST);

const seenIds = new Set<string>();
for (const layout of LAYOUTS_LIST) {
  if (seenIds.has(layout.id)) {
    throw new Error(`layouts.json: duplicate layout id "${layout.id}"`);
  }
  seenIds.add(layout.id);
}

export const LAYOUTS: readonly LayoutDef[] = LAYOUTS_LIST;
export const LAYOUT_IDS: readonly string[] = LAYOUTS_LIST.map((l) => l.id);

const LAYOUTS_BY_ID: Record<string, LayoutDef> = {};
for (const layout of LAYOUTS_LIST) LAYOUTS_BY_ID[layout.id] = layout;

export function getLayout(id: string): LayoutDef | undefined {
  return LAYOUTS_BY_ID[id];
}
