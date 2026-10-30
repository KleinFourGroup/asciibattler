/**
 * The scripted run: a list of entries, each an address (an act and a hop)
 * and what it sets there. The four old dials are its cases (`dialEntries`):
 * `forcedLayoutId`, `forcedEncounterId` and `forcedEventId` set their item
 * at every hop of every act, and `firstNodeKind` sets the kind of the first
 * hop of the act the run starts in. The Run reads every item through
 * `scriptItem` and every kind through `scriptKind`, so a dial and an entry
 * take one path.
 *
 * Acts count from 1, as the sector walk enters them, and hops from 1, an
 * act's root, to its last, the boss. Pure: nothing here draws.
 */
import type { RunConfig } from './RunConfig';

/** A kind an entry can give a hop's nodes: every node kind but the boss's. */
export type ScriptKind = 'battle' | 'elite' | 'event' | 'rest' | 'port';

/** What an entry can set at its address besides the kind. */
export type ScriptItem = 'encounter' | 'layout' | 'event';

export interface ScriptEntry {
  /** The act, 1 up, or `'all'` for every act. */
  readonly act: number | 'all';
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

/**
 * The old dials as entries. The three forced ids cover every hop of every
 * act, as the dials always have; the first-node stamp is the starting act's
 * first hop, the first sector's root.
 */
export function dialEntries(config: RunConfig | undefined, startAct: number): ScriptEntry[] {
  const entries: ScriptEntry[] = [];
  if (config?.forcedLayoutId !== undefined) {
    entries.push({ act: 'all', hop: 'all', layout: config.forcedLayoutId });
  }
  if (config?.forcedEncounterId !== undefined) {
    entries.push({ act: 'all', hop: 'all', encounter: config.forcedEncounterId });
  }
  if (config?.forcedEventId !== undefined) {
    entries.push({ act: 'all', hop: 'all', event: config.forcedEventId });
  }
  if (config?.firstNodeKind !== undefined) {
    entries.push({ act: startAct, hop: 1, kind: config.firstNodeKind });
  }
  return entries;
}

// A numbered hop is more specific than a whole act, and a whole act than
// every act.
const rank = (e: ScriptEntry): number => (e.hop !== 'all' ? 2 : e.act !== 'all' ? 1 : 0);

const covers = (e: ScriptEntry, act: number, hop: number): boolean =>
  (e.act === 'all' || e.act === act) && (e.hop === 'all' || e.hop === hop);

/** The item the most specific entry covering the address sets, or undefined. */
export function scriptItem(
  entries: readonly ScriptEntry[],
  item: ScriptItem,
  act: number,
  hop: number,
): string | undefined {
  let best: ScriptEntry | undefined;
  for (const e of entries) {
    if (e[item] === undefined || !covers(e, act, hop)) continue;
    if (best === undefined || rank(e) > rank(best)) best = e;
  }
  return best?.[item];
}

/** The kind an entry gives the hop, or undefined. Only a numbered hop takes one. */
export function scriptKind(
  entries: readonly ScriptEntry[],
  act: number,
  hop: number,
): ScriptKind | undefined {
  return entries.find((e) => e.kind !== undefined && e.hop === hop && e.act === act)?.kind;
}
