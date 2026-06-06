/**
 * H7a — the linear scored-strategy weight vector: type, zod schema, and loaders.
 *
 * Mirrors the project's A4 config pattern (zod, validate-on-load, throw on
 * malformed) but lives with the fuzz tooling rather than `src/config` — these
 * weights are a dev-only knob the production game never reads, so keeping the
 * loader here keeps it out of the production bundle.
 *
 * The single-vector JSON at `config/fuzz-strategies.json` is BOTH the
 * `--strategy=<file>.json` CLI input format AND the format H7b's search emits as
 * its winner. The stats/archetype/path sub-schemas are built from the live
 * constants (`STAT_KEYS`, `ALL_ARCHETYPES`, `PATH_KINDS`), so adding a stat or
 * archetype auto-extends the schema and a missing/unknown key throws loudly.
 */

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import defaultWeightsJson from '../../../config/fuzz-strategies.json';
import type { UnitStats } from '../../../src/sim/Unit';
import { ALL_ARCHETYPES, type Archetype } from '../../../src/sim/archetypes';
import { STAT_KEYS, PATH_KINDS } from './policies';

export interface ScoredWeights {
  /** Per-`NodeKind` path weight (boss is the forced terminal — no weight). */
  readonly path: Record<(typeof PATH_KINDS)[number], number>;
  /** Flat per-archetype affinity (a constant pull, independent of the roster). */
  readonly archetype: Record<Archetype, number>;
  /** Per-archetype target *fraction* of the roster. Drives recruiting toward a
   *  composition: the recruit term adds `compWeight × (composition[A] −
   *  rosterFraction[A])`, which is positive while an archetype is under target
   *  (a count-0 archetype gets a foothold) and saturates toward 0 / negative as
   *  it fills — replacing the old `diversity × rosterCount` rich-get-richer term
   *  that could never seed a caster comp from a carry-heavy start. */
  readonly composition: Record<Archetype, number>;
  /** Scalar strength of the composition term (decouples *what* comp from *how
   *  much* the comp target matters vs raw stat/level quality). */
  readonly compWeight: number;
  /** Weight on normalized level. */
  readonly level: number;
  /** Weight per normalized stat (incl. `power`). */
  readonly stats: Record<keyof UnitStats, number>;
  /** Weight on normalized total stats (Σ stats). */
  readonly total: number;
  /** Added to the (bestCard − rosterAvg) continuous-score gap; the pass fires
   *  when the sum is < 0. Higher = recruit more readily; lower = pass more
   *  readily. */
  readonly passBias: number;
  /** OPTIONAL inert seam (H7 `selectByScore`). 0 = argmax. Default 0; not a
   *  search dimension this cycle. */
  readonly temperature?: number;
}

/** A strict zod object of `number` fields, one per supplied key — built from a
 *  live constant so the schema tracks the vocabulary automatically. */
function numberRecordSchema<K extends string>(keys: readonly K[]) {
  const shape = Object.fromEntries(keys.map((k) => [k, z.number()])) as Record<
    K,
    z.ZodNumber
  >;
  return z.strictObject(shape);
}

const WeightsSchema = z.strictObject({
  path: numberRecordSchema(PATH_KINDS),
  archetype: numberRecordSchema(ALL_ARCHETYPES),
  composition: numberRecordSchema(ALL_ARCHETYPES),
  compWeight: z.number(),
  level: z.number(),
  stats: numberRecordSchema(STAT_KEYS),
  total: z.number(),
  passBias: z.number(),
  temperature: z.number().optional(),
});

/** Validate an arbitrary parsed-JSON value into a `ScoredWeights`. Throws (zod)
 *  on any missing / extra / non-number field. */
export function parseWeights(input: unknown): ScoredWeights {
  return WeightsSchema.parse(input) as ScoredWeights;
}

/** Read + validate a weight vector from a JSON file path — for the
 *  `--strategy=<file>.json` CLI input and the search's emitted winner. */
export function loadWeightsFile(path: string): ScoredWeights {
  return parseWeights(JSON.parse(readFileSync(path, 'utf8')));
}

/** Serialize a weight vector to the canonical single-vector JSON (2-space
 *  indent, trailing newline) — the format `loadWeightsFile` reads back. */
export function serializeWeights(weights: ScoredWeights): string {
  return JSON.stringify(weights, null, 2) + '\n';
}

/** The default vector shipped at `config/fuzz-strategies.json`, validated at
 *  load. `--strategy=scored` uses this. */
export const DEFAULT_SCORED_WEIGHTS: ScoredWeights = parseWeights(defaultWeightsJson);
