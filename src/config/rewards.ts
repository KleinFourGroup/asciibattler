/**
 * The reward tables. Source of truth at `config/rewards.json`.
 *
 * A reward table is a weighted list of entries, sampled one entry in
 * proportion to weight. Encounters and camps name tables through their
 * `rewards` refs, `{table, trigger}`, typed here; encounters.ts imports this
 * module, never the reverse. The sampling is in `src/run/rewards.ts`, which
 * draws with `pickWeighted` on the reward streams and drops owned daemons
 * before the draw; this module is config only.
 *
 * - `bits` — `{min, max}`, rolled uniformly as an inclusive integer on the
 *   bits stream. The roll settles through `Run.gainBits`, so the `bitsGain`
 *   fold and `bitsMultiplier` apply there, and the display uses the same
 *   math.
 * - `daemon` — grants the named daemon. Daemons the run owns are dropped
 *   before sampling, so a table may list owned ones freely.
 * - `packet` — grants the named packet into the cache.
 * - `unit` — a roster grant (its interface, below).
 * - `poolHealth` — a flat heal to the player's pool (its interface, below).
 *
 * The only trigger is `chance`, each ref tested on its own. `trigger` is an
 * object, not a bare number, so a predicate can join it without a migration.
 *
 * Boot checks, below: every daemon, packet and unit entry names a real one.
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

/** A packet grant. */
export interface PacketRewardEntry {
  readonly kind: 'packet';
  readonly weight: number;
  readonly packet: string;
}

/** A daemon grant; owned ids are dropped before sampling. */
export interface DaemonRewardEntry {
  readonly kind: 'daemon';
  readonly weight: number;
  readonly daemon: string;
}

/** A roster grant. The archetype's template rolls when the reward is
 *  offered, on the reward-bits stream, as a port's stock does, and the
 *  portion carries the rolled `UnitTemplate`. `level` absent is 1.
 *  Duplicates are legal: nothing is excluded, as owned daemons are. */
export interface UnitRewardEntry {
  readonly kind: 'unit';
  readonly weight: number;
  readonly archetype: string;
  readonly level?: number;
}

/** A flat heal to the player's pool, capped at the maximum when the
 *  instant-op executor settles it, as a rest's heal is. It draws nothing. */
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

/** The trigger (see the header). */
export interface RewardTrigger {
  readonly chance: number;
}

/** One `{table, trigger}` ref on an encounter or a camp. */
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
  level: z.number().int().positive().optional(),
});

const PoolHealthEntrySchema = z.object({
  kind: z.literal('poolHealth'),
  weight: WeightSchema,
  amount: z.number().int().positive(),
});

/** The min ≤ max check is on the union, not the object, because a zod
 *  discriminatedUnion's members must be plain ZodObjects. */
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

/** The whole-file schema, exported for the schema tests and the reward
 *  editor's round trip. */
export const RewardTablesSchema = z
  .object({ tables: z.array(RewardTableSchema).min(1) })
  .refine((cfg) => new Set(cfg.tables.map((t) => t.id)).size === cfg.tables.length, {
    message: 'reward table ids must be unique',
  });

/** The ref schema encounters and camps use. Its key order (table, trigger)
 *  matters: zod emits keys in shape order, and the editors' formatter
 *  round-trips byte for byte. */
export const EncounterRewardRefSchema = z.object({
  table: z.string().min(1),
  trigger: z.object({ chance: z.number().min(0).max(1) }),
}) as z.ZodType<EncounterRewardRef>;

const parsed = RewardTablesSchema.parse(rewardsJson);

export const REWARD_TABLES: readonly RewardTable[] = parsed.tables;
export const REWARD_TABLE_IDS: readonly string[] = REWARD_TABLES.map((t) => t.id);

/**
 * Boot check: every daemon entry names a daemon in the catalog, so a typo
 * fails at startup and not when sampled. Its arguments let a test pass
 * synthetic catalogs, as do the two below; daemons.ts never imports this
 * module.
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
 * Boot check: every packet entry names a packet in the catalog; packets.ts
 * never imports this module.
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
 * Boot check: every unit entry names a combatant archetype, the keys
 * `Run.grantUnit` resolves against (sim/archetypes' `CONFIGS` is
 * `UNIT_DEFS`); units.ts never imports this module.
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

/** Lookup by id, `undefined` on a miss; the caller decides whether to throw
 *  or skip, and the boot checks make a miss unreachable for authored refs. */
export function rewardTableById(id: string): RewardTable | undefined {
  return REWARD_TABLES.find((t) => t.id === id);
}
