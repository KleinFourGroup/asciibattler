/**
 * Terrain knobs (C1a + D3). The per-encounter generator
 * (`src/sim/terrainGen.ts`) uses these for wall + shallow-water placement
 * and to bound the procedural side-length roll. Source of truth at
 * `config/terrain.json`.
 *
 * Densities are fractions of total cells, applied as a Bernoulli-style
 * draw with rejection for occupied cells — the actual count is
 * approximate.
 *
 * **D3 — variable map sizes.** Procedural encounters roll a side length
 * uniformly in `[proceduralMinSize, proceduralMaxSize]` (square; the
 * range is bounded by the editor / TileGrid clamps in
 * `src/config/layouts.ts`). Hand-authored layouts declare their own
 * `gridW` × `gridH` on each layout. The pre-D3 `spawnRowsClear` array
 * is gone — reserved rows are now computed per-encounter from `gridH`
 * (`[1, 2, gridH-3, gridH-2]`) inside the generator; D5 replaces the
 * row-based reservation with explicit per-layout spawn regions.
 *
 * `ensureConnectivity` runs a BFS from the topmost reserved row to the
 * bottommost after placement; if blocked, the generator removes walls
 * along the cut until a path opens. Cheap insurance against
 * pathological seeds.
 */

import { z } from 'zod';
import terrainJson from '../../config/terrain.json';
import { LAYOUT_MIN_SIDE, LAYOUT_MAX_SIDE } from './layouts';

const TerrainSchema = z
  .object({
    wallDensity: z.number().min(0).max(1),
    shallowWaterDensity: z.number().min(0).max(1),
    proceduralMinSize: z.number().int().min(LAYOUT_MIN_SIDE).max(LAYOUT_MAX_SIDE),
    proceduralMaxSize: z.number().int().min(LAYOUT_MIN_SIDE).max(LAYOUT_MAX_SIDE),
    ensureConnectivity: z.boolean(),
  })
  .refine((c) => c.proceduralMinSize <= c.proceduralMaxSize, {
    message: 'proceduralMinSize must be <= proceduralMaxSize',
  });

export type TerrainConfig = z.infer<typeof TerrainSchema>;

export const TERRAIN: TerrainConfig = TerrainSchema.parse(terrainJson);
