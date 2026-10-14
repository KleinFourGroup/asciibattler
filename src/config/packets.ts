/**
 * The packet catalog. Source of truth at `config/packets.json`.
 *
 * A packet is a one-shot consumable that delivers one effect op at a target.
 * Daemons and packets share one pool of effect ops: a daemon delivers them
 * passively on triggers, a packet actively when the player fires it. A fire
 * consumes the packet at once and for good, so the order of firing is the
 * order of effect, with no batching and no undo. The cache holds packet ids,
 * and the defs are looked up when read.
 *
 * - `applyBuff` — a buff (the shared `BuffSchema` shape) lands on the target
 *   unit's roster slot through the encounter-effect store. Before a turn the
 *   target is a hand card; out of battle it is a roster unit, and the buff
 *   rides the next encounter.
 * - `grantRedraws` — pushes a redraw grant into this turn's grant queue; the
 *   usual redraw flow picks the cards, so the packet's own target is `none`.
 * - `injectRule` — the rule, in the sim's `BattleRule` shape exactly, joins
 *   World's `battleRules[]` for the authored duration. It is how a packet
 *   acts across a battle, since no battle-start trigger exists.
 * - `healPool` — an instant heal to the run's pool, the daemon op fired
 *   actively.
 * - `drawCards` — draws `count` more cards into this turn's hand at once. The
 *   cards join `Run.hand` directly and the `drawAmount` fold is untouched, so
 *   the enemy budget's basis never sees a packet's draw. It stops early on a
 *   fully dealt deck.
 * - `discardCards` — sends the targeted hand card to the discard, and the
 *   hand shrinks; with no refill, it is not a redraw. One card per fire.
 *
 * Which target and which contexts each op allows is enforced at parse and
 * exported (`PACKET_OP_TARGET`, `PACKET_OP_CONTEXTS`), so the engine's checks
 * and the packet editor read the same tables. The `midBattle` context and
 * the `tile` target are in the vocabulary, and no op admits either. Each op
 * also allows only the durations the engine supports: `applyBuff` takes
 * `encounter`, since no store keeps a unit's effect for a run; `injectRule`
 * takes `encounter` or `run`, though no shipped packet injects a `run` rule
 * (`packets.test.ts` holds that line and says why). Instant ops carry no
 * duration.
 */

import { z } from 'zod';
import { prose } from '../i18n/prose';
import { loadProse } from '../i18n/locale';
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

/** The use contexts (`usableIn`). No op admits `midBattle`. */
export const USE_CONTEXTS = ['preTurn', 'outOfBattle', 'midBattle'] as const;
export type UseContext = (typeof USE_CONTEXTS)[number];

/** The target vocabulary. No op admits `tile`: neither context a packet
 *  fires in has a battlefield. */
export const PACKET_TARGET_KINDS = ['none', 'unit', 'tile'] as const;
export type PacketTargetKind = (typeof PACKET_TARGET_KINDS)[number];

/** The duration vocabulary; each op's schema allows a subset (see the
 *  header). */
export const EFFECT_DURATIONS = ['battle', 'encounter', 'run', 'permanent'] as const;
export type EffectDuration = (typeof EFFECT_DURATIONS)[number];

// ── the packet-only ops ─────────────────────────────────────────────────────

const ApplyBuffOpSchema = z.object({
  op: z.literal('applyBuff'),
  buff: BuffSchema,
  duration: z.literal('encounter'),
});

/** The injected rule mirrors the sim's `BattleRule` exactly (on, chance?,
 *  filter?, effect), with battle triggers and battle filters only. */
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

// The hand ops are instant: a draw or a discard persists as hand state, and
// nothing expires.
const DrawCardsOpSchema = z.object({
  op: z.literal('drawCards'),
  count: z.number().int().positive(),
});

const DiscardCardsOpSchema = z.object({
  op: z.literal('discardCards'),
});

const PacketEffectSchema = z.discriminatedUnion('op', [
  ApplyBuffOpSchema,
  GrantRedrawsOpSchema,
  InjectRuleOpSchema,
  HealPoolOpSchema,
  DrawCardsOpSchema,
  DiscardCardsOpSchema,
]);

type PacketOpKey = z.infer<typeof PacketEffectSchema>['op'];

/** The target each op requires; the parse, the engine and the editor read
 *  it. */
export const PACKET_OP_TARGET = {
  applyBuff: 'unit',
  grantRedraws: 'none',
  injectRule: 'none',
  healPool: 'none',
  drawCards: 'none',
  discardCards: 'unit',
} as const satisfies Record<PacketOpKey, PacketTargetKind>;

/** The contexts each op may be used in, read as the target table is. A
 *  context is added when content needs it. */
export const PACKET_OP_CONTEXTS = {
  applyBuff: ['preTurn', 'outOfBattle'],
  grantRedraws: ['preTurn'],
  injectRule: ['preTurn'],
  healPool: ['preTurn', 'outOfBattle'],
  // The hand ops are pre-turn only: there is no hand at the map.
  drawCards: ['preTurn'],
  discardCards: ['preTurn'],
} as const satisfies Record<PacketOpKey, readonly UseContext[]>;

const PacketSchema = z
  .object({
    id: z.string().min(1),
    name: prose(),
    description: prose(),
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

/** The whole-file schema, exported for the schema tests and the packet
 *  editor's round trip. */
export const PacketsSchema = z
  .object({ packets: z.array(PacketSchema).min(1) })
  .refine((cfg) => new Set(cfg.packets.map((p) => p.id)).size === cfg.packets.length, {
    message: 'packet ids must be unique',
  });

// ── the canonical (exact-optional) types ────────────────────────────────────

/** One effect op, as a packet carries it. `grantRedraws` and `healPool` are
 *  the daemon ops, fired actively; the rest are the packet's own. */
export type PacketEffect =
  | { op: 'applyBuff'; buff: EmpowerConfig['buff']; duration: 'encounter' }
  | { op: 'grantRedraws'; redrawsPerTurn: number; maxCardsPerTurn: number }
  | { op: 'injectRule'; rule: BattleRule; duration: 'encounter' | 'run' }
  | { op: 'healPool'; amount: number }
  | { op: 'drawCards'; count: number }
  | { op: 'discardCards' };

export interface PacketConfig {
  id: string;
  name: string;
  description: string;
  usableIn: readonly UseContext[];
  target: PacketTargetKind;
  effect: PacketEffect;
}

const parsed = PacketsSchema.parse(packetsJson);
// `name` and `description` are prose, resolved on the parsed list before
// `normalizePacket` copies the fields, and addressed as `packets.<id>.…`.
export const PACKETS_PROSE = loadProse('packets', z.array(PacketSchema), parsed.packets);

type RawPacket = (typeof parsed.packets)[number];

/** Build exact-optional objects, with no explicit-`undefined` keys, from the
 *  parse. */
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
    case 'drawCards':
      return { op: 'drawCards', count: raw.count };
    case 'discardCards':
      return { op: 'discardCards' };
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

/** Exported for the schema tests and the packet editor. */
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
 * Boot check: every `applyStatus` inside an injected rule names a status in
 * the registry, so a typo fails at startup and not at injection. Its
 * arguments let a test pass synthetic catalogs; statuses.ts never imports
 * this module.
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

/** Lookup by id, `undefined` on a miss; the caller decides whether to throw
 *  or skip, and the boot checks make a miss unreachable for authored refs. */
export function packetById(id: string): PacketConfig | undefined {
  return PACKETS.find((p) => p.id === id);
}
