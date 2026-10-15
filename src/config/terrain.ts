/**
 * The envelope of the procedural map generator (`src/sim/terrainGen.ts`).
 * Source of truth at `config/terrain.json`.
 *
 * - `proceduralMinSize`, `proceduralMaxSize` — a procedural board is
 *   square, its side rolled uniformly in this range, inside the layout side
 *   bounds (`src/config/layouts.ts`). A hand-authored layout gives its own
 *   `gridW` and `gridH`.
 * - `procedural` — the generator's knobs (crossbars, dividers and a noise
 *   blend). Each declares a range (`{min, max}`, optionally biased toward a
 *   `center` by an `intensity`) or a weighted choice over discrete values,
 *   and the generator samples one value per knob per encounter
 *   (`sampleProceduralParams`, `src/sim/proceduralMap.ts`), so maps vary
 *   from seed to seed within the envelope. The sampling is in
 *   `src/core/sampling.ts`.
 */

import { z } from 'zod';
import terrainJson from '../../config/terrain.json';
import {
  LAYOUT_MIN_SIDE,
  LAYOUT_MAX_SIDE,
  THEMES,
  type Theme,
  type CampRef,
} from './layouts';

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
 * One theme's tiles on a procedural board. Every knob is an optional range:
 * absent, the feature is off for the theme and draws nothing, so a theme's
 * draw count is fixed by the keys it declares (`sampleProceduralParams`
 * samples in a fixed order).
 * - `poolDensity` — the theme's own pool band, in place of the global one
 *   (a desert keeps sparse oases).
 * - `deepWaterFraction` — the share of the pool band that deepens to
 *   impassable `deep_water`, deepest noise first, so deep centres stay
 *   ringed by shallows; fords and carves never deepen.
 * - `hills`, `ice`, `sand`, `mud` — ground-patch densities, each on its own
 *   noise field: the share of floor cells claimed.
 * - `fire` — a sparse scatter chance per floor cell, never on a chokepoint,
 *   so the crossing stays free.
 */
const ThemeTilesSchema = z.object({
  poolDensity: RangeSchema.optional(),
  deepWaterFraction: RangeSchema.optional(),
  hills: RangeSchema.optional(),
  ice: RangeSchema.optional(),
  sand: RangeSchema.optional(),
  mud: RangeSchema.optional(),
  fire: RangeSchema.optional(),
});

/**
 * The per-theme tile table, exhaustive over `Theme`: a new theme must declare
 * its envelope (`{}` for plain boards) before the config parses.
 */
const ThemeTilesTableSchema = z.object(
  Object.fromEntries(THEMES.map((t) => [t, ThemeTilesSchema])) as Record<
    Theme,
    typeof ThemeTilesSchema
  >,
);

/** One pool entry: a camp the theme's procedural boards may roll, in the
 *  layouts' `CampRef` shape (weight omitted is 1). camps.ts checks the refs
 *  (`assertProceduralCampRefs`), as it does the layouts'. */
const CampPoolEntrySchema = z.object({
  campId: z.string().min(1),
  weight: z.number().positive().optional(),
}) as z.ZodType<CampRef>;

/** The weights of the camp-site placement modes. All three keys are
 *  required, at least one positive.
 *  - `pair` — two sites at symmetry-partner cells.
 *  - `midBand` — the neutral middle third of rows.
 *  - `free` — anywhere a camp fits, the rare asymmetric case. */
const CampPlacementWeightsSchema = z
  .object({
    pair: z.number().nonnegative(),
    midBand: z.number().nonnegative(),
    free: z.number().nonnegative(),
  })
  .refine((w) => w.pair + w.midBand + w.free > 0, {
    message: 'camp placement weights need at least one positive weight',
  });

/**
 * Camps on procedural boards. These carry no authored `campSpawns`, so the
 * generator rolls camp sites from this block and the theme's pool, which
 * supply what a layout's `campSpawns` and `camps` pair does. Which camp a
 * site becomes is a `spawnCamps` roll on the `campSetup` stream.
 * - `density` — the sites per board, a weighted choice.
 * - `placement` — the modes' weights, above.
 * - `spawnStandoff` — the least Chebyshev distance from every spawn-region
 *   tile, so a camp is a detour, not a doorstep.
 * - `pools` — the camps each theme's boards may roll, exhaustive over
 *   `Theme`. An empty pool turns camps off for the theme, but the density
 *   draw is still made, so the stream does not depend on the pool.
 */
const ProceduralCampsSchema = z.object({
  density: WeightedIntsSchema,
  placement: CampPlacementWeightsSchema,
  spawnStandoff: z.number().int().nonnegative(),
  pools: z.object(
    Object.fromEntries(THEMES.map((t) => [t, z.array(CampPoolEntrySchema).default([])])) as Record<
      Theme,
      z.ZodDefault<z.ZodArray<typeof CampPoolEntrySchema>>
    >,
  ),
});

/**
 * The procedural knobs, each sampled once per encounter.
 * `wallCapFraction` is fixed, not sampled: a hard ceiling on obstacle cells.
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
  windowChance: RangeSchema,
  poolDensity: RangeSchema,
  noiseScale: RangeSchema,
  wallCapFraction: z.number().min(0).max(1),
  /** Not a per-knob draw like the rest: the sector's theme picks one entry
   *  at generation time. */
  themeTiles: ThemeTilesTableSchema,
  camps: ProceduralCampsSchema,
});

const TerrainSchema = z
  .object({
    proceduralMinSize: z.number().int().min(LAYOUT_MIN_SIDE).max(LAYOUT_MAX_SIDE),
    proceduralMaxSize: z.number().int().min(LAYOUT_MIN_SIDE).max(LAYOUT_MAX_SIDE),
    procedural: ProceduralSchema,
  })
  .refine((c) => c.proceduralMinSize <= c.proceduralMaxSize, {
    message: 'proceduralMinSize must be <= proceduralMaxSize',
  });

export type TerrainConfig = z.infer<typeof TerrainSchema>;
export type ProceduralTerrainConfig = z.infer<typeof ProceduralSchema>;
export type ThemeTilesConfig = z.infer<typeof ThemeTilesSchema>;
/** The three camp-site placement modes. */
export type CampPlacementMode = 'pair' | 'midBand' | 'free';
export type RangeSpec = z.infer<typeof RangeSchema>;

export const TERRAIN: TerrainConfig = TerrainSchema.parse(terrainJson);
