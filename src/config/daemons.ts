/**
 * L1→47c — the daemon catalog. Source of truth at `config/daemons.json`.
 * Mirrors the `config/empower.json` pattern (parse at module load, throw on
 * malformed JSON).
 *
 * A daemon is a run-scoped relic carrying `rules: Rule[]` — the shared
 * daemon/packet effect vocabulary (cluster-3-spec §"The rule vocabulary"):
 * `modifier` (a passive fold onto a run stat, `src/run/runStats.ts`) or
 * `hook` (an EffectOp fired on a trigger, with an optional `chance` +
 * `filter`). Triggers split by DOMAIN: run-lifecycle triggers resolve on the
 * Run (`turnStart` grant hooks → `resolveTurnGrants`, src/run/daemon.ts);
 * battle triggers compile into the World as `battleRules[]` (47f). The legal
 * (trigger × op × filter) matrix is enforced at parse time.
 *
 * The daemon-only-gates model (user-locked, Phase L) survives the 47c
 * re-authoring: without a daemon whose `turnStart` hook grants it, pre-turn
 * redraw/empower simply isn't available. A hook's `chance` is the
 * generalized "X% per turn" condition — absent/`1` = fires every time (no
 * RNG draw), `0 < chance < 1` = a per-firing flip off `Run.daemonRng`.
 *
 * The first catalog (the Phase-L design round, 2026-06-12) is four idols —
 * Roman-statue flavor in the terminal frame, the synthwave blend:
 * - Mars    — empower, the K4 universal-offense +4 STR/RNG/MAG, 1/turn.
 * - Minerva — empower, +2 DEF, 1/turn (flat mitigation — the tank identity).
 * - Mercury — 50%/turn coin flip for the FULL standard redraw.
 * - Janus   — guaranteed redraw every turn, capped at 2 cards (the
 *             reliable-but-small face opposite Mercury's all-or-nothing).
 */

import { z } from 'zod';
import daemonsJson from '../../config/daemons.json';
import { BuffSchema, normalizeBuff, type EmpowerConfig } from './empower';
import { RUN_STAT_KEYS, type RunStatKey } from '../run/runStats';
import { STATUS_DEFS } from './statuses';
import type { StatusDef } from '../sim/effects/statusSchema';

const ChanceSchema = z.number().min(0).max(1);

// ── 47b: the rule vocabulary ────────────────────────────────────────────────

/** Run-lifecycle triggers — resolved on the Run (47c). */
export const RUN_TRIGGER_KEYS = ['turnStart', 'encounterStart', 'encounterEnd'] as const;
/** Battle-sim triggers — compiled into the World as `battleRules[]` (47f);
 *  these ride the existing sim TriggerDispatcher payloads. */
export const BATTLE_TRIGGER_KEYS = ['dealHit', 'kill'] as const;

export type RunTriggerKey = (typeof RUN_TRIGGER_KEYS)[number];
export type BattleTriggerKey = (typeof BATTLE_TRIGGER_KEYS)[number];
export type TriggerKey = RunTriggerKey | BattleTriggerKey;

/** Which domain a trigger fires in (drives the op-compatibility matrix and,
 *  at 47f, which hooks compile into the World). */
export const TRIGGER_DOMAIN = {
  turnStart: 'run',
  encounterStart: 'run',
  encounterEnd: 'run',
  dealHit: 'battle',
  kill: 'battle',
} as const satisfies Record<TriggerKey, 'run' | 'battle'>;

/** Where each op's effect lands. `gainBits` is 'both': on a run trigger it
 *  grants directly; on a battle trigger it accumulates in the World's
 *  serialized tally and settles at battle end (the XP pattern, 47f). */
const OP_DOMAIN = {
  grantRedraws: 'run',
  grantEmpowers: 'run',
  gainBits: 'both',
  healPool: 'run',
  applyStatus: 'battle',
} as const;

/** The op sub-schemas are EXPORTED where §49 packets reuse them — daemons
 *  and packets share ONE effect-op pool (the spec's rule-vocabulary lock),
 *  so an op's shape is defined once, here, and imported by packets.ts
 *  (import direction: packets → daemons, never back). */
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
  chance: ChanceSchema.optional(), // absent = 1 (fires every trigger, no draw)
  filter: RuleFilterSchema.optional(),
  effect: EffectOpSchema,
});

/** The (trigger × op × filter) legality matrix — parse-time authoring guard.
 *  (Lives on the union, not the hook object: zod discriminatedUnion members
 *  must be plain ZodObjects.) */
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
  name: z.string().min(1),
  description: z.string().min(1),
  rules: z.array(RuleSchema).optional(), // absent = an inert daemon (legal, rule-less)
});

/** Exported for schema tests (the `EncountersSchema` precedent). */
export const DaemonsSchema = z
  .object({ daemons: z.array(DaemonSchema).min(1) })
  .refine(
    (cfg) => new Set(cfg.daemons.map((d) => d.id)).size === cfg.daemons.length,
    { message: 'daemon ids must be unique' },
  );

/** A hook's optional predicate — every key legality-checked against the
 *  trigger at parse time (the matrix in `RuleSchema`). */
export interface RuleFilter {
  archetype?: string;
  crit?: boolean;
  won?: boolean;
}

/** The shared effect-op pool (daemons deliver these passively; §49 packets
 *  deliver the same ops actively at a target). Launch set — content-driven. */
export type EffectOp =
  | { op: 'grantRedraws'; redrawsPerTurn: number; maxCardsPerTurn: number }
  | { op: 'grantEmpowers'; empowersPerTurn: number; buff: EmpowerConfig['buff'] }
  | { op: 'gainBits'; amount: number }
  | { op: 'healPool'; amount: number }
  | { op: 'applyStatus'; statusId: string; magnitude?: number; durationSeconds?: number };

/** A passive fold onto a run stat (`foldRunStats` consumes these, 47c). */
export interface ModifierRule {
  kind: 'modifier';
  stat: RunStatKey;
  op: 'add' | 'mult';
  value: number;
}

/** An EffectOp fired on a trigger. `chance` absent = 1 (no RNG draw — the
 *  gate-`chance` discipline); `0 < chance < 1` draws once per firing. */
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
  /** The rule vocabulary (47b/47c). Absent = an inert daemon. */
  rules?: readonly Rule[];
}

const parsed = DaemonsSchema.parse(daemonsJson);

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

/** Build exact-optional objects (no explicit-`undefined` keys) from the parse.
 *  Exported for schema tests + the future economy editor. */
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
 * Boot check (the `assertStatusRefsResolve` sibling): every `applyStatus` op
 * in a daemon's rules must name a status in the registry — a typo'd
 * `statusId` fails at startup, not silently at 47f compile time. Args-injected
 * for synthetic tests; self-wired below with the real catalogs (cycle-free:
 * `statuses.ts` never imports this module). Vacuous until content authors an
 * `applyStatus` rule.
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
