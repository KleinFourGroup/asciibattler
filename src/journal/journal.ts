/**
 * THE RUN JOURNAL (Round 8 spec D4): what a player did in one run, in the
 * order they did it, so the run replays headless on the build that recorded
 * it. The journal holds inputs and checkpoints, never state: the seed and the
 * URL's dials, every `RunCommand`, every battle order with its tick, and at
 * each battle's end who won and after how many ticks. The determinism
 * contract (TESTING.md) is what makes that enough.
 *
 * SEGMENTS. A journal is a list of segments, and each segment replays on its
 * own: it is stamped with the build and the config hash that recorded it, and
 * it starts from a seed or from a whole snapshot. A run played in one sitting
 * is one segment. A load opens another (115d). The save the run was loaded
 * from kept a copy of the journal whose open segment ended `saved`, with the
 * saved snapshot's hash. On the build and config that recorded that segment,
 * the next one starts from the hash (`resume`), and a replay goes on from the
 * segment before as the page did: through the snapshot's text, loaded with
 * the run's dials. On another build or config it starts from the whole
 * snapshot, so a run continued on a later build stays replayable piece by
 * piece.
 *
 * ENTRIES are one ordered list per segment, in the order things happened:
 *  - `run`: a command sent to the Run, recorded before it is applied, so
 *    whatever it sets off (a battle, its orders) follows it in the list. One
 *    sent during a battle carries `tick`, the last tick that had run, because
 *    the Run listens to the battle (a unit's death lands in its fallen
 *    ledger) and a replay must send the command at the same place.
 *  - `order`: a battle command with its effective tick, the first tick whose
 *    unit actions can observe it (`command:applied`'s stamp). A replay
 *    enqueues it before that tick runs. Every applied command is recorded,
 *    the one a battle's own setup enqueues included (the enemy's camp pull,
 *    src/sim/battleSetup.ts): the bus doesn't say who sent a command. A
 *    replay's setup enqueues its own again, and setting the same objective
 *    twice leaves the same state as setting it once.
 *  - `battle`: the checkpoint at a battle's end. A replay that reaches
 *    another winner or another tick count has diverged, and the checkpoint
 *    names the battle it diverged in.
 *
 * `ms` is wall-clock milliseconds since the segment opened. It is metadata
 * for pacing a recorded replay and for telemetry, and nothing in the
 * simulation reads it.
 *
 * Two commands are the game's own and are not entries: `chooseCharacter`
 * constructs the Run, so it is the segment's start (the dials name the
 * character), and `resetRun` replaces the Run, so it is the segment's end
 * (`abandoned`).
 *
 * A journal is recorded with the turn gates on (`Run.pauseAtTurnGates`), as
 * the game plays; a replay sets them the same way.
 */

import type { GameEvents } from '../core/events';
import { fnv1a } from '../core/fnv1a';
import type { RunCommand } from '../run/Command';
import type { RunSnapshot } from '../run/Run';
import type { WorldCommand } from '../sim/Command';

/** The journal's own format. A replay refuses any other. 2 (115d): the
 *  `resume` start, the `saved` end, and the dials on a `snapshot` start. */
export const JOURNAL_FORMAT = 2;

/** Every `RunCommand` the Run itself applies (see the header for the two
 *  that are the game's). */
export type JournaledCommand = Exclude<RunCommand, { kind: 'resetRun' | 'chooseCharacter' }>;

export type JournalStart =
  /** A new run: the seed it was constructed with and the URL's run dials as
   *  query text (`runConfigToQueryString`), the chosen character among them. */
  | { readonly kind: 'seed'; readonly seed: number; readonly dials: string }
  /** A loaded run: the whole snapshot it resumed from, and the dials it was
   *  loaded with (`Run.fromJSON` takes them; the snapshot doesn't hold them). */
  | { readonly kind: 'snapshot'; readonly snapshot: RunSnapshot; readonly dials: string }
  /** 115d — a loaded run on the build and config of the segment before, which
   *  ended `saved` at `hash`: a replay loads that segment's Run from its text
   *  with the dials, as the page loaded the save. */
  | { readonly kind: 'resume'; readonly hash: string; readonly dials: string };

export type JournalEntry =
  | { readonly t: 'run'; readonly ms: number; readonly tick?: number; readonly command: JournaledCommand }
  | { readonly t: 'order'; readonly tick: number; readonly command: WorldCommand }
  | {
      readonly t: 'battle';
      readonly winner: GameEvents['battle:ended']['winner'];
      readonly ticks: number;
    };

export interface JournalEnd {
  /** `abandoned`: the run was reset or replaced before it ended. `saved`
   *  (115d): the copy a save keeps of the segment being recorded; the run
   *  went on from there, after a load in the next segment. */
  readonly reason: 'defeat' | 'victory' | 'abandoned' | 'saved';
  readonly ms: number;
  /** Set when the segment ended during a battle: the last tick that had run. */
  readonly tick?: number;
  /** `snapshotHash` of the Run once it had settled; what a replay must reach. */
  readonly hash: string;
}

export interface JournalSegment {
  /** `BUILD_ID` of the page that recorded it. */
  readonly build: string;
  /** `configHash()` of the page that recorded it. */
  readonly configHash: string;
  /** Epoch milliseconds when the segment opened; each `ms` counts from here. */
  readonly openedAt: number;
  readonly start: JournalStart;
  readonly entries: readonly JournalEntry[];
  /** Null while the run is being played. */
  readonly end: JournalEnd | null;
}

export interface RunJournal {
  readonly format: typeof JOURNAL_FORMAT;
  readonly segments: readonly JournalSegment[];
}

/** One short word for a Run's whole saved state: the recorder stamps it at a
 *  segment's end and a replay compares its own against it. */
export function snapshotHash(snapshot: RunSnapshot): string {
  return fnv1a(JSON.stringify(snapshot));
}

/** The name an exported journal's file gets: when its run began, in UTC, in
 *  the form the DEV exports use (`asciibattler-journal-2026-10-01T22-03-26-159Z.json`). */
export function journalFileName(journal: RunJournal): string {
  const opened = journal.segments[0]?.openedAt ?? 0;
  return `asciibattler-journal-${new Date(opened).toISOString().replace(/[:.]/g, '-')}.json`;
}
