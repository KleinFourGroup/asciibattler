/**
 * 48a — the reward-table registry. Source of truth at `config/rewards.json`
 * (the `config/daemons.json` pattern: parse at module load, throw on malformed
 * JSON; boot referential asserts self-wired below).
 *
 * A reward table is a WEIGHTED list of entries — `bits {min,max}` | `packet` |
 * `daemon` — sampled one-entry-proportional-to-weight (cluster-3-spec
 * §"Reward Tables"). Encounters reference tables BY NAME via their `rewards`
 * list of `{table, trigger}` refs (the seam typed here, consumed by
 * encounters.ts — import direction: encounters → rewards, never back, the
 * sectors.ts cycle-avoidance shape). The sampling engine itself is 48b
 * (`pickWeighted` off the dedicated reward streams, owned-daemon exclusion
 * upstream of the draw); this module is pure config.
 *
 * Entry semantics:
 * - `bits {min,max}` — rolled uniformly (integer, inclusive) on the dedicated
 *   bits stream at 48b; the rolled BASE settles through `Run.gainBits`, so
 *   the `bitsGain` fold + `bitsMultiplier` apply at the settle (the shape-lock
 *   rider: the DISPLAY derives from the same math — worklog §48).
 * - `daemon` — grants the named idol; daemons the run already owns filter out
 *   BEFORE sampling (48b), so authored tables may carry owned entries freely.
 *   Referential integrity boot-asserted here against the daemon catalog.
 * - `packet` — grants the named packet into the cache. Referential integrity
 *   boot-asserted against the 49a packet catalog (`assertRewardPacketRefs`
 *   below); ENGINE-dormant until 49c (rollRewards still excludes packet
 *   entries wholesale — the guard 49c removes).
 * - `unit` / `poolHealth` — 74c (the events-round widening): a roster grant
 *   (template pre-rolled at offer time) and a flat pool heal. See the
 *   interface comments below.
 *
 * Trigger vocabulary at launch: `chance` only — each ref independently tested
 * on encounter win. `trigger` is an OBJECT (not a bare number) so predicates
 * can join later without a migration (spec lock).
 */

import { z } from 'zod';
import rewardsJson from '../../config/rewards.json';
import { DAEMONS, type DaemonConfig } from './daemons';
import { PACKETS, type PacketConfig } from './packets';
import { UNIT_DEFS } from './units';

export const REWARD_ENTRY_KINDS = ['bits', 'packet', 'daemon', 'unit', 'poolHealth'] as const;
export type RewardEntryKind = (typeof REWARD_ENTRY_KINDS)[number];

/** A `{min,max}` bits roll (uniform, integer, inclusive). */
export interface BitsRewardEntry {
  readonly kind: 'bits';
  readonly weight: number;
  readonly min: number;
  readonly max: number;
}

/** A packet grant — the §49 seam, dormant at launch (see the header). */
export interface PacketRewardEntry {
  readonly kind: 'packet';
  readonly weight: number;
  readonly packet: string;
}

/** A daemon grant — owned ids are excluded upstream of sampling (48b). */
export interface DaemonRewardEntry {
  readonly kind: 'daemon';
  readonly weight: number;
  readonly daemon: string;
}

/** 74c — a roster grant: the archetype's template rolls at OFFER time on the
 *  reward-bits stream (the port-stock precedent — the portion carries the
 *  rolled `UnitTemplate`), `level` absent = 1. Duplicates legal; no
 *  exclusion (unlike daemons). Referential integrity boot-asserted against
 *  the unit catalog (`assertRewardUnitRefs`). */
export interface UnitRewardEntry {
  readonly kind: 'unit';
  readonly weight: number;
  readonly archetype: string;
  readonly level?: number;
}

/** 74c — a flat player-pool heal (clamped at max by the instant-op executor
 *  at settle time — the rest-node discipline). No RNG. */
export interface PoolHealthRewardEntry {
  readonly kind: 'poolHealth';
  readonly weight: number;
  readonly amount: number;
}

export type RewardEntry =
  | BitsRewardEntry
  | PacketRewardEntry
  | DaemonRewardEntry
  | UnitRewardEntry
  | PoolHealthRewardEntry;

export interface RewardTable {
  readonly id: string;
  readonly entries: readonly RewardEntry[];
}

/** The launch trigger vocabulary: `chance` only (spec lock — an object so
 *  predicates can extend it later). */
export interface RewardTrigger {
  readonly chance: number;
}

/** One `{table, trigger}` reference on an encounter (the 48a typed seam,
 *  replacing the reserved `rewards?: unknown`). */
export interface EncounterRewardRef {
  readonly table: string;
  readonly trigger: RewardTrigger;
}

const WeightSchema = z.number().positive();

const BitsEntrySchema = z.object({
  kind: z.literal('bits'),
  weight: WeightSchema,
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
});

const PacketEntrySchema = z.object({
  kind: z.literal('packet'),
  weight: WeightSchema,
  packet: z.string().min(1),
});

const DaemonEntrySchema = z.object({
  kind: z.literal('daemon'),
  weight: WeightSchema,
  daemon: z.string().min(1),
});

const UnitEntrySchema = z.object({
  kind: z.literal('unit'),
  weight: WeightSchema,
  archetype: z.string().min(1),
  level: z.number().int().positive().optional(), // absent = 1
});

const PoolHealthEntrySchema = z.object({
  kind: z.literal('poolHealth'),
  weight: WeightSchema,
  amount: z.number().int().positive(),
});

/** The min≤max check lives on the union, not the object: zod
 *  discriminatedUnion members must be plain ZodObjects (the RuleSchema
 *  precedent, daemons.ts). */
const RewardEntrySchema = z
  .discriminatedUnion('kind', [
    BitsEntrySchema,
    PacketEntrySchema,
    DaemonEntrySchema,
    UnitEntrySchema,
    PoolHealthEntrySchema,
  ])
  .superRefine((entry, ctx) => {
    if (entry.kind === 'bits' && entry.min > entry.max) {
      ctx.addIssue({
        code: 'custom',
        message: `bits entry: min (${entry.min}) must be <= max (${entry.max})`,
      });
    }
  }) as z.ZodType<RewardEntry>;

const RewardTableSchema = z.object({
  id: z.string().min(1),
  entries: z.array(RewardEntrySchema).min(1),
}) as z.ZodType<RewardTable>;

/** The whole-file schema (exported for schema tests + the 48e editor
 *  round-trip — the `EncountersSchema`/`DaemonsSchema` precedent). */
export const RewardTablesSchema = z
  .object({ tables: z.array(RewardTableSchema).min(1) })
  .refine((cfg) => new Set(cfg.tables.map((t) => t.id)).size === cfg.tables.length, {
    message: 'reward table ids must be unique',
  });

/** The encounter-side ref schema (consumed by EncounterSchema). Key order
 *  (table, trigger) is load-bearing for the formatter's byte-faithful
 *  round-trip — zod parse emits keys in shape order. */
export const EncounterRewardRefSchema = z.object({
  table: z.string().min(1),
  trigger: z.object({ chance: z.number().min(0).max(1) }),
}) as z.ZodType<EncounterRewardRef>;

const parsed = RewardTablesSchema.parse(rewardsJson);

export const REWARD_TABLES: readonly RewardTable[] = parsed.tables;
export const REWARD_TABLE_IDS: readonly string[] = REWARD_TABLES.map((t) => t.id);

/**
 * Boot check (the `assertDaemonStatusRefs` sibling): every daemon entry must
 * name an idol in the catalog — a typo'd id fails at startup, not silently at
 * 48b sample time. Args-injected for synthetic tests; self-wired below
 * (cycle-free: daemons.ts never imports this module).
 */
export function assertRewardDaemonRefs(
  tables: readonly RewardTable[],
  daemons: readonly DaemonConfig[],
): void {
  const ids = new Set(daemons.map((d) => d.id));
  for (const table of tables) {
    for (const entry of table.entries) {
      if (entry.kind === 'daemon' && !ids.has(entry.daemon)) {
        throw new Error(
          `reward table '${table.id}': daemon entry references unknown daemon id '${entry.daemon}'`,
        );
      }
    }
  }
}

assertRewardDaemonRefs(REWARD_TABLES, DAEMONS);

/**
 * 49a — the promised sibling: every packet entry must name a packet in the
 * catalog (import direction: rewards → packets, never back — the daemons
 * shape). Args-injected for synthetic tests; self-wired below.
 */
export function assertRewardPacketRefs(
  tables: readonly RewardTable[],
  packets: readonly PacketConfig[],
): void {
  const ids = new Set(packets.map((p) => p.id));
  for (const table of tables) {
    for (const entry of table.entries) {
      if (entry.kind === 'packet' && !ids.has(entry.packet)) {
        throw new Error(
          `reward table '${table.id}': packet entry references unknown packet id '${entry.packet}'`,
        );
      }
    }
  }
}

assertRewardPacketRefs(REWARD_TABLES, PACKETS);

/**
 * 74c — the unit sibling: every unit entry must name an archetype in the
 * combatant catalog (import direction: rewards → units, never back — and
 * the SAME key space `Run.grantUnit`'s rollUnit resolves against, since
 * sim/archetypes' CONFIGS === UNIT_DEFS). Args-injected for synthetic
 * tests; self-wired below.
 */
export function assertRewardUnitRefs(
  tables: readonly RewardTable[],
  archetypes: readonly string[],
): void {
  const ids = new Set(archetypes);
  for (const table of tables) {
    for (const entry of table.entries) {
      if (entry.kind === 'unit' && !ids.has(entry.archetype)) {
        throw new Error(
          `reward table '${table.id}': unit entry references unknown archetype '${entry.archetype}'`,
        );
      }
    }
  }
}

assertRewardUnitRefs(REWARD_TABLES, Object.keys(UNIT_DEFS));

/** Registry lookup by id (`undefined` on a miss — callers decide throw vs
 *  skip; the boot asserts make a miss unreachable for authored refs). */
export function rewardTableById(id: string): RewardTable | undefined {
  return REWARD_TABLES.find((t) => t.id === id);
}
