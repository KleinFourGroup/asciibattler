/**
 * C1d.A: hand-authored encounter layouts as validated config.
 * D3: each layout now declares its own `gridW` × `gridH` (8-32).
 * D5: each layout now declares explicit `spawns: SpawnRegion[]` (each
 *     region is exactly 8 tiles + an availability flag).
 *
 * Source of truth at `config/layouts.json` — a flat array preserving
 * order (the order seeds `rng.pick` in `Run.handleEnterNode`, so
 * reordering changes determinism for past seeds — append only).
 *
 * Each layout pins a tactical situation onto a rectangular arena: its
 * own grid size, a wall topology, an optional water topology, plus a
 * `name` + `description` for the editor UI and future picker hooks.
 *
 * Validation runs at module load. Malformed JSON throws a zod trace at
 * boot — the loud-failure mode A4 settled on for balance configs.
 *
 * Adding a layout:
 *   1. Append an entry to `config/layouts.json` (use the editor at
 *      `tools/layout-editor/` to paint and export).
 *   2. The `id` must be unique. `name`, `description`, `gridW`, `gridH`,
 *      and `spawns` are required.
 *   3. Validate by running `npm test` — the layouts test suite checks
 *      grid bounds, region invariants, duplicate coords, and
 *      connectivity.
 */

import { z } from 'zod';
import layoutsJson from '../../config/layouts.json';

const CoordSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

/**
 * §40c — a wall / half-cover coord that may carry an optional per-instance `hp`,
 * making THAT placement destructible (spawned as the `wall_destructible` /
 * `half_cover_destructible` neutral def, whose HP-presence is the §40b signal that
 * makes it combat-targetable). Absent `hp` ⇒ the indestructible `wall` / `half_cover`
 * def — the locked "wall-destructibility OFF by default" rule. Backward-compatible:
 * a bare `{x,y}` coord (every shipped layout today) parses unchanged. The cap mirrors
 * the neutral-def `hp` cap (a typo guard, not a design knob); §41 tunes the pools.
 */
const NeutralCoordSchema = CoordSchema.extend({
  hp: z.number().int().positive().max(999).optional(),
});

/** §40d — the rubble footprint side range (mirrors §39's 1..3 footprint range +
 *  the three `rubble_1x1/2x2/3x3` catalog defs). A typo guard, not a design knob. */
export const RUBBLE_MIN_SIZE = 1;
export const RUBBLE_MAX_SIZE = 3;

/**
 * §40d — a destructible rubble placement: its canonical footprint CORNER `{x,y}`
 * (the min corner, block extending +x/+y per §39) plus an optional `size` (1..3,
 * default 1 — picks the `rubble_1x1/2x2/3x3` catalog def) and an optional
 * per-instance `hp` OVERRIDE. Unlike a wall (where `hp`-PRESENCE is what makes it
 * destructible — see `NeutralCoordSchema`), rubble is ALWAYS destructible (its def
 * carries an `hp` pool), so `hp` here only TUNES that pool; absent ⇒ the catalog
 * default for the size (25/60/110, UNTUNED §41). `hp` shares `NeutralCoordSchema`'s
 * cap. Footprint-aware validation (the whole N×N block in-bounds + non-overlapping)
 * lives in `LayoutSchema.superRefine`.
 */
const RubbleCoordSchema = CoordSchema.extend({
  size: z.number().int().min(RUBBLE_MIN_SIZE).max(RUBBLE_MAX_SIZE).optional(),
  hp: z.number().int().positive().max(999).optional(),
});

/** Hand-authored layouts pick their own grid size in this range. */
export const LAYOUT_MIN_SIDE = 8;
export const LAYOUT_MAX_SIDE = 32;

/**
 * Default tiles per spawn region — the procedural top/bottom edge bands
 * and the layout editor's starting region template are both this wide.
 * Hand-authored regions are NOT pinned to it: they may hold anywhere
 * from `SPAWN_REGION_MIN_TILES` to `SPAWN_REGION_MAX_TILES` tiles.
 */
export const SPAWN_REGION_TILE_COUNT = 8;

/**
 * Inclusive tile-count range for a hand-authored spawn region. Relaxed
 * (H2) from a hard 8 — the "8" was a relic of the old 8-card hand plan,
 * and the sim is tile-count-agnostic (`spawnTeam` places
 * `min(team, tiles)` on a random subset and overflows the rest to the
 * D5.C queue; every other consumer reads `region.tiles.length`). A
 * region smaller than the team trickle-spawns the remainder as tiles
 * vacate; a region larger than the team picks a random subset (the H2
 * positional-variance lever).
 */
export const SPAWN_REGION_MIN_TILES = 1;
export const SPAWN_REGION_MAX_TILES = 10;

const SideSchema = z.number().int().min(LAYOUT_MIN_SIDE).max(LAYOUT_MAX_SIDE);

const SpawnAvailabilitySchema = z.enum(['player', 'enemy', 'both']);
export type SpawnAvailability = z.infer<typeof SpawnAvailabilitySchema>;

/**
 * D8 — visual theme for the layout's tile palette. Cosmetic only; no sim
 * effects. Closed union so the procedural-side roll in `Run.handleEnterNode`
 * and the editor dropdown can't drift onto a name that has no palette.
 *
 * - `grassland`: the canonical DARK_TERMINAL_GREEN → DARK_TERMINAL_AMBER lerp.
 * - `barren`: gray tones (variants of TERMINAL_STONE).
 * - `volcanic`: dark red base with amber accents; pairs naturally with
 *   D7 fire tiles.
 * - `tundra`: blue-white snow. · `desert`: warm sand. · `swamp`: murky
 *   brown-greens. (§37e — fixed identity palettes in `TerrainRenderer`.)
 *
 * §37e renamed `default → grassland` and `rock → barren` (the latter so the
 * palette name doesn't collide with the §37b Hills tile that renders
 * mini-mountains). `theme` is serialized in the RunSnapshot, so the rename
 * forced a RunSnapshot v23→v24 reject-stale bump (see `Run.ts`).
 *
 * Adding a theme: extend `ThemeSchema` and add a palette entry in
 * `TerrainRenderer.topColorFor`. The editor + procedural picker both
 * read from this enum, so a new theme automatically appears in both.
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
/** Picker pool for the procedural roll + the editor dropdown. */
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
    name: z.string().min(1),
    description: z.string().min(1),
    gridW: SideSchema,
    gridH: SideSchema,
    /** §40c: each wall coord may carry an optional `hp` (→ destructible; see
     *  `NeutralCoordSchema`). A bare `{x,y}` (the default) is an indestructible wall. */
    walls: z.array(NeutralCoordSchema),
    water: z.array(CoordSchema).optional(),
    /** D6: optional neutral-team half-cover entities. Pathfinding blocks
     *  through them like walls; ranged LOS shoots OVER them. Validation
     *  rejects overlap with walls, water, spawn regions, or self.
     *  §40c: an optional per-coord `hp` makes that cover destructible. */
    halfCovers: z.array(NeutralCoordSchema).optional(),
    /** §40d: optional destructible rubble obstacles (neutral `UnitDef`s, §40a).
     *  Each carries a footprint `size` (1..3, default 1) anchored at `{x,y}` as
     *  its min corner + an optional per-instance `hp` override. Footprint-aware
     *  overlap/bounds validation in `superRefine` (the whole N×N block must fit +
     *  not collide); the block's cells also block spawns (a unit can't stand on
     *  rubble). Spawned via `spawnRubble` in `battleSetup.applyTerrain`. */
    rubble: z.array(RubbleCoordSchema).optional(),
    /** D7.A: optional impassable tile (Infinity pathfinding cost, LOS-
     *  transparent — LOS never inspects tiles). Hand-authored-only in
     *  D7 like half-cover (no procedural density knob). Validation
     *  rejects overlap with walls, water, half-covers, spawn regions,
     *  or self. */
    chasms: z.array(CoordSchema).optional(),
    /** D7.B: optional fire tile (normal pathing cost, per-tick chip
     *  damage to standing combatants). Hand-authored-only. Validation
     *  rejects overlap with any other reservation (including healing
     *  — tile-kind is mutex per cell). */
    fires: z.array(CoordSchema).optional(),
    /** D7.B: optional healing tile (normal pathing cost, per-tick heal
     *  to standing combatants, clamped at maxHp). Hand-authored-only.
     *  Same overlap rules as fires. */
    healings: z.array(CoordSchema).optional(),
    /** §37f — the five §37b terrain tiles, each an optional hand-authored
     *  coord array (tile-kind is mutex per cell, validated by `checkTileEffect`
     *  like fire/healing). `deepWater` is impassable like chasm (Infinity cost);
     *  `hills`/`ice`/`sand`/`mud` are passable cost/combat-mod tiles. Applied to
     *  the TileGrid by `terrainGen` → `setKind`. */
    deepWater: z.array(CoordSchema).optional(),
    hills: z.array(CoordSchema).optional(),
    ice: z.array(CoordSchema).optional(),
    sand: z.array(CoordSchema).optional(),
    mud: z.array(CoordSchema).optional(),
    spawns: z.array(SpawnRegionSchema).min(2),
    /** D8 — visual theme. Required: every layout (including retrofitted
     *  ones) declares its palette explicitly so the loader never has to
     *  guess. Procedural encounters roll this off `battleRng` instead. */
    theme: ThemeSchema,
  })
  .superRefine((layout, ctx) => {
    const blocked = new Set<string>();
    for (const w of layout.walls) blocked.add(`${w.x},${w.y}`);
    for (const w of layout.water ?? []) blocked.add(`${w.x},${w.y}`);

    // D6 — half-cover overlap checks. Half-covers can't sit on walls or
    // water (the cell would be doubly-claimed); after this check they
    // also reserve their cells against spawn regions.
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
      if (blocked.has(k)) {
        ctx.addIssue({
          code: 'custom',
          path: ['halfCovers', idx],
          message: `half-cover (${hc.x},${hc.y}) overlaps a wall or water`,
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
      blocked.add(k);
    });

    // D7.A — chasm overlap checks. Mirrors the half-cover pattern;
    // chasms reserve their cells against subsequent spawn-region
    // overlap.
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
      if (blocked.has(k)) {
        ctx.addIssue({
          code: 'custom',
          path: ['chasms', idx],
          message: `chasm (${ch.x},${ch.y}) overlaps a wall, water, or half-cover`,
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
      blocked.add(k);
    });

    // D7.B — fire + healing overlap checks. Tile-kind is mutex per cell,
    // so each fire/healing tile must be unique and not overlap any prior
    // reservation. They reserve their cells against subsequent spawn-
    // region overlap too.
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
        if (blocked.has(k)) {
          ctx.addIssue({
            code: 'custom',
            path: [pathKey, idx],
            message: `${label} (${t.x},${t.y}) overlaps an earlier reservation`,
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
        blocked.add(k);
      });
    };
    checkTileEffect(layout.fires, 'fires', 'fire');
    checkTileEffect(layout.healings, 'healings', 'healing');
    // §37f — the five new terrain tiles, same mutex-per-cell overlap rule.
    checkTileEffect(layout.deepWater, 'deepWater', 'deep water');
    checkTileEffect(layout.hills, 'hills', 'hills');
    checkTileEffect(layout.ice, 'ice', 'ice');
    checkTileEffect(layout.sand, 'sand', 'sand');
    checkTileEffect(layout.mud, 'mud', 'mud');

    // §40d — rubble footprints. Each rubble is an N×N block (size 1..3, default 1)
    // anchored at {x,y} as its MIN corner, cells extending toward +x/+y (the §39
    // footprint convention). Unlike a wall, rubble is always destructible (the
    // neutral def carries `hp`); its optional `hp` only tunes the pool. The WHOLE
    // block must be in-bounds and clear of every earlier reservation (walls /
    // water / half-cover / chasm / terrain tiles) and any other rubble. Each
    // reserved cell then blocks spawns below (a unit can't stand on rubble).
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
          if (blocked.has(k)) {
            ctx.addIssue({
              code: 'custom',
              path: ['rubble', idx],
              message: `rubble (${r.x},${r.y}) size ${size} overlaps an earlier reservation at (${cx},${cy})`,
            });
          }
          blocked.add(k);
        }
      }
    });

    // §37g — a spawn region may sit on any PASSABLE tile (water / fire / healing
    // / hills / ice / sand / mud): a unit can stand and fight there, and its
    // terrain combat mods + wading cost apply live (read off `defAt(position)`),
    // so authors can deliberately seat a team on tactically-flavored ground.
    // Reject only cells a unit can't physically occupy — impassable tiles
    // (chasm, deep water) and neutral-unit cells (wall, half-cover, rubble). This
    // is the SAME impassable/occupied set the connectivity guard treats as blockers.
    const spawnBlocked = new Set<string>();
    for (const w of layout.walls) spawnBlocked.add(`${w.x},${w.y}`);
    for (const hc of layout.halfCovers ?? []) spawnBlocked.add(`${hc.x},${hc.y}`);
    for (const ch of layout.chasms ?? []) spawnBlocked.add(`${ch.x},${ch.y}`);
    for (const dw of layout.deepWater ?? []) spawnBlocked.add(`${dw.x},${dw.y}`);
    // §40d — a rubble block occupies its whole N×N footprint; spawns can't sit on it.
    for (const r of layout.rubble ?? []) {
      const size = r.size ?? 1;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) spawnBlocked.add(`${r.x + dx},${r.y + dy}`);
      }
    }

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

/** The whole-file array schema. Exported so the layout editor's formatter
 *  test (M5) can round-trip its emitted JSON through the real loader schema. */
export const LayoutsSchema = z.array(LayoutSchema).min(1);

export type LayoutDef = z.infer<typeof LayoutSchema>;

const LAYOUTS_LIST: readonly LayoutDef[] = LayoutsSchema.parse(layoutsJson);

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
