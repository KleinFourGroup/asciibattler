/**
 * An encounter's terrain: the tile grid, the scenery's coords and the spawn
 * regions (`GeneratedTerrain`). A null `layoutId` builds a procedural board
 * (`proceduralMap.ts`); an id resolves that hand-authored layout
 * (`layouts.ts`). The run's encounter selection rolls which, from the
 * sector's weighted layout pool (`src/run/encounters/selection.ts`).
 *
 * It returns coords, not units: `battleSetup.applyTerrain` copies the tiles
 * onto the World, spawns the scenery as neutral units
 * (`spawnLayoutNeutrals`) and rolls the camps (`spawnCamps`), so the
 * generator needs no World and is tested alone.
 *
 * The width and height are separate arguments. The procedural path builds
 * on any rectangle (a run rolls a square side, `Run.ts`); the layout path
 * throws unless they are the layout's own `gridW` and `gridH`.
 *
 * A procedural board has two spawn regions, `'both'`-available bands of
 * `SPAWN_REGION_TILE_COUNT` cells centred on the top and bottom rows; a
 * layout declares its own.
 *
 * Deterministic: the same rng state, size, config, `layoutId` and theme
 * give the same terrain. `applyTerrain` passes
 * `deriveRng(terrainSeed, 'terrain')`, a stream of its own, so the terrain
 * draws nothing from the battle's.
 */

import { TileGrid } from './TileGrid';
import type { TerrainConfig } from '../config/terrain';
import type { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import {
  getLayout,
  type LayoutDef,
  type SpawnRegion,
  type CampRef,
  type Theme,
} from './layouts';
import { sampleProceduralParams, generateProceduralMap } from './proceduralMap';

/**
 * A wall or half-cover placement. With `hp` it spawns destructible, as the
 * `wall_destructible` or `half_cover_destructible` def with that pool;
 * without, the indestructible default. The procedural path emits bare
 * coords, so its walls and half cover are indestructible.
 */
type NeutralCoord = GridCoord & { readonly hp?: number | undefined };

/**
 * A rubble placement: its footprint's min corner, an optional `size` (1 to
 * 3, default 1, which picks the `rubble_1x1`, `2x2` or `3x3` def) and an
 * optional `hp` for that placement. Rubble is always destructible, so `hp`
 * only tunes the pool. Layouts only; the procedural path places none.
 */
type RubbleCoord = GridCoord & {
  readonly size?: number | undefined;
  readonly hp?: number | undefined;
};

export interface GeneratedTerrain {
  /** Every tile's kind, chasm, fire and healing tiles among them: a layout
   *  declares them, and a procedural board scatters fire when its theme
   *  has it. Standing on fire sustains burn (`World.applyTileStatuses`). */
  readonly tileGrid: TileGrid;
  readonly walls: readonly NeutralCoord[];
  /** Neutral obstacles that block movement and not sight (the def's
   *  `blocksLineOfSight: false`). A procedural board places them only as
   *  windows in its structural walls; a layout's may carry `hp`. */
  readonly halfCovers: readonly NeutralCoord[];
  /** Destructible rubble, spawned as neutrals with an N×N footprint
   *  (`battleSetup.spawnLayoutNeutrals`). Empty on a procedural board. */
  readonly rubble: readonly RubbleCoord[];
  /** Single-tile camp spawn points; each rolls one camp from `camps`
   *  (`battleSetup.spawnCamps`). A layout declares them; a procedural board
   *  rolls sites from `procedural.camps`. */
  readonly campSpawns: readonly GridCoord[];
  /** The weighted camp list the camp spawns roll from. Non-empty whenever
   *  `campSpawns` is: the layout schema refuses spawns with no camps, and a
   *  procedural board rolls no site when its theme's pool is empty. */
  readonly camps: readonly CampRef[];
  readonly spawnRegions: readonly SpawnRegion[];
}

export function generateTerrain(
  rng: RNG,
  gridW: number,
  gridH: number,
  config: TerrainConfig,
  layoutId: string | null = null,
  // The sector's theme picks a procedural board's tiles and camp pool
  // (`themeTiles`, `procedural.camps.pools`); the layout path ignores it,
  // as a layout carries its own theme. Callers with no sector (tests,
  // tools) get `grassland`.
  theme: Theme = 'grassland',
): GeneratedTerrain {
  if (layoutId !== null) {
    const layout = getLayout(layoutId);
    if (!layout) {
      throw new Error(`generateTerrain: unknown layoutId="${layoutId}"`);
    }
    return generateFromLayout(layout, gridW, gridH);
  }
  return generateProcedural(rng, gridW, gridH, config, theme);
}

/**
 * Resolves a hand-authored layout into a `GeneratedTerrain`. It throws when
 * the caller's size isn't the layout's own, an authoring bug, and repairs
 * nothing: the procedural path's connectivity carve doesn't run here, as a
 * layout's route is checked where it is authored (the editor and
 * `layouts.test.ts`, through `layoutConnectivity.ts`). The schema refuses a
 * spawn tile on a wall, half cover, rubble, chasm or deep water when the
 * file loads (`src/config/layouts.ts`), so this doesn't check again.
 *
 * Exported so a test can resolve a `LayoutDef` fixture without registering
 * it in `LAYOUTS`.
 */
export function generateFromLayout(
  layout: LayoutDef,
  gridW: number,
  gridH: number,
): GeneratedTerrain {
  if (gridW !== layout.gridW || gridH !== layout.gridH) {
    throw new Error(
      `generateTerrain: layout "${layout.id}" requires gridW=${layout.gridW} gridH=${layout.gridH} (got ${gridW}x${gridH})`,
    );
  }

  const tileGrid = new TileGrid(layout.gridW, layout.gridH);
  if (layout.water) {
    for (const w of layout.water) tileGrid.setKind(w, 'shallow_water');
  }
  if (layout.chasms) {
    for (const c of layout.chasms) tileGrid.setKind(c, 'chasm');
  }
  if (layout.fires) {
    for (const f of layout.fires) tileGrid.setKind(f, 'fire');
  }
  if (layout.healings) {
    for (const h of layout.healings) tileGrid.setKind(h, 'healing');
  }
  if (layout.deepWater) {
    for (const c of layout.deepWater) tileGrid.setKind(c, 'deep_water');
  }
  if (layout.hills) {
    for (const c of layout.hills) tileGrid.setKind(c, 'hills');
  }
  if (layout.ice) {
    for (const c of layout.ice) tileGrid.setKind(c, 'ice');
  }
  if (layout.sand) {
    for (const c of layout.sand) tileGrid.setKind(c, 'sand');
  }
  if (layout.mud) {
    for (const c of layout.mud) tileGrid.setKind(c, 'mud');
  }
  return {
    tileGrid,
    walls: layout.walls.slice(),
    halfCovers: layout.halfCovers ? layout.halfCovers.slice() : [],
    rubble: layout.rubble ? layout.rubble.slice() : [],
    campSpawns: layout.campSpawns ? layout.campSpawns.slice() : [],
    camps: layout.camps ? layout.camps.slice() : [],
    spawnRegions: layout.spawns,
  };
}

/**
 * The procedural path: samples the board's knobs from the `procedural`
 * envelope and the theme's `themeTiles` entry, then builds the board
 * (`proceduralMap.ts`). Both stages draw on the caller's stream in turn. A
 * procedural board has no chasm, healing tile or rubble.
 */
function generateProcedural(
  rng: RNG,
  gridW: number,
  gridH: number,
  config: TerrainConfig,
  theme: Theme,
): GeneratedTerrain {
  const params = sampleProceduralParams(rng, config.procedural, theme);
  const { tileGrid, walls, halfCovers, campSpawns, spawnRegions } = generateProceduralMap(
    rng,
    gridW,
    gridH,
    params,
  );
  // The rolled sites take the theme's pool, the pairing a layout's
  // `campSpawns` and `camps` hold: the pool goes only with a site, and no
  // site rolls on an empty pool (`sampleProceduralParams` sets the count
  // to 0).
  const campPool = campSpawns.length > 0 ? config.procedural.camps.pools[theme] : [];
  return {
    tileGrid,
    walls,
    halfCovers,
    rubble: [],
    campSpawns,
    camps: campPool,
    spawnRegions,
  };
}
