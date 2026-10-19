/**
 * A replay's events as a few short words, so two trees can be held against
 * each other event for event.
 *
 * `replayJournal` checks each battle's winner and tick count and one hash of
 * the Run's end. It never looks at what a battle emitted, so a change that
 * moves a hit, a move or a status and still ends every battle the same way on
 * the same tick passes it. This replays a journal with a tap on the bus and
 * hashes every event's name and payload, in order: one digest per battle
 * (`battle:started` to `battle:ended`) and one for everything outside a
 * battle. A stored journal replayed on two trees must give the same digests,
 * and a digest that differs names the battle.
 *
 * A mapping is for a change that renames what is emitted and changes nothing
 * else (a team's name, an id). It is applied to each payload before hashing,
 * so the new tree's events hash as the old tree's did when the mapping takes
 * every new name back to its old one. Without one, a rename shows as every
 * digest that carried the name.
 *
 * The end is reported, not checked: `endMatches` says whether the replay's
 * snapshot hash is the journal's, and `snapshot` is the Run's state for a
 * path-by-path compare when it is not. A battle whose winner or tick count
 * differs still throws `JournalDivergence`.
 */

import { fnv1a } from '../core/fnv1a';
import type { RunSnapshot } from '../run/Run';
import type { RunJournal } from './journal';
import { replayJournal, type ReplayOptions } from './replayJournal';

/** Given an event's name and payload, the value to hash in the payload's place. */
export type EventMapping = (name: string, payload: unknown) => unknown;

interface SegmentDigest {
  /** One digest per battle, in order. */
  readonly battles: readonly string[];
  /** Every event outside a battle. */
  readonly outside: string;
  /** Events hashed, in and outside battles. */
  readonly events: number;
  /** How many of them each event name accounts for. */
  readonly byName: Readonly<Record<string, number>>;
  /** `snapshotHash` of the Run as the replay left it. */
  readonly endHash: string;
  /** Whether that is the hash the journal recorded (true for an open segment). */
  readonly endMatches: boolean;
  readonly snapshot: RunSnapshot;
}

interface DigestOptions {
  /** `ReplayOptions.ignoreConfig`: replay past another config hash. */
  readonly ignoreConfig?: boolean;
  readonly map?: EventMapping;
  /** `ReplayOptions.onCommand`, passed through. */
  readonly onCommand?: ReplayOptions['onCommand'];
}

/**
 * `value` with `change` applied to every property and array element, deepest
 * first, as JSON would hold it. The helper a mapping is written with: it sees
 * each value under its key (an array's elements under the array's key).
 */
export function mapValues(value: unknown, change: (key: string, value: unknown) => unknown, key = ''): unknown {
  if (Array.isArray(value)) return change(key, value.map((v) => mapValues(v, change, key)));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapValues(v, change, k);
    return change(key, out);
  }
  return change(key, value);
}

export function digestReplay(journal: RunJournal, options: DigestOptions = {}): SegmentDigest[] {
  const { map } = options;
  const open = journal.segments.map(() => ({
    battles: [] as string[],
    outside: '',
    battle: null as string | null,
    events: 0,
    byName: {} as Record<string, number>,
  }));
  const replay = replayJournal(journal, {
    endHash: 'report',
    ...(options.ignoreConfig === undefined ? {} : { ignoreConfig: options.ignoreConfig }),
    ...(options.onCommand === undefined ? {} : { onCommand: options.onCommand }),
    onEvent: (segment, event, payload) => {
      const at = open[segment]!;
      const name = String(event);
      const text = `${name} ${JSON.stringify(map === undefined ? payload : map(name, payload))}`;
      at.events++;
      at.byName[name] = (at.byName[name] ?? 0) + 1;
      if (name === 'battle:started') at.battle = '';
      if (at.battle === null) {
        at.outside = fnv1a(`${at.outside}\n${text}`);
        return;
      }
      at.battle = fnv1a(`${at.battle}\n${text}`);
      if (name === 'battle:ended') {
        at.battles.push(at.battle);
        at.battle = null;
      }
    },
  });
  return replay.segments.map((segment, i) => {
    const at = open[i]!;
    return {
      // A segment that ends during a battle leaves that battle's digest open.
      battles: at.battle === null ? at.battles : [...at.battles, at.battle],
      outside: at.outside,
      events: at.events,
      byName: at.byName,
      endHash: segment.hash,
      endMatches: segment.endMatches,
      snapshot: segment.run.toJSON(),
    };
  });
}
