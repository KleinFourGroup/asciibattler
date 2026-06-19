/**
 * U3 (Post-R "Encounter System" round): the **Encounter** schema — an authored
 * fight definition that REPLACES the random `rollEnemyWave`. An encounter is
 * *eligibility + content* selected onto a battle node: it owns its name, its
 * enemy health pool, the sectors/hops/kinds it's eligible for, and a **wave
 * list** (the U2 grammar) describing the enemy team turn-by-turn.
 *
 * Source of truth at `config/encounters.json` — the **authored catalog**, which
 * ships EMPTY this round (V populates it via the encounter editor). The U3
 * "reproduction encounter" (the faithful bridge that re-creates today's swarm)
 * is **code-built** from live `DIFFICULTY`/`HEALTH`/`DECK`
 * ([../run/encounters/reproduction.ts](../run/encounters/reproduction.ts)), NOT
 * authored here — so it tracks the live balance config through Phase X's sweeps
 * rather than freezing a snapshot of it. The schema below validates BOTH shapes
 * (the catalog at load; the reproduction is the same `Encounter` type, built in
 * code).
 *
 * The `waves` grammar (`WaveList`) is the U2 type, validated here recursively
 * (`z.lazy`): a tree of wave / pick / loop / stages entries, nesting to any
 * depth. The pure resolvers ([wave.ts](../run/encounters/wave.ts) +
 * [sequencer.ts](../run/encounters/sequencer.ts)) own those types; this module
 * type-only-imports them and mirrors their shape as zod (so config validates
 * into exactly the type the sequencer consumes — no runtime config→run edge).
 *
 * Eligibility fields (`sectors`/`layouts?`/`minHop?`/`kind`) are unused for
 * SELECTION this round (U3 holds a single encounter; selection among many is V),
 * but validated now so the schema is born complete. `rewards?` is a reserved,
 * unconsumed seam (the loot/economy round hangs here). `kind` is an ENUM (not an
 * `isBoss` bool) reserving `'elite'` for future elite map-nodes.
 */

import { z } from 'zod';
import encountersJson from '../../config/encounters.json';
import { ARCHETYPES } from './archetypes';
import { LAYOUT_IDS } from './layouts';
import { SECTOR_IDS } from './sectors';
import type { Archetype } from '../sim/Unit';
import type {
  WaveSpec,
  LevelBudgetSpec,
  CountSpec,
  WaveUnitSpec,
} from '../run/encounters/wave';
import type {
  WaveEntry,
  WaveList,
  PickOption,
  Stage,
  Condition,
} from '../run/encounters/sequencer';

// --- archetype id validation (config→config; the Archetype TYPE is type-only) ---
const ARCHETYPE_IDS = new Set(Object.keys(ARCHETYPES));
const ArchetypeSchema = z.custom<Archetype>(
  (v) => typeof v === 'string' && ARCHETYPE_IDS.has(v),
  { message: 'unknown archetype' },
);

// --- wave spec (U1) --------------------------------------------------------

const LevelBudgetSchema: z.ZodType<LevelBudgetSpec> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), value: z.number().nonnegative() }),
  z.object({ kind: z.literal('mean'), factor: z.number().nonnegative() }),
  z.object({ kind: z.literal('median'), factor: z.number().nonnegative() }),
]);

const CountSchema: z.ZodType<CountSpec> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), value: z.number().nonnegative() }),
  z.object({ kind: z.literal('hand'), factor: z.number().nonnegative() }),
]);

const UnitCountSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), value: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('weight'), weight: z.number().nonnegative() }),
]);

const UnitLevelSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), value: z.number().int().positive() }),
  z.object({ kind: z.literal('weight'), weight: z.number().nonnegative() }),
]);

const WaveUnitSchema: z.ZodType<WaveUnitSpec> = z.object({
  archetype: ArchetypeSchema,
  count: UnitCountSchema,
  level: UnitLevelSchema,
});

const WaveSpecSchema: z.ZodType<WaveSpec> = z.object({
  levelBudget: LevelBudgetSchema,
  count: CountSchema,
  units: z.array(WaveUnitSchema).min(1),
});

// --- wave-list grammar (U2), recursive via z.lazy --------------------------

const ConditionSchema: z.ZodType<Condition> = z.object({
  kind: z.literal('enemyPoolAtOrBelow'),
  fraction: z.number().min(0).max(1),
});

const RepeatSchema = z.union([z.number().int().positive(), z.literal('forever')]);

// `z.lazy` defers the recursive references so the consts can cross-reference;
// the explicit `z.ZodType<…>` annotations are the documented recursive-schema
// pattern (zod can't infer a self-referential type on its own).
const WaveEntrySchema: z.ZodType<WaveEntry> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('wave'), spec: WaveSpecSchema }),
    z.object({ kind: z.literal('pick'), options: z.array(PickOptionSchema).min(1) }),
    z.object({ kind: z.literal('loop'), body: WaveListSchema, repeat: RepeatSchema }),
    z.object({ kind: z.literal('stages'), stages: z.array(StageSchema).min(1) }),
  ]),
);

const PickOptionSchema: z.ZodType<PickOption> = z.object({
  entry: z.lazy(() => WaveEntrySchema),
  weight: z.number().nonnegative(),
});

// Cast at the zod boundary: zod's `.optional()` emits `T | undefined`, which
// `exactOptionalPropertyTypes` won't accept against an exact-optional field. The
// runtime validation is identical; only the assignability nuance differs.
const StageSchema = z.object({
  until: ConditionSchema.optional(),
  body: z.lazy(() => WaveListSchema),
}) as z.ZodType<Stage>;

const WaveListSchema: z.ZodType<WaveList> = z.array(z.lazy(() => WaveEntrySchema)).min(1);

// --- the encounter ---------------------------------------------------------

/** Encounter `kind` — an ENUM, not an `isBoss` bool: reserves `'elite'` for the
 *  future elite map-node without a one-way-door migration. `boss` is the W kind. */
export const ENCOUNTER_KINDS = ['normal', 'elite', 'boss'] as const;
export type EncounterKind = (typeof ENCOUNTER_KINDS)[number];

/**
 * An authored fight. `waves` is the U2 grammar; the reproduction encounter and
 * the V catalog both produce this shape.
 */
export interface Encounter {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** The encounter's enemy health pool (replaces the global HEALTH.enemyHealthMax
   *  for this fight). Fixed, not player-relative (pools aren't a roster scaling). */
  readonly healthPool: number;
  /** Eligibility: which sectors this encounter can appear in (selection — V). */
  readonly sectors: readonly string[];
  /** Optional eligibility: which battlefields this fight fits (∩ sector pool). */
  readonly layouts?: readonly string[];
  /** Optional hop gate (eligible at `hop >= minHop`). */
  readonly minHop?: number;
  readonly kind: EncounterKind;
  /** Reserved, unconsumed seam — the loot/economy round (gold / recruit / relic). */
  readonly rewards?: unknown;
  readonly waves: WaveList;
}

const EncounterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  healthPool: z.number().int().positive(),
  sectors: z.array(z.string().min(1)).min(1),
  layouts: z.array(z.string().min(1)).optional(),
  minHop: z.number().int().nonnegative().optional(),
  kind: z.enum(ENCOUNTER_KINDS).default('normal'),
  rewards: z.unknown().optional(),
  waves: WaveListSchema,
  // Cast at the zod boundary (see StageSchema) — `.optional()` vs exact-optional.
}) as z.ZodType<Encounter>;

/** The whole-file array schema (exported for the V2 editor's formatter round-trip). */
export const EncountersSchema = z.array(EncounterSchema);

const ENCOUNTERS_LIST: readonly Encounter[] = EncountersSchema.parse(encountersJson);

const seenIds = new Set<string>();
for (const encounter of ENCOUNTERS_LIST) {
  if (seenIds.has(encounter.id)) {
    throw new Error(`encounters.json: duplicate encounter id "${encounter.id}"`);
  }
  seenIds.add(encounter.id);
  // Eligibility refs must resolve (mirrors the sector schema's layout guard). The
  // catalog ships empty this round, so these bind once V authors content.
  for (const sectorId of encounter.sectors) {
    if (!SECTOR_IDS.includes(sectorId)) {
      throw new Error(`encounters.json: encounter "${encounter.id}" references unknown sector "${sectorId}"`);
    }
  }
  for (const layoutId of encounter.layouts ?? []) {
    if (!LAYOUT_IDS.includes(layoutId)) {
      throw new Error(`encounters.json: encounter "${encounter.id}" references unknown layout "${layoutId}"`);
    }
  }
}

export const ENCOUNTERS: readonly Encounter[] = ENCOUNTERS_LIST;
export const ENCOUNTER_IDS: readonly string[] = ENCOUNTERS_LIST.map((e) => e.id);

const ENCOUNTERS_BY_ID: Record<string, Encounter> = {};
for (const encounter of ENCOUNTERS_LIST) ENCOUNTERS_BY_ID[encounter.id] = encounter;

export function getEncounter(id: string): Encounter | undefined {
  return ENCOUNTERS_BY_ID[id];
}
