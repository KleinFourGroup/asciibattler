/**
 * 49a — the packet catalog. Source of truth at `config/packets.json` (the
 * `config/daemons.json` pattern: parse at module load, throw on malformed
 * JSON; boot referential asserts self-wired below).
 *
 * A packet is a one-shot consumable delivering ONE effect op at a target
 * (cluster-3-spec §Packets): daemons and packets share one effect-op pool —
 * a daemon delivers ops passively on triggers, a packet delivers them
 * actively when the player fires it. Fires consume immediately and
 * irrevocably (the §49 kickoff lock — order of consumption IS order of
 * effect; no batching, no undo). The cache (§49b) holds packet IDS; defs
 * resolve at read time (the daemons-by-id / def-resolved-status pattern).
 *
 * The launch op pool (content-driven, grown when content demands):
 * - `applyBuff`     — the empower generalization: a buff (the shared
 *                     `BuffSchema` shape) lands on the TARGET unit's roster
 *                     slot via the K1 encounter-effect store. Pre-turn the
 *                     target is a hand card; out-of-battle a roster unit
 *                     (the buff then rides the NEXT encounter — 49e owns
 *                     the reset-ordering detail, worklog §49).
 * - `grantRedraws`  — pushes a redraw grant into THIS turn's grant queue
 *                     (§49d); the normal redraw flow handles card selection,
 *                     so the packet's own target is 'none'.
 * - `injectRule`    — the battle-scoped rule injection: the rule (the sim's
 *                     `BattleRule` shape exactly — that's the compile
 *                     target) joins the World's `battleRules[]` for the
 *                     authored duration. THE battle-wide delivery: launch
 *                     battle-wide packets are rule-shaped (no `battleStart`
 *                     trigger exists — kickoff audit finding #1).
 * - `healPool`      — instant run-domain heal (the daemon op, fired
 *                     actively).
 *
 * The (op × target × context) legality matrix is enforced at parse time
 * (the 47b `RuleSchema` discipline) and EXPORTED (`PACKET_OP_TARGET` /
 * `PACKET_OP_CONTEXTS`) so the §49e engine validation and the §49g editor
 * read the same source. Dormant seams, deliberate: the `midBattle` context
 * and `tile` target are first-class vocabulary values that NO op admits yet
 * — parse-illegal everywhere until mid-battle casting lands (the seam
 * ships, the feature doesn't — the cluster scope guard). The duration axis
 * likewise restricts per op to what the engine supports: `applyBuff` =
 * `encounter` (a `run` buff needs a run-duration unit-effect store nothing
 * ships yet); `injectRule` = `encounter | run`. Instant ops (`grantRedraws`,
 * `healPool`) carry no duration — nothing persists to expire.
 */

import { z } from 'zod';
import packetsJson from '../../config/packets.json';
import {
  ApplyStatusOpSchema,
  BATTLE_TRIGGER_KEYS,
  GainBitsOpSchema,
  GrantRedrawsOpSchema,
  HealPoolOpSchema,
} from './daemons';
import { BuffSchema, normalizeBuff, type EmpowerConfig } from './empower';
import { STATUS_DEFS } from './statuses';
import type { StatusDef } from '../sim/effects/statusSchema';
import type { BattleRule } from '../sim/battleRules';

/** The use contexts (`usableIn`). `midBattle` is the deferred seam — in the
 *  vocabulary from day one, admitted by no op yet. */
export const USE_CONTEXTS = ['preTurn', 'outOfBattle', 'midBattle'] as const;
export type UseContext = (typeof USE_CONTEXTS)[number];

/** The target vocabulary. `tile` waits for mid-battle casting (no
 *  battlefield exists in either launch context). */
export const PACKET_TARGET_KINDS = ['none', 'unit', 'tile'] as const;
export type PacketTargetKind = (typeof PACKET_TARGET_KINDS)[number];

/** The full duration axis (spec vocabulary); each op's schema restricts to
 *  its engine-supported subset — see the module header. */
export const EFFECT_DURATIONS = ['battle', 'encounter', 'run', 'permanent'] as const;
export type EffectDuration = (typeof EFFECT_DURATIONS)[number];

// ── the packet-op schemas (the shared-pool extensions) ──────────────────────

const ApplyBuffOpSchema = z.object({
  op: z.literal('applyBuff'),
  buff: BuffSchema,
  duration: z.literal('encounter'),
});

/** The injected rule mirrors the sim's `BattleRule` exactly (on / chance? /
 *  filter? / effect) — battle triggers only, battle-legal filters only. */
const InjectedRuleSchema = z.object({
  on: z.enum(BATTLE_TRIGGER_KEYS),
  chance: z.number().min(0).max(1).optional(),
  filter: z
    .object({
      archetype: z.string().min(1).optional(),
      crit: z.boolean().optional(),
    })
    .optional(),
  effect: z.discriminatedUnion('op', [GainBitsOpSchema, ApplyStatusOpSchema]),
});

const InjectRuleOpSchema = z.object({
  op: z.literal('injectRule'),
  rule: InjectedRuleSchema,
  duration: z.enum(['encounter', 'run']),
});

const PacketEffectSchema = z.discriminatedUnion('op', [
  ApplyBuffOpSchema,
  GrantRedrawsOpSchema,
  InjectRuleOpSchema,
  HealPoolOpSchema,
]);

type PacketOpKey = z.infer<typeof PacketEffectSchema>['op'];

/** The op → required-target matrix (parse guard + the 49e engine + the 49g
 *  editor all read this one source). */
export const PACKET_OP_TARGET = {
  applyBuff: 'unit',
  grantRedraws: 'none',
  injectRule: 'none',
  healPool: 'none',
} as const satisfies Record<PacketOpKey, PacketTargetKind>;

/** The op → legal-contexts matrix (same one-source rule). Content-driven:
 *  49e grew `healPool` to `preTurn` when patch demanded the between-turns
 *  heal (the 49e shape-lock — the growth this comment used to predict). */
export const PACKET_OP_CONTEXTS = {
  applyBuff: ['preTurn', 'outOfBattle'],
  grantRedraws: ['preTurn'],
  injectRule: ['preTurn'],
  healPool: ['preTurn', 'outOfBattle'],
} as const satisfies Record<PacketOpKey, readonly UseContext[]>;

const PacketSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    usableIn: z.array(z.enum(USE_CONTEXTS)).min(1),
    target: z.enum(PACKET_TARGET_KINDS),
    effect: PacketEffectSchema,
  })
  .superRefine((packet, ctx) => {
    const op = packet.effect.op;
    if (packet.target !== PACKET_OP_TARGET[op]) {
      ctx.addIssue({
        code: 'custom',
        message: `op '${op}' requires target '${PACKET_OP_TARGET[op]}', not '${packet.target}'`,
      });
    }
    const legalContexts: readonly UseContext[] = PACKET_OP_CONTEXTS[op];
    for (const context of packet.usableIn) {
      if (!legalContexts.includes(context)) {
        ctx.addIssue({
          code: 'custom',
          message: `op '${op}' is not usable in context '${context}' (legal: ${legalContexts.join(', ')})`,
        });
      }
    }
    if (new Set(packet.usableIn).size !== packet.usableIn.length) {
      ctx.addIssue({ code: 'custom', message: `usableIn entries must be unique` });
    }
    if (
      packet.effect.op === 'injectRule' &&
      packet.effect.rule.filter?.crit !== undefined &&
      packet.effect.rule.on !== 'dealHit'
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `filter 'crit' is only carried by 'dealHit' (trigger '${packet.effect.rule.on}' has no crit flag)`,
      });
    }
    if (
      packet.effect.op === 'injectRule' &&
      packet.effect.rule.effect.op === 'applyStatus' &&
      packet.effect.rule.effect.applyTo === 'target' &&
      packet.effect.rule.on !== 'dealHit'
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `applyTo 'target' is only carried by 'dealHit' (a '${packet.effect.rule.on}' firing has no living target)`,
      });
    }
  });

/** The whole-file schema (exported for schema tests + the 49g editor
 *  round-trip — the `DaemonsSchema`/`RewardTablesSchema` precedent). */
export const PacketsSchema = z
  .object({ packets: z.array(PacketSchema).min(1) })
  .refine((cfg) => new Set(cfg.packets.map((p) => p.id)).size === cfg.packets.length, {
    message: 'packet ids must be unique',
  });

// ── the canonical (exact-optional) types ────────────────────────────────────

/** One effect op, packet flavor. `applyBuff`/`injectRule` are the §49 pool
 *  extensions; `grantRedraws`/`healPool` are the daemon ops fired actively. */
export type PacketEffect =
  | { op: 'applyBuff'; buff: EmpowerConfig['buff']; duration: 'encounter' }
  | { op: 'grantRedraws'; redrawsPerTurn: number; maxCardsPerTurn: number }
  | { op: 'injectRule'; rule: BattleRule; duration: 'encounter' | 'run' }
  | { op: 'healPool'; amount: number };

export interface PacketConfig {
  id: string;
  name: string;
  description: string;
  usableIn: readonly UseContext[];
  target: PacketTargetKind;
  effect: PacketEffect;
}

const parsed = PacketsSchema.parse(packetsJson);

type RawPacket = (typeof parsed.packets)[number];

/** Build exact-optional objects (no explicit-`undefined` keys) from the
 *  parse — the daemons.ts `normalizeRule` discipline. */
function normalizeEffect(raw: RawPacket['effect']): PacketEffect {
  switch (raw.op) {
    case 'applyBuff':
      return { op: 'applyBuff', buff: normalizeBuff(raw.buff), duration: raw.duration };
    case 'grantRedraws':
      return {
        op: 'grantRedraws',
        redrawsPerTurn: raw.redrawsPerTurn,
        maxCardsPerTurn: raw.maxCardsPerTurn,
      };
    case 'injectRule': {
      const rule: BattleRule = { on: raw.rule.on, effect: normalizeRuleEffect(raw.rule.effect) };
      if (raw.rule.chance !== undefined) rule.chance = raw.rule.chance;
      if (raw.rule.filter !== undefined) {
        rule.filter = {};
        if (raw.rule.filter.archetype !== undefined) rule.filter.archetype = raw.rule.filter.archetype;
        if (raw.rule.filter.crit !== undefined) rule.filter.crit = raw.rule.filter.crit;
      }
      return { op: 'injectRule', rule, duration: raw.duration };
    }
    case 'healPool':
      return { op: 'healPool', amount: raw.amount };
  }
}

function normalizeRuleEffect(
  raw: Extract<RawPacket['effect'], { op: 'injectRule' }>['rule']['effect'],
): BattleRule['effect'] {
  if (raw.op === 'gainBits') return { op: 'gainBits', amount: raw.amount };
  const effect: BattleRule['effect'] = { op: 'applyStatus', statusId: raw.statusId };
  if (raw.magnitude !== undefined) effect.magnitude = raw.magnitude;
  if (raw.durationSeconds !== undefined) effect.durationSeconds = raw.durationSeconds;
  if (raw.applyTo !== undefined) effect.applyTo = raw.applyTo;
  return effect;
}

/** Exported for schema tests + the 49g editor (the `normalizeDaemon`
 *  precedent). */
export function normalizePacket(raw: RawPacket): PacketConfig {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    usableIn: [...raw.usableIn],
    target: raw.target,
    effect: normalizeEffect(raw.effect),
  };
}

export const PACKETS: readonly PacketConfig[] = parsed.packets.map(normalizePacket);
export const PACKET_IDS: readonly string[] = PACKETS.map((p) => p.id);

/**
 * Boot check (the `assertDaemonStatusRefs` sibling): every `applyStatus`
 * inside an injected rule must name a status in the registry — a typo'd
 * `statusId` fails at startup, not at 49e injection time. Args-injected for
 * synthetic tests; self-wired below (cycle-free: statuses.ts never imports
 * this module).
 */
export function assertPacketStatusRefs(
  packets: readonly PacketConfig[],
  statusDefs: Record<string, StatusDef>,
): void {
  for (const packet of packets) {
    const { effect } = packet;
    if (effect.op === 'injectRule' && effect.rule.effect.op === 'applyStatus') {
      if (!(effect.rule.effect.statusId in statusDefs)) {
        throw new Error(
          `packet '${packet.id}': injected rule references unknown status id '${effect.rule.effect.statusId}'`,
        );
      }
    }
  }
}

assertPacketStatusRefs(PACKETS, STATUS_DEFS);

/** Catalog lookup by id (`undefined` on a miss — callers decide throw vs
 *  skip; the §49 asserts make a miss unreachable for authored refs). */
export function packetById(id: string): PacketConfig | undefined {
  return PACKETS.find((p) => p.id === id);
}
