/**
 * The encounter catalog: the authored fights. Source of truth at
 * `config/encounters.json`. An encounter is a fight's content and its own
 * eligibility: its name, its enemy pool, its `kind`, an optional layout
 * fit-filter, and a wave list describing the enemy team turn by turn. `Run`
 * selects among the catalog through `src/run/encounters/selection.ts`.
 *
 * The `waves` grammar (`WaveList`) is validated here recursively (`z.lazy`):
 * a tree of wave, pick, loop and stages entries, nesting to any depth. The
 * pure resolvers (`src/run/encounters/wave.ts` and `sequencer.ts`) own the
 * types; this module imports them as types only and mirrors them in zod, so
 * the config parses into exactly what the sequencer consumes, with no
 * runtime edge from config to run.
 *
 * Eligibility is split. The sector owns placement: which encounters appear in
 * it, each with a hop gate and a roll weight, through its `encounters` pool
 * (sectors.ts). An encounter owns only what is intrinsic: its `kind` (the node
 * kind it fits) and an optional `layouts` fit-filter. It has no `sectors` or
 * `minHop` field, since placement is the region's concern, and so sectors.ts
 * imports this module and not the reverse. `rewards` lists `{table, trigger}`
 * refs to the reward tables (rewards.ts), each ref's chance tested on its own
 * when the encounter is won.
 */

import { z } from 'zod';
import { prose } from '../i18n/prose';
import { loadProse } from '../i18n/locale';
import encountersJson from '../../config/encounters.json';
import { UNIT_DEFS } from './units';
import { LAYOUT_IDS } from './layouts';
import {
  EncounterRewardRefSchema,
  REWARD_TABLE_IDS,
  type EncounterRewardRef,
} from './rewards';
import type { Archetype } from '../sim/Unit';
import type {
  WaveSpec,
  LevelBudgetSpec,
  CountSpec,
  LevelCapSpec,
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
const ARCHETYPE_IDS = new Set(Object.keys(UNIT_DEFS));
const ArchetypeSchema = z.custom<Archetype>(
  (v) => typeof v === 'string' && ARCHETYPE_IDS.has(v),
  { message: 'unknown archetype' },
);

// --- the wave spec ---------------------------------------------------------

const LevelBudgetSchema: z.ZodType<LevelBudgetSpec> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), value: z.number().nonnegative() }),
  z.object({ kind: z.literal('mean'), factor: z.number().nonnegative() }),
  z.object({ kind: z.literal('median'), factor: z.number().nonnegative() }),
]);

const CountSchema: z.ZodType<CountSpec> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), value: z.number().nonnegative() }),
  z.object({ kind: z.literal('hand'), factor: z.number().nonnegative() }),
]);

// An optional level ceiling per wave; absent, the wave is uncapped, so what is
// authored is what is fielded. `roster` is the highest roster level plus
// `delta`; `fixed` is an absolute ceiling.
const LevelCapSchema: z.ZodType<LevelCapSpec> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('roster'), delta: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('fixed'), value: z.number().int().positive() }),
]);

const UnitCountSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), value: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('weight'), weight: z.number().nonnegative() }),
]);

const UnitLevelSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), value: z.number().int().positive() }),
  z.object({ kind: z.literal('weight'), weight: z.number().nonnegative() }),
]);

// `power` overrides the entry's headcount weight under the casualty rule, a
// lever per encounter; absent, the archetype's table power. Cast at the zod
// boundary, as `levelCap` is.
const WaveUnitSchema = z.object({
  archetype: ArchetypeSchema,
  count: UnitCountSchema,
  level: UnitLevelSchema,
  power: z.number().nonnegative().optional(),
}) as z.ZodType<WaveUnitSpec>;

// Cast at the zod boundary for the exact-optional `levelCap` (see StageSchema).
const WaveSpecSchema = z.object({
  levelBudget: LevelBudgetSchema,
  count: CountSchema,
  levelCap: LevelCapSchema.optional(),
  units: z.array(WaveUnitSchema).min(1),
}) as z.ZodType<WaveSpec>;

// --- the wave-list grammar, recursive through z.lazy -----------------------

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

/** An encounter's kind: the node kind it fits (`encounterKindFor`). */
export const ENCOUNTER_KINDS = ['normal', 'elite', 'boss'] as const;
export type EncounterKind = (typeof ENCOUNTER_KINDS)[number];

/** An authored fight. */
export interface Encounter {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** The enemy pool, in place of `HEALTH.enemyHealthMax` for this fight.
   *  Fixed, not scaled to the player. */
  readonly healthPool: number;
  /** The fit-filter: the battlefields this fight makes sense on, intersected
   *  with the sector's layout pool at selection. Omitted, no constraint. */
  readonly layouts?: readonly string[];
  readonly kind: EncounterKind;
  /** Reward refs: each `{table, trigger}` is chance-tested on its own when
   *  the encounter is won, and its table sampled. Omitted, no rewards. */
  readonly rewards?: readonly EncounterRewardRef[];
  readonly waves: WaveList;
}

const EncounterSchema = z.object({
  id: z.string().min(1),
  name: prose(),
  description: z.string().min(1).optional(),
  healthPool: z.number().int().positive(),
  layouts: z.array(z.string().min(1)).optional(),
  kind: z.enum(ENCOUNTER_KINDS).default('normal'),
  rewards: z.array(EncounterRewardRefSchema).optional(),
  waves: WaveListSchema,
  // Cast at the zod boundary (see StageSchema).
}) as z.ZodType<Encounter>;

/** The whole-file schema, exported for the encounter editor's round trip. */
export const EncountersSchema = z.array(EncounterSchema);

const ENCOUNTERS_LIST: readonly Encounter[] = EncountersSchema.parse(encountersJson);
// `name` is prose; `description` is editor metadata, never shown, and stays plain.
export const ENCOUNTERS_PROSE = loadProse('encounters', EncountersSchema, ENCOUNTERS_LIST);

const seenIds = new Set<string>();
for (const encounter of ENCOUNTERS_LIST) {
  if (seenIds.has(encounter.id)) {
    throw new Error(`encounters.json: duplicate encounter id "${encounter.id}"`);
  }
  seenIds.add(encounter.id);
  // The fit-filter must name real layouts. Placement refs are checked on the
  // sector side (sectors.ts).
  for (const layoutId of encounter.layouts ?? []) {
    if (!LAYOUT_IDS.includes(layoutId)) {
      throw new Error(`encounters.json: encounter "${encounter.id}" references unknown layout "${layoutId}"`);
    }
  }
}

/**
 * Boot check: every reward ref names a table in the registry. Its arguments
 * let a test pass synthetic catalogs; it runs below on the real ones.
 */
export function assertEncounterRewardRefs(
  encounters: readonly Encounter[],
  tableIds: readonly string[],
): void {
  const ids = new Set(tableIds);
  for (const encounter of encounters) {
    for (const ref of encounter.rewards ?? []) {
      if (!ids.has(ref.table)) {
        throw new Error(
          `encounters.json: encounter "${encounter.id}" references unknown reward table "${ref.table}"`,
        );
      }
    }
  }
}

assertEncounterRewardRefs(ENCOUNTERS_LIST, REWARD_TABLE_IDS);

export const ENCOUNTERS: readonly Encounter[] = ENCOUNTERS_LIST;
export const ENCOUNTER_IDS: readonly string[] = ENCOUNTERS_LIST.map((e) => e.id);

const ENCOUNTERS_BY_ID: Record<string, Encounter> = {};
for (const encounter of ENCOUNTERS_LIST) ENCOUNTERS_BY_ID[encounter.id] = encounter;

export function getEncounter(id: string): Encounter | undefined {
  return ENCOUNTERS_BY_ID[id];
}
