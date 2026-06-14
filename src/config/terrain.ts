/**
 * Terrain knobs (C1a + D3 + M6). The per-encounter generator
 * (`src/sim/terrainGen.ts`) uses these for wall + shallow-water placement
 * and to bound the procedural side-length roll. Source of truth at
 * `config/terrain.json`.
 *
 * **Legacy scatter (C1a):** `wallDensity` + `shallowWaterDensity` are
 * fractions of total cells, applied as a Bernoulli-style draw with
 * rejection for occupied cells — the actual count is approximate. These
 * drive the *current* uniform-scatter procedural path and are slated for
 * removal once the M6 `procedural` block below replaces it.
 *
 * **M6 — the `procedural` block** is the sampling surface for the
 * reworked generator (crossbar + divider + noise blend). Rather than
 * fixed values, each knob declares a RANGE (`{min,max}`, optionally
 * biased toward a `center` by an `intensity`) or a WEIGHTED choice over
 * discrete values; the generator samples one concrete value per knob per
 * encounter (`sampleProceduralParams`, `src/sim/proceduralMap.ts`), so
 * maps vary seed-to-seed within the designer-set envelope. See
 * `src/core/sampling.ts` for the `sampleRange` / `weightedPick` math.
 *
 * **D3 — variable map sizes.** Procedural encounters roll a side length
 * uniformly in `[proceduralMinSize, proceduralMaxSize]` (square; the
 * range is bounded by the editor / TileGrid clamps in
 * `src/config/layouts.ts`). Hand-authored layouts declare their own
 * `gridW` × `gridH` on each layout.
 *
 * `ensureConnectivity` runs a BFS from the topmost reserved row to the
 * bottommost after placement; if blocked, the generator removes walls
 * along the cut until a path opens. Cheap insurance against
 * pathological seeds.
 */

import { z } from 'zod';
import terrainJson from '../../config/terrain.json';
import { LAYOUT_MIN_SIDE, LAYOUT_MAX_SIDE } from './layouts';

/**
 * A numeric knob sampled per encounter. Bare `{min,max}` samples
 * uniformly; adding `center` + `intensity` (0..1) biases toward `center`
 * via a uniform↔triangular blend (intensity 0 = uniform, 1 = peaked).
 * `center` is the mode, not the mean. See `src/core/sampling.ts#sampleRange`.
 */
const RangeSchema = z
  .object({
    min: z.number(),
    max: z.number(),
    center: z.number().optional(),
    intensity: z.number().min(0).max(1).optional(),
  })
  .refine((s) => s.min <= s.max, { message: 'range: min must be <= max' })
  .refine((s) => s.center === undefined || (s.center >= s.min && s.center <= s.max), {
    message: 'range: center must lie within [min, max]',
  });

/**
 * A weighted choice over discrete non-negative integer values, keyed by
 * the integer as a string: `{ "0": 0.15, "1": 0.4, ... }`. At least one
 * weight must be positive (set a value to 0 to exclude it). Sampled by
 * `weightedPick`.
 */
const WeightedIntsSchema = z
  .record(
    z.string().regex(/^\d+$/, 'weighted-int keys must be non-negative integers'),
    z.number().nonnegative(),
  )
  .refine((w) => Object.values(w).some((v) => v > 0), {
    message: 'weighted choice needs at least one positive weight',
  });

/**
 * Weighted choice over the three symmetry modes. All three keys are
 * required (set a weight to 0 to disable a mode); at least one must be
 * positive.
 */
const SymmetryWeightsSchema = z
  .object({
    none: z.number().nonnegative(),
    mirror: z.number().nonnegative(),
    point: z.number().nonnegative(),
  })
  .refine((w) => w.none + w.mirror + w.point > 0, {
    message: 'symmetry weights need at least one positive weight',
  });

/**
 * The M6 procedural-map sampling surface. Each knob is sampled once per
 * encounter from its range/weights, so maps vary within the envelope.
 * `wallCapFraction` is a fixed guard rail (a hard ceiling on obstacle
 * cells, not sampled). Resolved into a concrete param set by
 * `sampleProceduralParams` (`src/sim/proceduralMap.ts`).
 */
const ProceduralSchema = z.object({
  symmetry: SymmetryWeightsSchema,
  crossbars: WeightedIntsSchema,
  gapsPerBar: WeightedIntsSchema,
  gapWidth: RangeSchema,
  fordChance: RangeSchema,
  crossbarWaver: RangeSchema,
  dividers: WeightedIntsSchema,
  coverDensity: RangeSchema,
  halfCoverFraction: RangeSchema,
  poolDensity: RangeSchema,
  noiseScale: RangeSchema,
  wallCapFraction: z.number().min(0).max(1),
});

const TerrainSchema = z
  .object({
    wallDensity: z.number().min(0).max(1),
    shallowWaterDensity: z.number().min(0).max(1),
    proceduralMinSize: z.number().int().min(LAYOUT_MIN_SIDE).max(LAYOUT_MAX_SIDE),
    proceduralMaxSize: z.number().int().min(LAYOUT_MIN_SIDE).max(LAYOUT_MAX_SIDE),
    ensureConnectivity: z.boolean(),
    procedural: ProceduralSchema,
  })
  .refine((c) => c.proceduralMinSize <= c.proceduralMaxSize, {
    message: 'proceduralMinSize must be <= proceduralMaxSize',
  });

export type TerrainConfig = z.infer<typeof TerrainSchema>;
export type ProceduralTerrainConfig = z.infer<typeof ProceduralSchema>;
export type RangeSpec = z.infer<typeof RangeSchema>;

export const TERRAIN: TerrainConfig = TerrainSchema.parse(terrainJson);
