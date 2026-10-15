/**
 * The event catalog. Source of truth at `config/events.json`.
 *
 * An event is `{ id, name, eligibility?, entry, pages }`; a page is `{ text,
 * art?, choices }`; a choice is `{ label, condition?, outcomes }`, where
 * `outcomes` is a weighted list of `{ weight?, effects?, next }` and `next` is
 * a page id or a terminal (`return-to-map`, `start-encounter`). The schema is
 * not recursive: pages rejoin, and chains refer to each other, by id. Cycles
 * can still be written through ids, so a boot check
 * (`assertEventPagesTerminate`) proves every page can reach a terminal, and
 * neither the player nor the fuzz harness can be trapped in one.
 *
 * Randomness is only in a choice's weighted outcome list: a single-entry list
 * is deterministic, and `weight` omitted is 1. The draws ride `Run.eventRng`.
 *
 * `eligibility` gates the sector's pool roll and reads the run's flag store,
 * which is the chain state. Flags are named `chainId:key` by convention, not
 * enforced. The conditions are a closed set of primitives and one
 * combinator, `not`.
 *
 * The effect ops are the events' own vocabulary, sharing sub-schemas with
 * daemons.ts, which never imports this module. None of them joins the
 * daemon or packet rules.
 *
 * `art` parses, and nothing reads it.
 */

import { z } from 'zod';
import eventsJson from '../../config/events.json';
import { prose } from '../i18n/prose';
import { loadProse } from '../i18n/locale';
import { GainBitsOpSchema, HealPoolOpSchema, DAEMONS } from './daemons';
import { ENCOUNTER_IDS } from './encounters';
import {
  EncounterRewardRefSchema,
  REWARD_TABLE_IDS,
  type EncounterRewardRef,
} from './rewards';
import { PACKET_IDS } from './packets';
import { CHARACTER_IDS } from './characters';
import { UNIT_DEFS } from './units';

// ── conditions ──────────────────────────────────────────────────────────────

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
  | { kind: 'flagIs'; flag: string; value: EventFlagValue }
  // The one combinator. It closes the negation class (`not hasDaemon` gates
  // a grant on not owning; `not flagSet` gates a chain on not yet done)
  // without doubling the primitives. There is no allOf or anyOf: an
  // eligibility list is already a conjunction. The termination check is
  // untouched, since it walks unconditioned choices only.
  | { kind: 'not'; condition: EventCondition };

const FlagValueSchema = z.union([z.string(), z.number(), z.boolean()]);

const EventConditionSchema: z.ZodType<EventCondition> = z.discriminatedUnion('kind', [
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
  // The lazy self-reference is what the explicit const annotation above is
  // for (TS self-referential-initializer rule); zod defers evaluation.
  z.object({ kind: z.literal('not'), condition: z.lazy(() => EventConditionSchema) }),
]) as z.ZodType<EventCondition>;

// ── effect ops (gainBits and healPool shared with daemons) ──────────────────

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

const EventEffectOpSchema = z.discriminatedUnion('op', [
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

/** `rewardOverride` gives an event's fight set rewards: reward refs that
 *  replace the encounter's own `rewards` list whole, so the fight can carry
 *  the same mix of tables and chances a catalog encounter does. Non-empty;
 *  no rewards is said by omitting the key. */
export type EventTerminal =
  | { kind: 'return-to-map' }
  | {
      kind: 'start-encounter';
      encounterId: string;
      rewardOverride?: readonly EncounterRewardRef[];
    };

/** A page id, or a terminal. */
export type EventNext = string | EventTerminal;

export interface EventOutcome {
  weight?: number;
  effects?: readonly EventEffectOp[];
  next: EventNext;
}

export interface EventChoice {
  /** The choice's address in the locale layer
   *  (`events.<event>.pages.<page>.choices.<id>.label`), unique within its
   *  page. The editor stamps it at export (`stampChoiceIds`, a slug of the
   *  label); it is absent only on a hand-written draft, where the walker
   *  falls back to the index, which a page edit can shift. */
  id?: string;
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
  /** Opts out of the per-run no-repeat rule. Absent or false, the pool roll
   *  skips the event once its `visited:` flag is set; true, it can recur. */
  repeatable?: boolean;
  eligibility?: readonly EventCondition[];
  entry: string;
  pages: Readonly<Record<string, EventPage>>;
}

/**
 * The reserved visited-flag namespace. The engine writes `visited:<eventId>`
 * into the run's flags when an event's page opens (an entry that turns into
 * combat never marks it, since the player saw no page), and the pool roll
 * reads it to skip repeats unless the event is `repeatable`. Content may read
 * these flags (`{ "kind": "flagSet", "flag": "visited:corrupted-shrine" }` is
 * a legal gate) but never write one (`assertEventReservedFlags`), so the
 * engine is the one writer.
 */
export const VISITED_FLAG_PREFIX = 'visited:';

export function visitedFlagFor(eventId: string): string {
  return `${VISITED_FLAG_PREFIX}${eventId}`;
}

const EventTerminalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('return-to-map') }),
  z.object({
    kind: z.literal('start-encounter'),
    encounterId: z.string().min(1),
    rewardOverride: z.array(EncounterRewardRefSchema).min(1).optional(),
  }),
]) as z.ZodType<EventTerminal>;

const EventNextSchema = z.union([z.string().min(1), EventTerminalSchema]);

const EventOutcomeSchema = z.object({
  weight: z.number().positive().optional(), // absent = 1; positive so a roll never zero-divides
  effects: z.array(EventEffectOpSchema).optional(),
  next: EventNextSchema,
}) as z.ZodType<EventOutcome>;

const EventChoiceSchema = z.object({
  id: z.string().min(1).optional(),
  label: prose(),
  condition: EventConditionSchema.optional(),
  outcomes: z.array(EventOutcomeSchema).min(1),
}) as z.ZodType<EventChoice>;

const EventPageSchema = z.object({
  text: prose(),
  art: z.string().min(1).optional(),
  choices: z.array(EventChoiceSchema).min(1),
}) as z.ZodType<EventPage>;

/** The checks within one event: the entry page exists, and every page-id
 *  `next` resolves. Refs into other catalogs, and termination, are the boot
 *  checks below. */
const EventSchema = z
  .object({
    id: z.string().min(1),
    name: prose(),
    repeatable: z.boolean().optional(),
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
      // Choice ids are locale addresses, unique within the page.
      const choiceIds = new Set<string>();
      for (const choice of page.choices) {
        if (choice.id === undefined) continue;
        if (choiceIds.has(choice.id)) {
          ctx.addIssue({
            code: 'custom',
            message: `page '${pageId}': duplicate choice id '${choice.id}'`,
          });
        }
        choiceIds.add(choice.id);
      }
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

/** Exported for the schema tests and the event editor's round trip. */
export const EventsSchema = z.array(EventSchema);

const EVENTS_LIST: readonly EventDef[] = EventsSchema.parse(eventsJson);

// The prose fields (name, pages.*.text, pages.*.choices.*.label) resolve
// through the active locale in place, once, here. Under `en` the values are
// the inline ones; the walk still runs its checks at boot.
export const EVENTS_PROSE = loadProse('events', EventsSchema, EVENTS_LIST);

const seenEventIds = new Set<string>();
for (const event of EVENTS_LIST) {
  if (seenEventIds.has(event.id)) {
    throw new Error(`events.json: duplicate event id "${event.id}"`);
  }
  seenEventIds.add(event.id);
}

// ── boot asserts ────────────────────────────────────────────────────────────

/**
 * Every page can reach a terminal through unconditioned choices. A grammar
 * without recursion still allows id cycles (A → B → A), and a page whose
 * every continuation loops would trap the player and the fuzz harness in a
 * phase no run guard bounds. The walk takes condition-free choices only,
 * because conditions read mutable run state (bits an earlier effect just
 * spent, flags), so a conditioned exit can vanish mid-event and an
 * unconditioned one cannot. A reverse fixpoint: a page terminates if some
 * unconditioned choice has an outcome whose `next` is a terminal or a page
 * that terminates. Its argument, like the two checks' below, lets a test pass
 * synthetic events.
 */
export function assertEventPagesTerminate(events: readonly EventDef[]): void {
  for (const event of events) {
    const terminating = new Set<string>();
    let grew = true;
    while (grew) {
      grew = false;
      for (const [pageId, page] of Object.entries(event.pages)) {
        if (terminating.has(pageId)) continue;
        const canExit = page.choices.some(
          (choice) =>
            choice.condition === undefined &&
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
        `event '${event.id}': page(s) ${stuck.map((p) => `'${p}'`).join(', ')} cannot reach a terminal through unconditioned choices (an id-ref cycle with no guaranteed exit)`,
      );
    }
  }
}

/**
 * Every page is reachable from the entry page (a search over string `next`
 * refs). The termination check proves a page can be left; this proves it can
 * be entered. Without it a mis-wired `next` (a choice pointing at
 * return-to-map where a page id was meant) orphans a whole branch, which no
 * other check sees.
 */
export function assertEventPagesReachable(events: readonly EventDef[]): void {
  for (const event of events) {
    const reachable = new Set<string>();
    const frontier = [event.entry];
    while (frontier.length > 0) {
      const pageId = frontier.pop()!;
      if (reachable.has(pageId)) continue;
      const page = event.pages[pageId];
      if (page === undefined) continue; // dangling refs are the superRefine's complaint
      reachable.add(pageId);
      for (const choice of page.choices) {
        for (const outcome of choice.outcomes) {
          if (typeof outcome.next === 'string') frontier.push(outcome.next);
        }
      }
    }
    const orphans = Object.keys(event.pages).filter((pageId) => !reachable.has(pageId));
    if (orphans.length > 0) {
      throw new Error(
        `event '${event.id}': page(s) ${orphans.map((p) => `'${p}'`).join(', ')} are unreachable from entry '${event.entry}' — dead content (a mis-wired next?)`,
      );
    }
  }
}

/** No authored `setFlag` writes into `visited:` (see `VISITED_FLAG_PREFIX`). */
export function assertEventReservedFlags(events: readonly EventDef[]): void {
  for (const event of events) {
    for (const [pageId, page] of Object.entries(event.pages)) {
      for (const choice of page.choices) {
        for (const outcome of choice.outcomes) {
          for (const op of outcome.effects ?? []) {
            if (op.op === 'setFlag' && op.flag.startsWith(VISITED_FLAG_PREFIX)) {
              throw new Error(
                `event '${event.id}' page '${pageId}': setFlag targets the reserved '${VISITED_FLAG_PREFIX}' namespace (engine-written; conditions may read it, effects may not write it)`,
              );
            }
          }
        }
      }
    }
  }
}

/** The id catalogs an event can name, passed in so a test can supply its
 *  own. */
export interface EventRefCatalogs {
  encounterIds: readonly string[];
  rewardTableIds: readonly string[];
  packetIds: readonly string[];
  daemonIds: readonly string[];
  characterIds: readonly string[];
  unitArchetypes: readonly string[];
}

/**
 * Every id an event names resolves at boot rather than failing at execution:
 * encounters and reward tables in terminals, packets, daemons and characters
 * in conditions and ops, archetypes in `grantUnit`.
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
    if (cond.kind === 'not') {
      checkCondition(eventId, cond.condition);
      return;
    }
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
            for (const ref of outcome.next.rewardOverride ?? []) {
              if (!has(catalogs.rewardTableIds, ref.table)) {
                fail(event.id, `rewardOverride references unknown reward table '${ref.table}'`);
              }
            }
          }
        }
      }
    }
  }
}

assertEventPagesTerminate(EVENTS_LIST);
assertEventPagesReachable(EVENTS_LIST);
assertEventReservedFlags(EVENTS_LIST);
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

/** Lookup by id, `undefined` on a miss; the caller decides whether to throw
 *  or skip. */
export function getEvent(id: string): EventDef | undefined {
  return EVENTS_BY_ID[id];
}

// The conditions' requirement phrases (`describeEventCondition`) are in
// src/ui/eventConditionText.ts, as UI copy through `t()`, so this module
// carries no player-facing prose.
