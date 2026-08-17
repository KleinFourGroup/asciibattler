/**
 * Terrain knobs (C1a + D3 + M6 + §81a). The per-encounter generator
 * (`src/sim/terrainGen.ts`) uses these to drive the procedural map build
 * and to bound the procedural side-length roll. Source of truth at
 * `config/terrain.json`. (The C1a legacy uniform-scatter knobs
 * `wallDensity` / `shallowWaterDensity` / `ensureConnectivity` were
 * removed at §81a — the M6 generator owns its own obstacle budget +
 * connectivity guard.)
 *
 * **M6 — the `procedural` block** is the sampling surface for the
 * reworked generator (crossbar + divider + noise blend). Rather than
 * fixed values, each knob declares a RANGE (`{min,max}`, optionally
 * biased toward a `center` by an `intensity`) or a WEIGHTED choice over
 * discrete values; the generator samples one concrete value per knob per
 * encounter (`sampleProceduralParams`, `src/sim/proceduralMap.ts`), so
 * maps vary seed-to-seed within the designer-set envelope. See
 * `src/core/sampling.ts` for the `sampleRange` / `weightedPick` math.
 * §81a adds the per-theme `themeTiles` envelope (the §37 tile parity).
 *
 * **D3 — variable map sizes.** Procedural encounters roll a side length
 * uniformly in `[proceduralMinSize, proceduralMaxSize]` (square; the
 * range is bounded by the editor / TileGrid clamps in
 * `src/config/layouts.ts`). Hand-authored layouts declare their own
 * `gridW` × `gridH` on each layout.
 */

import { z } from 'zod';
import terrainJson from '../../config/terrain.json';
import { LAYOUT_MIN_SIDE, LAYOUT_MAX_SIDE, THEMES, type Theme } from './layouts';

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
/**
 * §81a — one theme's tile envelope for the procedural generator. Every knob is
 * an OPTIONAL range: absent = the feature is off for this theme AND consumes no
 * RNG draw (so a theme's draw count is fixed by which keys it declares — see
 * `sampleProceduralParams`'s fixed sampling order). Knob semantics:
 *   - `poolDensity` — per-theme OVERRIDE of the global `poolDensity` band
 *     (deserts keep sparse oases instead of grassland-grade pools);
 *   - `deepWaterFraction` — the fraction of the pool band that deepens to
 *     impassable `deep_water` (deepest-noise-first, so deep centres stay
 *     wrapped in shallow); fords/carves are never deepened;
 *   - `hills` / `ice` / `sand` / `mud` — ground-patch densities, each drawn on
 *     its own value-noise field (board fraction claimed, floor cells only);
 *   - `fire` — per-floor-cell sparse scatter chance (volcanic's signed revert;
 *     never on chokepoints, so the crossing stays free).
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
 * §81a — the per-theme tile table, exhaustive over the `Theme` union (the
 * sectors.ts `Record<EncounterKind, …>` pattern): a new theme is forced to
 * declare its tile envelope (possibly `{}` = plain boards) before the config
 * parses.
 */
const ThemeTilesTableSchema = z.object(
  Object.fromEntries(THEMES.map((t) => [t, ThemeTilesSchema])) as Record<
    Theme,
    typeof ThemeTilesSchema
  >,
);

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
  /** §81a — the per-theme tile envelope (procedural parity with the §37
   *  hand-authored tiles). Not a per-knob draw like the rest of this block —
   *  the active sector's THEME picks one entry at generation time. */
  themeTiles: ThemeTilesTableSchema,
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
export type RangeSpec = z.infer<typeof RangeSchema>;

export const TERRAIN: TerrainConfig = TerrainSchema.parse(terrainJson);
