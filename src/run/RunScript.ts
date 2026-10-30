/**
 * The scripted run: a list of entries, each an address (an act and a hop)
 * and what it sets there. `RunConfig.script` holds the entries the URL's
 * `script=` spells (`parseScript` in `RunConfig.ts`), and the four old dials
 * are cases of the same list (`dialEntries`): `forcedLayoutId`,
 * `forcedEncounterId` and `forcedEventId` set their item at every hop of
 * every act, and `firstNodeKind` gives the starting act's root its kind.
 * The Run reads every item through `scriptItem` and every kind through
 * `hopKind`, so a dial and an entry take one path.
 *
 * Acts count from 1, as the sector walk enters them, and hops from 1, an
 * act's root, to its last, the boss. A numbered hop's entry is a script: its
 * kind (given, or implied by its encounter or event) is stamped on every
 * node of the hop, and a named event there always opens. A starred entry
 * (`hop: 'all'`) is a filter, as the old dials are: it stamps nothing and
 * applies where the kind fits. Pure: nothing here draws.
 */
import type { RunConfig } from './RunConfig';

/** A kind an entry can give a hop's nodes: every node kind but the boss's. */
export type ScriptKind = 'battle' | 'elite' | 'event' | 'rest' | 'port';

export const SCRIPT_KINDS: readonly ScriptKind[] = ['battle', 'elite', 'event', 'rest', 'port'];

/** What an entry can set at its address besides the kind. */
export type ScriptItem = 'encounter' | 'layout' | 'event';

export const SCRIPT_ITEMS: readonly ScriptItem[] = ['encounter', 'layout', 'event'];

export interface ScriptEntry {
  /**
   * The act, 1 up. Absent, a numbered hop is in the act the run starts in,
   * and `'all'` hops are every act's.
   */
  readonly act?: number;
  /** The hop, 1 up (an act's root is 1), or `'all'` for every hop. */
  readonly hop: number | 'all';
  readonly kind?: ScriptKind;
  /** An encounter id, fought where its kind fits. */
  readonly encounter?: string;
  /** A layout id, or `FORCE_PROCEDURAL`: the board of a fight there. */
  readonly layout?: string;
  /** An event id, opened at an event node there. */
  readonly event?: string;
}

/** An encounter's kind by id, or undefined for an id the catalog lacks. */
export type EncounterKindOf = (id: string) => 'normal' | 'elite' | 'boss' | undefined;

/**
 * The old dials as entries. The three forced ids cover every hop of every
 * act, as the dials always have; the first-node stamp is the starting act's
 * first hop, the first sector's root.
 */
export function dialEntries(config: RunConfig | undefined): ScriptEntry[] {
  const entries: ScriptEntry[] = [];
  if (config?.forcedLayoutId !== undefined) {
    entries.push({ hop: 'all', layout: config.forcedLayoutId });
  }
  if (config?.forcedEncounterId !== undefined) {
    entries.push({ hop: 'all', encounter: config.forcedEncounterId });
  }
  if (config?.forcedEventId !== undefined) {
    entries.push({ hop: 'all', event: config.forcedEventId });
  }
  if (config?.firstNodeKind !== undefined) {
    entries.push({ hop: 1, kind: config.firstNodeKind });
  }
  return entries;
}

// A numbered hop is more specific than a whole act, and a whole act than
// every act.
const rank = (e: ScriptEntry): number => (e.hop !== 'all' ? 2 : e.act !== undefined ? 1 : 0);

/** The act a numbered entry is in, or undefined for a starred one of every act. */
const actOf = (e: ScriptEntry, startAct: number): number | undefined =>
  e.act ?? (e.hop === 'all' ? undefined : startAct);

const covers = (e: ScriptEntry, act: number, hop: number, startAct: number): boolean => {
  const at = actOf(e, startAct);
  return (at === undefined || at === act) && (e.hop === 'all' || e.hop === hop);
};

/** The entries on one numbered hop. */
const onHop = (
  entries: readonly ScriptEntry[],
  act: number,
  hop: number,
  startAct: number,
): ScriptEntry[] => entries.filter((e) => e.hop === hop && actOf(e, startAct) === act);

/** The item the most specific entry covering the address sets, or undefined. */
export function scriptItem(
  entries: readonly ScriptEntry[],
  item: ScriptItem,
  act: number,
  hop: number,
  startAct: number,
): string | undefined {
  let best: ScriptEntry | undefined;
  for (const e of entries) {
    if (e[item] === undefined || !covers(e, act, hop, startAct)) continue;
    if (best === undefined || rank(e) > rank(best)) best = e;
  }
  return best?.[item];
}

/**
 * The kind a numbered hop's entries give it: the kind they name, else
 * `event` for a named event, else the named encounter's (a normal one a
 * `battle`, an elite an `elite`; a boss stamps nothing). Undefined when none
 * gives one.
 */
export function hopKind(
  entries: readonly ScriptEntry[],
  act: number,
  hop: number,
  startAct: number,
  encounterKind: EncounterKindOf,
): ScriptKind | undefined {
  const kinds = impliedKinds(onHop(entries, act, hop, startAct), encounterKind);
  return kinds[0];
}

function impliedKinds(entries: readonly ScriptEntry[], encounterKind: EncounterKindOf): ScriptKind[] {
  const kinds: ScriptKind[] = [];
  for (const e of entries) {
    if (e.kind !== undefined) kinds.push(e.kind);
    if (e.event !== undefined) kinds.push('event');
    const k = e.encounter === undefined ? undefined : encounterKind(e.encounter);
    if (k === 'normal') kinds.push('battle');
    if (k === 'elite') kinds.push('elite');
  }
  return kinds;
}

/** Whether a numbered hop's entry names its event, which then always opens. */
export function scriptedEvent(
  entries: readonly ScriptEntry[],
  act: number,
  hop: number,
  startAct: number,
): boolean {
  return onHop(entries, act, hop, startAct).some((e) => e.event !== undefined);
}

/** An entry's address as the URL spells it: `3`, `2.5`, `*`, `2.*`. */
export function addressOf(e: ScriptEntry): string {
  const hop = e.hop === 'all' ? '*' : String(e.hop);
  return e.act === undefined ? hop : `${e.act}.${hop}`;
}

/**
 * What makes a list contradict itself, one line each: a kind on a starred
 * address, one item set twice at one address, and a numbered hop given two
 * kinds (`3:rest,encounter=brigands`). Empty when the list holds. A bare
 * numbered hop and the same hop with the starting act's number are one
 * address.
 */
export function scriptConflicts(
  entries: readonly ScriptEntry[],
  startAct: number,
  encounterKind: EncounterKindOf,
): string[] {
  const problems: string[] = [];
  const key = (e: ScriptEntry): string => `${actOf(e, startAct) ?? '*'}.${e.hop}`;
  const seen = new Map<string, Set<string>>();
  for (const e of entries) {
    if (e.hop === 'all' && e.kind !== undefined) {
      problems.push(`${addressOf(e)}: a kind (${e.kind}) needs a numbered hop`);
    }
    const items = seen.get(key(e)) ?? new Set<string>();
    for (const item of SCRIPT_ITEMS) {
      if (e[item] === undefined) continue;
      if (items.has(item)) problems.push(`${addressOf(e)}: ${item} is set twice`);
      items.add(item);
    }
    seen.set(key(e), items);
  }
  const numbered = new Map<string, ScriptEntry[]>();
  for (const e of entries) {
    if (e.hop === 'all') continue;
    numbered.set(key(e), [...(numbered.get(key(e)) ?? []), e]);
  }
  for (const group of numbered.values()) {
    const kinds = [...new Set(impliedKinds(group, encounterKind))];
    if (kinds.length > 1) problems.push(`${addressOf(group[0]!)}: two kinds (${kinds.join(', ')})`);
  }
  return problems;
}

/** One entry as the URL spells it: its address, then its items. */
export function entryToString(e: ScriptEntry): string {
  const items: string[] = [];
  if (e.kind !== undefined) items.push(e.kind);
  for (const item of SCRIPT_ITEMS) {
    const value = e[item];
    if (value !== undefined) items.push(`${item}=${value}`);
  }
  return `${addressOf(e)}:${items.join(',')}`;
}

/** The list as `script=`'s value, the inverse of `parseScript`. */
export const scriptToString = (entries: readonly ScriptEntry[]): string =>
  entries.map(entryToString).join(';');
