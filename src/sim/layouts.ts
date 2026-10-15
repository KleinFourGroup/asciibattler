/**
 * The hand-authored encounter layouts, re-exported from their config loader.
 * The data is `config/layouts.json`; the schema and its rules are in
 * `src/config/layouts.ts`.
 *
 * Which layout an encounter gets is rolled at encounter selection
 * (`src/run/encounters/selection.ts`): a weighted pick from the sector's
 * layout pool at the current hop, narrowed by the encounter's own layout
 * list. The pool's `procedural` entry gives `layoutId = null`, a board from
 * the generator in `terrainGen.ts`.
 *
 * A layout fixes its own `gridW` × `gridH`; `generateTerrain` throws when a
 * caller's dimensions differ rather than scaling the layout.
 *
 * New layouts are painted in `tools/layout-editor/` (see its README).
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
  type CampRef,
} from '../config/layouts';
