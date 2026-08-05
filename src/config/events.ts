/**
 * §74a — the event catalog. Source of truth at `config/events.json`.
 * Mirrors the `encounters.ts` pattern (parse at module load, throw on
 * malformed config; explicit interfaces + zod-boundary casts for
 * `exactOptionalPropertyTypes`).
 *
 * The flat page-map grammar (cluster-5-spec §"Events — LOCKED"): an event is
 * `{ id, name, eligibility?, entry, pages }`; a page is
 * `{ text, art?, choices }`; a choice is `{ label, condition?, outcomes }`
 * where `outcomes` is a weighted list of `{ weight?, effects?, next }` and
 * `next` is a page id or a terminal (`return-to-map` | `start-encounter`).
 * The schema is deliberately NON-recursive (the FTL lineage) — pages rejoin
 * and chains cross-reference by id. Cycles are still expressible through id
 * refs, so `assertEventPagesTerminate` (boot) proves every page can reach a
 * terminal; the fuzz harness must never be able to author-trap in a page.
 *
 * Randomness lives ONLY in the weighted outcome list on a choice — the
 * deterministic case is the single-entry list; `weight` absent = 1 (the
 * sector-pool convention). Execution draws ride `Run.eventRng` (74b).
 *
 * `eligibility` gates the sector pool roll (74e), read against the
 * run-lifetime flag store — the flag store IS the chain state. Flags are
 * namespaced `chainId:key` by convention (documented, not regex-enforced).
 *
 * The effect-op union here is EVENTS-SIDE — its own vocabulary sharing
 * sub-schemas with daemons.ts (the packets.ts precedent; import direction
 * events → daemons, never back). The daemon authoring surface does NOT
 * widen: none of the new ops join the daemon/packet rule matrix
 * (user-signed at the §74 shape-lock). Parse-side is complete from 74a;
 * execution lands staged (74b instants, 74c the rest).
 *
 * `art` is a registry-resolved seam only this cluster (zero implementation —
 * spec scope guard).
 */

import { z } from 'zod';
import eventsJson from '../../config/events.json';
import { GainBitsOpSchema, HealPoolOpSchema, DAEMONS } from './daemons';
import { ENCOUNTER_IDS } from './encounters';
import { REWARD_TABLE_IDS } from './rewards';
import { PACKET_IDS } from './packets';
import { CHARACTER_IDS } from './characters';
import { UNIT_DEFS } from './units';

// ── conditions (the closed v1 union — cluster-5-spec) ───────────────────────

export type EventFlagValue = string | number | boolean;

export type EventCondition =
  | { kind: 'bitsAtLeast'; amount: number }
  | { kind: 'poolHealthAtLeast'; amount: number }
  | { kind: 'poolHealthAtMost'; amount: number }
  | { kind: 'hasDaemon'; daemonId: string }
  | { kind: 'hasPacket'; packetId: string }
  | { kind: 'cacheHasRoom' }
  | { kind: 'rosterSizeAtLeast'; count: number }
  | { kind: 'rosterSizeAtMost'; count: number }
  | { kind: 'characterIs'; characterId: string }
  | { kind: 'flagSet'; flag: string }
  | { kind: 'flagIs'; flag: string; value: EventFlagValue };

const FlagValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const EventConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('bitsAtLeast'), amount: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('poolHealthAtLeast'), amount: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('poolHealthAtMost'), amount: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('hasDaemon'), daemonId: z.string().min(1) }),
  z.object({ kind: z.literal('hasPacket'), packetId: z.string().min(1) }),
  z.object({ kind: z.literal('cacheHasRoom') }),
  z.object({ kind: z.literal('rosterSizeAtLeast'), count: z.number().int().positive() }),
  z.object({ kind: z.literal('rosterSizeAtMost'), count: z.number().int().positive() }),
  z.object({ kind: z.literal('characterIs'), characterId: z.string().min(1) }),
  z.object({ kind: z.literal('flagSet'), flag: z.string().min(1) }),
  z.object({ kind: z.literal('flagIs'), flag: z.string().min(1), value: FlagValueSchema }),
]) as z.ZodType<EventCondition>;

// ── effect ops (events-side union; gainBits/healPool shared from daemons) ───

export type EventEffectOp =
  | { op: 'gainBits'; amount: number }
  | { op: 'spendBits'; amount: number }
  | { op: 'healPool'; amount: number }
  | { op: 'damagePool'; amount: number }
  | { op: 'addPacket'; packetId: string }
  | { op: 'removePacket'; packetId: string }
  | { op: 'addDaemon'; daemonId: string }
  | { op: 'removeDaemon'; daemonId: string }
  | { op: 'grantUnit'; archetype: string; level?: number }
  | { op: 'removeUnit'; pick?: 'random' | 'weakest' | 'strongest' }
  | { op: 'setFlag'; flag: string; value?: EventFlagValue };

export const EventEffectOpSchema = z.discriminatedUnion('op', [
  GainBitsOpSchema,
  z.object({ op: z.literal('spendBits'), amount: z.number().int().positive() }),
  HealPoolOpSchema,
  z.object({ op: z.literal('damagePool'), amount: z.number().int().positive() }),
  z.object({ op: z.literal('addPacket'), packetId: z.string().min(1) }),
  z.object({ op: z.literal('removePacket'), packetId: z.string().min(1) }),
  z.object({ op: z.literal('addDaemon'), daemonId: z.string().min(1) }),
  z.object({ op: z.literal('removeDaemon'), daemonId: z.string().min(1) }),
  z.object({
    op: z.literal('grantUnit'),
    archetype: z.string().min(1),
    level: z.number().int().positive().optional(), // absent = 1
  }),
  z.object({
    op: z.literal('removeUnit'),
    pick: z.enum(['random', 'weakest', 'strongest']).optional(), // absent = 'random'
  }),
  z.object({
    op: z.literal('setFlag'),
    flag: z.string().min(1),
    value: FlagValueSchema.optional(), // absent = true
  }),
]) as z.ZodType<EventEffectOp>;

// ── the page map ────────────────────────────────────────────────────────────

/** `rewardOverride` = the spec's "encounter with a predetermined reward":
 *  a reward-table id replacing the encounter's own `rewards` refs. */
export type EventTerminal =
  | { kind: 'return-to-map' }
  | { kind: 'start-encounter'; encounterId: string; rewardOverride?: string };

/** A page id, or a terminal. */
export type EventNext = string | EventTerminal;

export interface EventOutcome {
  weight?: number;
  effects?: readonly EventEffectOp[];
  next: EventNext;
}

export interface EventChoice {
  label: string;
  condition?: EventCondition;
  outcomes: readonly EventOutcome[];
}

export interface EventPage {
  text: string;
  art?: string;
  choices: readonly EventChoice[];
}

export interface EventDef {
  id: string;
  name: string;
  eligibility?: readonly EventCondition[];
  entry: string;
  pages: Readonly<Record<string, EventPage>>;
}

const EventTerminalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('return-to-map') }),
  z.object({
    kind: z.literal('start-encounter'),
    encounterId: z.string().min(1),
    rewardOverride: z.string().min(1).optional(),
  }),
]) as z.ZodType<EventTerminal>;

const EventNextSchema = z.union([z.string().min(1), EventTerminalSchema]);

const EventOutcomeSchema = z.object({
  weight: z.number().positive().optional(), // absent = 1; positive so a roll never zero-divides
  effects: z.array(EventEffectOpSchema).optional(),
  next: EventNextSchema,
}) as z.ZodType<EventOutcome>;

const EventChoiceSchema = z.object({
  label: z.string().min(1),
  condition: EventConditionSchema.optional(),
  outcomes: z.array(EventOutcomeSchema).min(1),
}) as z.ZodType<EventChoice>;

const EventPageSchema = z.object({
  text: z.string().min(1),
  art: z.string().min(1).optional(),
  choices: z.array(EventChoiceSchema).min(1),
}) as z.ZodType<EventPage>;

/** Intra-def structural guards live here (the sectors.ts superRefine
 *  precedent): the entry page must exist, and every page-id `next` must
 *  resolve. Cross-catalog refs + termination are the boot asserts below. */
const EventSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    eligibility: z.array(EventConditionSchema).optional(),
    entry: z.string().min(1),
    pages: z.record(z.string().min(1), EventPageSchema),
  })
  .superRefine((event, ctx) => {
    if (!(event.entry in event.pages)) {
      ctx.addIssue({
        code: 'custom',
        message: `entry page '${event.entry}' is not in pages`,
      });
    }
    for (const [pageId, page] of Object.entries(event.pages)) {
      for (const choice of page.choices) {
        for (const outcome of choice.outcomes) {
          if (typeof outcome.next === 'string' && !(outcome.next in event.pages)) {
            ctx.addIssue({
              code: 'custom',
              message: `page '${pageId}' choice '${choice.label}': next page '${outcome.next}' is not in pages`,
            });
          }
        }
      }
    }
  }) as z.ZodType<EventDef>;

/** Exported for schema tests + the §74h editor round-trip (the
 *  `EncountersSchema` precedent). */
export const EventsSchema = z.array(EventSchema);

const EVENTS_LIST: readonly EventDef[] = EventsSchema.parse(eventsJson);

const seenEventIds = new Set<string>();
for (const event of EVENTS_LIST) {
  if (seenEventIds.has(event.id)) {
    throw new Error(`events.json: duplicate event id "${event.id}"`);
  }
  seenEventIds.add(event.id);
}

// ── boot asserts ────────────────────────────────────────────────────────────

/**
 * Every page must be able to reach a terminal — "no recursion" in the
 * grammar does NOT preclude id-ref cycles (A→B→A), and a page whose every
 * continuation loops forever would trap the player AND the fuzz harness
 * (the §74 kickoff hazard: a spinning phase neither run guard bounds).
 * Reverse fixpoint: a page terminates iff some choice has some outcome
 * whose `next` is a terminal or a terminating page. Args-injected for
 * synthetic tests; self-wired below.
 */
export function assertEventPagesTerminate(events: readonly EventDef[]): void {
  for (const event of events) {
    const terminating = new Set<string>();
    let grew = true;
    while (grew) {
      grew = false;
      for (const [pageId, page] of Object.entries(event.pages)) {
        if (terminating.has(pageId)) continue;
        const canExit = page.choices.some((choice) =>
          choice.outcomes.some(
            (outcome) => typeof outcome.next !== 'string' || terminating.has(outcome.next),
          ),
        );
        if (canExit) {
          terminating.add(pageId);
          grew = true;
        }
      }
    }
    const stuck = Object.keys(event.pages).filter((pageId) => !terminating.has(pageId));
    if (stuck.length > 0) {
      throw new Error(
        `event '${event.id}': page(s) ${stuck.map((p) => `'${p}'`).join(', ')} cannot reach a terminal (an id-ref cycle with no exit)`,
      );
    }
  }
}

/** The id catalogs an event def can reference (args-injected — the
 *  `assertPriceRefs` bundle precedent). */
export interface EventRefCatalogs {
  encounterIds: readonly string[];
  rewardTableIds: readonly string[];
  packetIds: readonly string[];
  daemonIds: readonly string[];
  characterIds: readonly string[];
  unitArchetypes: readonly string[];
}

/**
 * Cross-catalog referential integrity: every id an event names —
 * encounters/reward tables in terminals, packets/daemons/characters in
 * conditions and ops, archetypes in `grantUnit` — must resolve at boot,
 * not silently at execution time.
 */
export function assertEventRefs(
  events: readonly EventDef[],
  catalogs: EventRefCatalogs,
): void {
  const has = (list: readonly string[], id: string): boolean => list.includes(id);
  const fail = (eventId: string, what: string): never => {
    throw new Error(`event '${eventId}': ${what}`);
  };

  const checkCondition = (eventId: string, cond: EventCondition): void => {
    if (cond.kind === 'hasDaemon' && !has(catalogs.daemonIds, cond.daemonId)) {
      fail(eventId, `condition references unknown daemon id '${cond.daemonId}'`);
    }
    if (cond.kind === 'hasPacket' && !has(catalogs.packetIds, cond.packetId)) {
      fail(eventId, `condition references unknown packet id '${cond.packetId}'`);
    }
    if (cond.kind === 'characterIs' && !has(catalogs.characterIds, cond.characterId)) {
      fail(eventId, `condition references unknown character id '${cond.characterId}'`);
    }
  };

  const checkOp = (eventId: string, op: EventEffectOp): void => {
    if ((op.op === 'addPacket' || op.op === 'removePacket') && !has(catalogs.packetIds, op.packetId)) {
      fail(eventId, `${op.op} references unknown packet id '${op.packetId}'`);
    }
    if ((op.op === 'addDaemon' || op.op === 'removeDaemon') && !has(catalogs.daemonIds, op.daemonId)) {
      fail(eventId, `${op.op} references unknown daemon id '${op.daemonId}'`);
    }
    if (op.op === 'grantUnit' && !has(catalogs.unitArchetypes, op.archetype)) {
      fail(eventId, `grantUnit references unknown archetype '${op.archetype}'`);
    }
  };

  for (const event of events) {
    for (const cond of event.eligibility ?? []) checkCondition(event.id, cond);
    for (const page of Object.values(event.pages)) {
      for (const choice of page.choices) {
        if (choice.condition !== undefined) checkCondition(event.id, choice.condition);
        for (const outcome of choice.outcomes) {
          for (const op of outcome.effects ?? []) checkOp(event.id, op);
          if (typeof outcome.next !== 'string' && outcome.next.kind === 'start-encounter') {
            if (!has(catalogs.encounterIds, outcome.next.encounterId)) {
              fail(event.id, `start-encounter references unknown encounter id '${outcome.next.encounterId}'`);
            }
            if (
              outcome.next.rewardOverride !== undefined &&
              !has(catalogs.rewardTableIds, outcome.next.rewardOverride)
            ) {
              fail(event.id, `rewardOverride references unknown reward table '${outcome.next.rewardOverride}'`);
            }
          }
        }
      }
    }
  }
}

assertEventPagesTerminate(EVENTS_LIST);
assertEventRefs(EVENTS_LIST, {
  encounterIds: ENCOUNTER_IDS,
  rewardTableIds: REWARD_TABLE_IDS,
  packetIds: PACKET_IDS,
  daemonIds: DAEMONS.map((d) => d.id),
  characterIds: CHARACTER_IDS,
  unitArchetypes: Object.keys(UNIT_DEFS),
});

export const EVENTS: readonly EventDef[] = EVENTS_LIST;
export const EVENT_IDS: readonly string[] = EVENTS_LIST.map((e) => e.id);

const EVENTS_BY_ID: Record<string, EventDef> = Object.fromEntries(
  EVENTS_LIST.map((e) => [e.id, e]),
);

/** Catalog lookup by id (`undefined` on a miss — callers decide throw vs skip). */
export function getEvent(id: string): EventDef | undefined {
  return EVENTS_BY_ID[id];
}
