/**
 * Hand-authored encounter layouts (C1b + C1d.A).
 *
 * As of C1d.A, layouts are validated config — the source of truth lives
 * at `config/layouts.json` with the zod schema at `src/config/layouts.ts`.
 * This module is now a thin sim-side re-export so existing call sites
 * (Run, terrainGen, tests) keep working without churn.
 *
 * Picking strategy: `Run` rolls one RNG step at battle setup. ~25% of
 * battles get `layoutId = null` (procedural via the density-driven
 * generator in `terrainGen.ts`); the other ~75% pick uniformly from
 * `LAYOUT_IDS`. The library deliberately starts small — a larger one
 * would dilute each pick and reduce repeated exposure to any given
 * tactical lesson before the player has internalized it.
 *
 * Coordinate assumptions: each layout pins its own `gridW` × `gridH`
 * (8-32, set at authoring time). D5 retires `reservedSpawnRows` for
 * hand-authored layouts in favor of explicit `SpawnRegion`s on every
 * `LayoutDef`. `generateTerrain` throws on mismatched grid sizes rather
 * than silently scaling.
 *
 * Painting new layouts: use `tools/layout-editor/` (standalone Vite
 * page; see its README for launch instructions).
 */

export {
  LAYOUTS,
  LAYOUT_IDS,
  getLayout,
  SPAWN_REGION_TILE_COUNT,
  SPAWN_REGION_MIN_TILES,
  SPAWN_REGION_MAX_TILES,
  THEMES,
  type LayoutDef,
  type SpawnRegion,
  type SpawnAvailability,
  type Theme,
} from '../config/layouts';

/**
 * R3 — the single display label for a procedural map (`layoutId === null`). The
 * pre-turn map line ([PreTurnScreen](../ui/PreTurnScreen.ts)) and the in-battle
 * banner ([BattleScene](../scenes/BattleScene.ts)) both route through this one
 * constant so they can't drift again — pre-R3 they read "Uncharted ground" and
 * "Nowhere" respectively.
 */
export const PROCEDURAL_MAP_NAME = 'Uncharted Ground';
