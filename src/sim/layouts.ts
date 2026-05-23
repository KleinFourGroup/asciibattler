/**
 * Hand-authored encounter layouts (C1b + C1d.A).
 *
 * As of C1d.A, layouts are validated config — the source of truth lives
 * at `config/layouts.json` with the zod schema at `src/config/layouts.ts`.
 * This module is now a thin sim-side re-export so existing call sites
 * (Run, terrainGen, tests) keep working without churn.
 *
 * Picking strategy: `Run` rolls one RNG step at battle setup. ~50% of
 * battles get `layoutId = null` (procedural via the density-driven
 * generator in `terrainGen.ts`); the other ~50% pick uniformly from
 * `LAYOUT_IDS`. The library deliberately starts small — a larger one
 * would dilute each pick and reduce repeated exposure to any given
 * tactical lesson before the player has internalized it.
 *
 * Coordinate assumptions: every layout is authored against a 12x12
 * grid with `spawnRowsClear = [1, 2, 9, 10]`. `generateTerrain` throws
 * on mismatched grid sizes rather than silently scaling.
 *
 * Painting new layouts: use `tools/layout-editor/` (standalone Vite
 * page; see its README for launch instructions).
 */

export { LAYOUTS, LAYOUT_IDS, getLayout, type LayoutDef } from '../config/layouts';
