/**
 * C1a terrain knobs. The per-encounter generator (`src/sim/terrainGen.ts`)
 * uses these to seed wall + shallow-water placement and to guard the
 * spawn rows. Source of truth at `config/terrain.json`.
 *
 * Densities are fractions of total cells (12×12 = 144 by default, so
 * `wallDensity: 0.06` targets ~9 walls per encounter). The generator
 * applies them as a Bernoulli-style draw with rejection for occupied
 * cells, so the actual count is approximate.
 *
 * `spawnRowsClear` lists battle-grid rows (y indices) that the generator
 * MUST leave free of obstacles. With the current `battleSetup` formation
 * (player melee on y=2, ranged on y=1; enemy melee on y=9, ranged on
 * y=10), rows 1/2/9/10 are reserved so units never spawn on a wall or in
 * a water tile.
 *
 * `ensureConnectivity` runs a BFS from the player spawn area to the
 * enemy spawn area after placement; if blocked, the generator removes
 * walls along the cut until a path opens. Cheap insurance against
 * pathological seeds.
 *
 * Layout library: C1a ships procedural-only. The encounter will carry an
 * optional `layoutId` field (null in C1a) for the future hand-authored
 * library; the resolver lives in `terrainGen.ts` and throws if a
 * non-null id arrives before the library exists.
 */

import { z } from 'zod';
import terrainJson from '../../config/terrain.json';

const TerrainSchema = z.object({
  wallDensity: z.number().min(0).max(1),
  shallowWaterDensity: z.number().min(0).max(1),
  spawnRowsClear: z.array(z.number().int().nonnegative()),
  ensureConnectivity: z.boolean(),
});

export type TerrainConfig = z.infer<typeof TerrainSchema>;

export const TERRAIN: TerrainConfig = TerrainSchema.parse(terrainJson);
