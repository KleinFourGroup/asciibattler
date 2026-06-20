/**
 * U3/V1 (Post-R "Encounter System" round): the **Encounter** schema — an authored
 * fight definition that REPLACES the random `rollEnemyWave`. An encounter is
 * *content + intrinsic eligibility* selected onto a battle node: it owns its name,
 * its enemy health pool, its `kind` + optional layout fit-filter, and a **wave
 * list** (the U2 grammar) describing the enemy team turn-by-turn.
 *
 * Source of truth at `config/encounters.json` — the **authored catalog**. V1
 * populates the launch set: **Brigands** (the faithful anchor that re-creates the
 * pre-V swarm — see [../run/encounters/brigands.test.ts](../run/encounters/brigands.test.ts)
 * for the balance-proof) plus the variants **Highwaymen** (pure bandit) and
 * **Deserters** (bandit + a healer). (U3 built Brigands in code reading live
 * config; V1 hoisted it to JSON with literal constants — the code reproduction was
 * retired. Per-encounter knobs are the tuning surface at Phase X.) V2 commit C
 * adds the grammar-demo encounters — **Artillery Company** (a looped 2-wave
 * sequence), **The Ronin and the Mages** (a per-turn weighted `pick`), and
 * **Guarded Adventurer** (a flat sequence: a finite `loop` of guards then a lone
 * boss wave) — exercising the U2 grammar's sequence / pick / finite-loop forms
 * (a `stages` boss demo waits for W). `Run` selects among the catalog via
 * [../run/encounters/selection.ts](../run/encounters/selection.ts).
 *
 * The `waves` grammar (`WaveList`) is the U2 type, validated here recursively
 * (`z.lazy`): a tree of wave / pick / loop / stages entries, nesting to any
 * depth. The pure resolvers ([wave.ts](../run/encounters/wave.ts) +
 * [sequencer.ts](../run/encounters/sequencer.ts)) own those types; this module
 * type-only-imports them and mirrors their shape as zod (so config validates
 * into exactly the type the sequencer consumes — no runtime config→run edge).
 *
 * Eligibility split (the pre-V data-model decision — sector-owns-both): the
 * **sector** owns *placement* — which encounters appear in it, with the per-entry
 * hop gate + roll weight — via its `encounters` POOL (mirroring its `layouts`
 * pool; see sectors.ts). An encounter owns only its *intrinsic* eligibility:
 * `kind` (which node kind it fits) and an optional `layouts?` FIT-FILTER (which
 * battlefields the fight makes sense on, intersected against the sector's layout
 * pool at selection — V). There is deliberately **no `sectors` or `minHop` field
 * on the encounter**: placement/pacing is a region concern, not a fight concern,
 * so it lives on the sector pool entry. (This reverses the config dependency —
 * `sectors.ts` now imports `ENCOUNTER_IDS`; `encounters.ts` no longer imports
 * `sectors.ts`, so there's no cycle.) Selection among many encounters is V.
 * `rewards?` is a reserved, unconsumed seam (the loot/economy round hangs here).
 * `kind` is an ENUM (not an `isBoss` bool) reserving `'elite'` for future elite
 * map-nodes.
 */

import { z } from 'zod';
import encountersJson from '../../config/encounters.json';
import { ARCHETYPES } from './archetypes';
import { LAYOUT_IDS } from './layouts';
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
 * An authored fight. `waves` is the U2 grammar; every catalog encounter produces
 * this shape.
 */
export interface Encounter {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** The encounter's enemy health pool (replaces the global HEALTH.enemyHealthMax
   *  for this fight). Fixed, not player-relative (pools aren't a roster scaling). */
  readonly healthPool: number;
  /** Intrinsic fit-filter: which battlefields this fight makes sense on,
   *  intersected against the current sector's layout pool at selection (V).
   *  Omitted = no constraint (the common case). Placement (which sectors, hop
   *  gate, weight) lives on the sector's encounter pool, not here. */
  readonly layouts?: readonly string[];
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
  layouts: z.array(z.string().min(1)).optional(),
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
  // The optional layout fit-filter must reference real layouts. (Placement refs —
  // which sectors this encounter is pooled in — are validated on the SECTOR side
  // now; see sectors.ts.) The catalog ships empty this round, so this binds once
  // V authors content.
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
