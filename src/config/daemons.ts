/**
 * The daemon catalog. Source of truth at `config/daemons.json`, parsed at
 * module load (malformed JSON throws).
 *
 * A daemon is a relic held for the run. Its `rules` are written in the
 * vocabulary daemons and packets share: a `modifier` folds into a run stat
 * (`src/run/runStats.ts`); a `hook` fires an effect op on a trigger, with an
 * optional `chance` and `filter`. Run triggers resolve on the Run (a
 * `turnStart` grant through `resolveTurnGrants`, `src/run/daemon.ts`);
 * battle triggers compile into the World as `battleRules`. Which trigger
 * may carry which op and filter is checked at parse time.
 *
 * Redraw and empower exist only through daemons: with no daemon whose
 * `turnStart` hook grants one, the pre-turn screen offers neither.
 */

import { z } from 'zod';
import { prose } from '../i18n/prose';
import { loadProse } from '../i18n/locale';
import daemonsJson from '../../config/daemons.json';
import { BuffSchema, normalizeBuff, type EmpowerConfig } from './empower';
import { RUN_STAT_KEYS, type RunStatKey } from '../run/runStats';
import { STATUS_DEFS } from './statuses';
import type { StatusDef } from '../sim/effects/statusSchema';

const ChanceSchema = z.number().min(0).max(1);

// ── The rule vocabulary ─────────────────────────────────────────────────────

/** Triggers resolved on the Run. */
export const RUN_TRIGGER_KEYS = ['turnStart', 'encounterStart', 'encounterEnd'] as const;
/** Triggers compiled into the World as `battleRules`, on the payloads of the
 *  sim's `TriggerDispatcher`. */
export const BATTLE_TRIGGER_KEYS = ['dealHit', 'kill'] as const;

export type RunTriggerKey = (typeof RUN_TRIGGER_KEYS)[number];
export type BattleTriggerKey = (typeof BATTLE_TRIGGER_KEYS)[number];
export type TriggerKey = RunTriggerKey | BattleTriggerKey;

/** Where a trigger fires. It decides which ops a hook on it may carry, and
 *  which hooks compile into the World. */
export const TRIGGER_DOMAIN = {
  turnStart: 'run',
  encounterStart: 'run',
  encounterEnd: 'run',
  dealHit: 'battle',
  kill: 'battle',
} as const satisfies Record<TriggerKey, 'run' | 'battle'>;

/** Where each op's effect lands. `gainBits` is `'both'`: on a run trigger
 *  it grants at once; on a battle trigger it adds to a tally the World
 *  stores and settles at the battle's end, as XP does. */
const OP_DOMAIN = {
  grantRedraws: 'run',
  grantEmpowers: 'run',
  gainBits: 'both',
  healPool: 'run',
  applyStatus: 'battle',
} as const;

/** Daemons and packets share one pool of effect ops, so each op's schema is
 *  defined here once and exported where `packets.ts` reuses it. Imports go
 *  from packets to daemons, never back. */
export const GrantRedrawsOpSchema = z.object({
  op: z.literal('grantRedraws'),
  redrawsPerTurn: z.number().int().nonnegative(),
  maxCardsPerTurn: z.number().int().nonnegative(),
});

const GrantEmpowersOpSchema = z.object({
  op: z.literal('grantEmpowers'),
  empowersPerTurn: z.number().int().nonnegative(),
  buff: BuffSchema,
});

export const GainBitsOpSchema = z.object({
  op: z.literal('gainBits'),
  amount: z.number().int().positive(),
});

export const HealPoolOpSchema = z.object({
  op: z.literal('healPool'),
  amount: z.number().int().positive(),
});

export const ApplyStatusOpSchema = z.object({
  op: z.literal('applyStatus'),
  statusId: z.string().min(1),
  magnitude: z.number().positive().optional(),
  durationSeconds: z.number().positive().optional(),
  /** Where the status lands: absent or `'actor'`, on the striker or killer;
   *  `'target'`, on the struck unit, legal on `dealHit` only, since a
   *  `kill`'s victim is dead (checked here and in `packets.ts`). */
  applyTo: z.enum(['actor', 'target']).optional(),
});

const EffectOpSchema = z.discriminatedUnion('op', [
  GrantRedrawsOpSchema,
  GrantEmpowersOpSchema,
  GainBitsOpSchema,
  HealPoolOpSchema,
  ApplyStatusOpSchema,
]);

const RuleFilterSchema = z.object({
  archetype: z.string().min(1).optional(),
  crit: z.boolean().optional(),
  won: z.boolean().optional(),
});

const ModifierRuleSchema = z.object({
  kind: z.literal('modifier'),
  stat: z.enum(RUN_STAT_KEYS),
  op: z.enum(['add', 'mult']),
  value: z.number(),
});

const HookRuleObjectSchema = z.object({
  kind: z.literal('hook'),
  on: z.enum([...RUN_TRIGGER_KEYS, ...BATTLE_TRIGGER_KEYS]),
  chance: ChanceSchema.optional(),
  filter: RuleFilterSchema.optional(),
  effect: EffectOpSchema,
});

/** Which trigger may carry which op and filter, checked at parse time. It
 *  sits on the union and not the hook object because a member of a zod
 *  `discriminatedUnion` must be a plain object schema. */
const RuleSchema = z
  .discriminatedUnion('kind', [ModifierRuleSchema, HookRuleObjectSchema])
  .superRefine((rule, ctx) => {
    if (rule.kind !== 'hook') return;
    const triggerDomain = TRIGGER_DOMAIN[rule.on];
    const opDomain = OP_DOMAIN[rule.effect.op];
    if (opDomain !== 'both' && opDomain !== triggerDomain) {
      ctx.addIssue({
        code: 'custom',
        message: `op '${rule.effect.op}' (${opDomain}-domain) cannot fire on ${triggerDomain}-domain trigger '${rule.on}'`,
      });
    }
    if (
      rule.effect.op === 'applyStatus' &&
      rule.effect.applyTo === 'target' &&
      rule.on !== 'dealHit'
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `applyTo 'target' is only carried by 'dealHit' (a '${rule.on}' firing has no living target)`,
      });
    }
    if (
      (rule.effect.op === 'grantRedraws' || rule.effect.op === 'grantEmpowers') &&
      rule.on !== 'turnStart'
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `'${rule.effect.op}' grants a per-turn budget — it must fire on 'turnStart', not '${rule.on}'`,
      });
    }
    if (rule.filter !== undefined) {
      if (rule.filter.crit !== undefined && rule.on !== 'dealHit') {
        ctx.addIssue({
          code: 'custom',
          message: `filter 'crit' is only carried by 'dealHit' (trigger '${rule.on}' has no crit flag)`,
        });
      }
      if (rule.filter.archetype !== undefined && triggerDomain !== 'battle') {
        ctx.addIssue({
          code: 'custom',
          message: `filter 'archetype' names an acting battle unit — illegal on run trigger '${rule.on}'`,
        });
      }
      if (rule.filter.won !== undefined && rule.on !== 'encounterEnd') {
        ctx.addIssue({
          code: 'custom',
          message: `filter 'won' is only known at 'encounterEnd', not '${rule.on}'`,
        });
      }
    }
  });

const DaemonSchema = z.object({
  id: z.string().min(1),
  name: prose(),
  description: prose(),
  rules: z.array(RuleSchema).optional(),
});

/** Exported for the schema tests. */
export const DaemonsSchema = z
  .object({ daemons: z.array(DaemonSchema).min(1) })
  .refine(
    (cfg) => new Set(cfg.daemons.map((d) => d.id)).size === cfg.daemons.length,
    { message: 'daemon ids must be unique' },
  );

/** A hook's optional condition; each key is checked against the trigger at
 *  parse time (`RuleSchema`). */
export interface RuleFilter {
  archetype?: string;
  crit?: boolean;
  won?: boolean;
}

/** The effect ops daemons and packets share: a daemon delivers them on its
 *  triggers, a packet when the player uses it on a target. */
export type EffectOp =
  | { op: 'grantRedraws'; redrawsPerTurn: number; maxCardsPerTurn: number }
  | { op: 'grantEmpowers'; empowersPerTurn: number; buff: EmpowerConfig['buff'] }
  | { op: 'gainBits'; amount: number }
  | { op: 'healPool'; amount: number }
  | {
      op: 'applyStatus';
      statusId: string;
      magnitude?: number;
      durationSeconds?: number;
      applyTo?: 'actor' | 'target';
    };

/** A passive change to a run stat, folded by `foldRunStats`. */
export interface ModifierRule {
  kind: 'modifier';
  stat: RunStatKey;
  op: 'add' | 'mult';
  value: number;
}

/** An effect op fired on a trigger. Without `chance`, or at 1, it fires
 *  every time and draws nothing; below 1 it draws once per firing. */
export interface HookRule {
  kind: 'hook';
  on: TriggerKey;
  chance?: number;
  filter?: RuleFilter;
  effect: EffectOp;
}

export type Rule = ModifierRule | HookRule;

export interface DaemonConfig {
  id: string;
  name: string;
  description: string;
  /** Absent: a daemon with no effect. */
  rules?: readonly Rule[];
}

const parsed = DaemonsSchema.parse(daemonsJson);
// `name` and `description` are prose, resolved on the raw list before
// `normalizeDaemon` copies the fields (addresses `daemons.<id>.…`).
export const DAEMONS_PROSE = loadProse('daemons', z.array(DaemonSchema), parsed.daemons);

type RawDaemon = (typeof parsed.daemons)[number];
type RawRule = NonNullable<RawDaemon['rules']>[number];

function normalizeEffectOp(raw: Extract<RawRule, { kind: 'hook' }>['effect']): EffectOp {
  switch (raw.op) {
    case 'grantRedraws':
      return {
        op: 'grantRedraws',
        redrawsPerTurn: raw.redrawsPerTurn,
        maxCardsPerTurn: raw.maxCardsPerTurn,
      };
    case 'grantEmpowers':
      return {
        op: 'grantEmpowers',
        empowersPerTurn: raw.empowersPerTurn,
        buff: normalizeBuff(raw.buff),
      };
    case 'gainBits':
      return { op: 'gainBits', amount: raw.amount };
    case 'healPool':
      return { op: 'healPool', amount: raw.amount };
    case 'applyStatus': {
      const op: EffectOp = { op: 'applyStatus', statusId: raw.statusId };
      if (raw.magnitude !== undefined) op.magnitude = raw.magnitude;
      if (raw.durationSeconds !== undefined) op.durationSeconds = raw.durationSeconds;
      if (raw.applyTo !== undefined) op.applyTo = raw.applyTo;
      return op;
    }
  }
}

function normalizeRule(raw: RawRule): Rule {
  if (raw.kind === 'modifier') {
    return { kind: 'modifier', stat: raw.stat, op: raw.op, value: raw.value };
  }
  const hook: HookRule = { kind: 'hook', on: raw.on, effect: normalizeEffectOp(raw.effect) };
  if (raw.chance !== undefined) hook.chance = raw.chance;
  if (raw.filter !== undefined) {
    const filter: RuleFilter = {};
    if (raw.filter.archetype !== undefined) filter.archetype = raw.filter.archetype;
    if (raw.filter.crit !== undefined) filter.crit = raw.filter.crit;
    if (raw.filter.won !== undefined) filter.won = raw.filter.won;
    hook.filter = filter;
  }
  return hook;
}

/** Builds exact-optional objects (no key set to `undefined`) from the parse.
 *  Exported for the schema tests. */
export function normalizeDaemon(raw: RawDaemon): DaemonConfig {
  const daemon: DaemonConfig = {
    id: raw.id,
    name: raw.name,
    description: raw.description,
  };
  if (raw.rules !== undefined) {
    daemon.rules = raw.rules.map(normalizeRule);
  }
  return daemon;
}

export const DAEMONS: readonly DaemonConfig[] = parsed.daemons.map(normalizeDaemon);

/**
 * A boot check: every `applyStatus` op in a daemon's rules names a status in
 * the registry, so a mistyped `statusId` fails at startup and not when the
 * battle rules compile. The catalogs are arguments so tests can pass their
 * own; it runs below on the real ones (`statuses.ts` never imports this
 * module, so there is no cycle).
 */
export function assertDaemonStatusRefs(
  daemons: readonly DaemonConfig[],
  statusDefs: Record<string, StatusDef>,
): void {
  for (const daemon of daemons) {
    for (const rule of daemon.rules ?? []) {
      if (rule.kind === 'hook' && rule.effect.op === 'applyStatus') {
        if (!(rule.effect.statusId in statusDefs)) {
          throw new Error(
            `daemon '${daemon.id}': applyStatus references unknown status id '${rule.effect.statusId}'`,
          );
        }
      }
    }
  }
}

assertDaemonStatusRefs(DAEMONS, STATUS_DEFS);

/** Catalog lookup by id (`undefined` on a miss — callers decide throw vs skip). */
export function daemonById(id: string): DaemonConfig | undefined {
  return DAEMONS.find((d) => d.id === id);
}
