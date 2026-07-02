/**
 * Per-encounter terrain generator. Given an encounter's RNG fork, the
 * arena dimensions, and the terrain config, returns a freshly-built
 * `GeneratedTerrain` — TileGrid + wall coords + spawn regions. The
 * caller (battle setup) is responsible for turning the walls into
 * neutral-team `Unit`s via `spawnWall` and for drawing player + enemy
 * regions from the returned `spawnRegions`. That seam keeps the
 * generator independent of World construction and easy to test in
 * isolation.
 *
 * Hybrid model: when `layoutId` is null the generator uses the
 * procedural path (the M6 crossbar + divider + noise blend in
 * `src/sim/proceduralMap.ts`); when non-null it dispatches to the
 * hand-authored library at `src/sim/layouts.ts`. `Run` rolls the split
 * at encounter creation time, so a given playthrough sees a mix of
 * procedural variety and tactically-tuned set pieces.
 *
 * **D3 — rectangular arenas.** The generator takes `(gridW, gridH)`
 * independently. Procedural builds its structure on any rectangle in the
 * configured size range; the layout path reads the layout's own
 * `gridW` × `gridH` and refuses if the caller's dimensions disagree.
 *
 * **D5 — explicit spawn regions.** Every encounter now carries
 * `SpawnRegion[]` (each region is exactly 8 tiles + an availability
 * flag). Hand-authored layouts declare their regions in JSON;
 * procedural emits two `'both'`-availability bands on the top and
 * bottom edges of the arena. Walls + water mask against the union of
 * all spawn tiles instead of the pre-D5 `reservedSpawnRows` array
 * (retired in D5.D.A along with the editor's stripe overlay).
 *
 * Determinism contract: same `(rng state, gridW, gridH, config,
 * layoutId)` → identical `GeneratedTerrain`. Tests rely on this so the
 * fuzz harness can replay any seed; battleSetup feeds in a per-
 * encounter RNG fork so terrain doesn't perturb the battle RNG stream.
 */

import { TileGrid } from './TileGrid';
import type { TerrainConfig } from '../config/terrain';
import type { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import {
  getLayout,
  type LayoutDef,
  type SpawnRegion,
} from './layouts';
import { sampleProceduralParams, generateProceduralMap } from './proceduralMap';

/**
 * §40c — a wall / half-cover placement carrying an OPTIONAL per-instance `hp`.
 * Present ⇒ destructible (spawned as the `wall_destructible` / `half_cover_destructible`
 * neutral def); absent ⇒ the indestructible default. A bare `GridCoord` (the procedural
 * path emits only these) is assignable — `hp` is optional — so procedural obstacles stay
 * indestructible with no code change.
 */
export type NeutralCoord = GridCoord & { readonly hp?: number | undefined };

/**
 * §40d — a rubble placement: a footprint CORNER plus an optional `size` (1..3,
 * default 1 — picks the `rubble_1x1/2x2/3x3` def) and an optional per-instance `hp`
 * override. Unlike a wall (`hp`-presence ⇒ destructible), rubble is always
 * destructible; `hp` only tunes the pool. `battleSetup.applyTerrain` spawns each
 * via `spawnRubble`. Hand-authored-only (procedural emits none).
 */
export type RubbleCoord = GridCoord & {
  readonly size?: number | undefined;
  readonly hp?: number | undefined;
};

export interface GeneratedTerrain {
  readonly tileGrid: TileGrid;
  readonly walls: readonly NeutralCoord[];
  /** D6: neutral-team LOS-transparent obstacles. Procedural emits these
   *  as the noise field's half-cover share (M6); hand-authored layouts
   *  may declare any count. Pathfinding blocks through them;
   *  AttackBehavior shoots over. §40c: a hand-authored coord may carry `hp`
   *  (destructible cover); procedural emits bare coords (indestructible). */
  readonly halfCovers: readonly NeutralCoord[];
  /** D7.A: impassable tile (Infinity pathfinding cost, LOS-transparent).
   *  Stored on `tileGrid` itself as `kind === 'chasm'`; this array is a
   *  parallel readout so callers (renderer, editor, tests) can iterate
   *  chasm coords without re-walking the grid. Empty for procedural —
   *  hand-authored-only in D7. */
  readonly chasms: readonly GridCoord[];
  /** D7.B: fire tile coords (per-tick chip damage to standing units).
   *  Stored on `tileGrid` as `kind === 'fire'`; parallel readout same
   *  pattern as chasm. Empty for procedural — hand-authored-only in D7. */
  readonly fires: readonly GridCoord[];
  /** D7.B: healing tile coords (per-tick heal to standing units).
   *  Stored on `tileGrid` as `kind === 'healing'`; parallel readout
   *  same pattern as chasm. Empty for procedural. */
  readonly healings: readonly GridCoord[];
  /** §40d: destructible rubble obstacles (neutral `UnitDef`s with a footprint +
   *  HP). Each is spawned as a multi-tile neutral by `battleSetup.applyTerrain`.
   *  Empty for procedural — hand-authored-only, like chasm/fire/healing. */
  readonly rubble: readonly RubbleCoord[];
  readonly spawnRegions: readonly SpawnRegion[];
}

export function generateTerrain(
  rng: RNG,
  gridW: number,
  gridH: number,
  config: TerrainConfig,
  layoutId: string | null = null,
): GeneratedTerrain {
  if (layoutId !== null) {
    const layout = getLayout(layoutId);
    if (!layout) {
      throw new Error(`generateTerrain: unknown layoutId="${layoutId}"`);
    }
    return generateFromLayout(layout, gridW, gridH);
  }
  return generateProcedural(rng, gridW, gridH, config);
}

/**
 * Resolve a hand-authored layout into a `GeneratedTerrain`. Validates
 * that the caller's dimensions match the layout's own `gridW` × `gridH`;
 * a violation is a layout-authoring bug, so the dispatcher throws rather
 * than silently rescuing it (the procedural path's `ensureConnectivity`
 * wall-peel doesn't apply here — hand authored means hand verified).
 *
 * D5 — wall/water overlap with spawn tiles is enforced by zod at
 * module-load time (see `src/config/layouts.ts`); the generator no
 * longer re-checks it.
 *
 * Exported (§40d) so tests can resolve a hand-built `LayoutDef` fixture
 * straight to a `GeneratedTerrain` without registering it in the global
 * `LAYOUTS` catalog — the layout-resolution seam `generateTerrain` dispatches to.
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
  // §37f — the five §37b terrain tiles (each an optional hand-authored array,
  // mapped to its TileKind). Mirrors the water/chasm/fire/healing loops above.
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
    chasms: layout.chasms ? layout.chasms.slice() : [],
    fires: layout.fires ? layout.fires.slice() : [],
    healings: layout.healings ? layout.healings.slice() : [],
    rubble: layout.rubble ? layout.rubble.slice() : [],
    spawnRegions: layout.spawns,
  };
}

/**
 * Procedural path (M6). Samples a concrete map-parameter set from the
 * `procedural` config envelope, then builds the crossbar + divider +
 * noise blend in `src/sim/proceduralMap.ts`. Both stages consume the
 * caller's per-encounter RNG fork in sequence, so the whole thing stays
 * deterministic per `(rng state, gridW, gridH, config)`. The legacy
 * `wallDensity` / `shallowWaterDensity` / `ensureConnectivity` knobs no
 * longer apply here (the new generator owns its own obstacle budget +
 * connectivity guard); they're slated for removal from the config.
 *
 * D7: procedural is hand-authored-only for chasm / fire / healing —
 * empty arrays keep the `GeneratedTerrain` shape stable. (Half-cover is
 * now procedural too, emitted by the noise field — see D6 note above.)
 */
function generateProcedural(
  rng: RNG,
  gridW: number,
  gridH: number,
  config: TerrainConfig,
): GeneratedTerrain {
  const params = sampleProceduralParams(rng, config.procedural);
  const { tileGrid, walls, halfCovers, spawnRegions } = generateProceduralMap(
    rng,
    gridW,
    gridH,
    params,
  );
  return {
    tileGrid,
    walls,
    halfCovers,
    chasms: [],
    fires: [],
    healings: [],
    rubble: [],
    spawnRegions,
  };
}
