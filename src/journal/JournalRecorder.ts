/**
 * The journal's recorder: it assembles one run's journal (./journal.ts) from
 * the two places a run's inputs pass. The dispatcher hands it each
 * `RunCommand` before applying it, and the bus gives it the battle's side:
 * the orders as they take effect and each battle's end.
 *
 * PASSIVE. It reads the bus and copies what it is handed. It never emits,
 * never touches the Run or a World, and draws no randomness, so recording
 * cannot change a run. The clock it is given only fills `ms`.
 *
 * STORAGE-AGNOSTIC. A closed journal goes to the `onClosed` callback; where
 * it is kept is the caller's business. This module runs headless.
 *
 * CONSTRUCT IT BEFORE THE RUN, on the bus the Run will use. Handlers run in
 * subscription order, and a Run with the turn gates off answers
 * `battle:ended` by starting the next battle inside the same emit; the
 * recorder has to see the end first.
 *
 * WHO CALLS WHAT. `open` when a Run is constructed, or `resume` (115d) when
 * one is loaded with the journal its save kept; `command` before each
 * command is applied, then `settle` once it has been; `saved` for the copy
 * a save keeps; `abandon` when the Run is reset or replaced. A run's end is noticed on the bus
 * (`run:defeated`, `run:victory`) and closed at the next `settle`, because
 * the Run can still be changing state when it emits: the hash is taken once
 * control is back with the caller.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { RunSnapshot } from '../run/Run';
import {
  JOURNAL_FORMAT,
  snapshotHash,
  type JournalEnd,
  type JournalEntry,
  type JournalSegment,
  type JournalStart,
  type JournaledCommand,
  type RunJournal,
} from './journal';

/** What every segment this page records is stamped with. */
export interface JournalStamp {
  readonly build: string;
  readonly configHash: string;
}

interface OpenSegment extends JournalSegment {
  readonly entries: JournalEntry[];
  end: JournalEnd | null;
}

export class JournalRecorder {
  /** 115d — the segments a load carried over from the save's journal, each
   *  ended; the segment being recorded follows them. */
  private earlier: JournalSegment[] = [];
  private segment: OpenSegment | null = null;
  private snapshot: (() => RunSnapshot) | null = null;
  /** The last tick that ran in the battle in progress; null outside one. */
  private battleTick: number | null = null;
  /** Set by the bus when the run ends; closed at the next `settle`. */
  private ending: 'defeat' | 'victory' | null = null;

  private readonly unsubscribes: (() => void)[];

  /**
   * @param now epoch milliseconds (`Date.now` in the game); metadata only.
   * @param onClosed called once per journal, when its run ends or is abandoned.
   */
  constructor(
    bus: EventBus<GameEvents>,
    private readonly stamp: JournalStamp,
    private readonly now: () => number,
    private readonly onClosed: (journal: RunJournal) => void,
  ) {
    this.unsubscribes = [
      bus.on('battle:started', () => {
        if (this.segment) this.battleTick = 0;
      }),
      bus.on('tick', ({ tick }) => {
        if (this.battleTick !== null) this.battleTick = tick;
      }),
      bus.on('command:applied', ({ tick, command }) => {
        if (this.battleTick === null) return;
        this.segment?.entries.push({ t: 'order', tick, command: structuredClone(command) });
      }),
      bus.on('battle:ended', ({ winner }) => {
        // An end with no battle open is a test fixture's synthetic emit.
        if (this.battleTick === null) return;
        this.segment?.entries.push({ t: 'battle', winner, ticks: this.battleTick });
        this.battleTick = null;
      }),
      bus.on('run:defeated', () => {
        if (this.segment) this.ending = 'defeat';
      }),
      bus.on('run:victory', () => {
        if (this.segment) this.ending = 'victory';
      }),
    ];
  }

  /** The journal being recorded, as it stands; null between runs. */
  get journal(): RunJournal | null {
    return this.segment ? { format: JOURNAL_FORMAT, segments: [...this.earlier, this.segment] } : null;
  }

  /**
   * Begin a journal for a Run that was just constructed or loaded.
   * `snapshot` reads that Run's saved state and is called once, when the
   * journal closes. A journal still open is abandoned first.
   */
  open(start: JournalStart, snapshot: () => RunSnapshot): void {
    this.abandon();
    this.begin(start, snapshot);
  }

  /**
   * 115d — begin the next segment of `saved`, the journal a save kept, for a
   * Run just loaded from that save's `snapshot` with `dials`. On the build
   * and config that recorded the save's segment, the new one starts from the
   * snapshot's hash (`resume`); on another, from the whole snapshot. A
   * journal that doesn't end `saved` at this snapshot's hash (none, another
   * format, or another save's) is not carried, and the journal starts over
   * from the snapshot. Returns the start's kind.
   */
  resume(
    saved: RunJournal | null,
    snapshot: RunSnapshot,
    dials: string,
    read: () => RunSnapshot,
  ): 'resume' | 'snapshot' {
    this.abandon();
    const hash = snapshotHash(snapshot);
    const last = saved?.format === JOURNAL_FORMAT ? saved.segments.at(-1) : undefined;
    const carried = last !== undefined && last.end?.reason === 'saved' && last.end.hash === hash;
    const same = carried && last.build === this.stamp.build && last.configHash === this.stamp.configHash;
    this.begin(same ? { kind: 'resume', hash, dials } : { kind: 'snapshot', snapshot, dials }, read);
    this.earlier = carried ? saved!.segments.map((s) => structuredClone(s)) : [];
    return same ? 'resume' : 'snapshot';
  }

  /**
   * 115d — the journal as a save keeps it beside `snapshot`: every segment,
   * the one being recorded ended `saved` with the snapshot's hash. The
   * recording goes on. Null with no journal open.
   */
  saved(snapshot: RunSnapshot): RunJournal | null {
    const segment = this.segment;
    if (!segment) return null;
    const ended: JournalSegment = { ...segment, entries: segment.entries.slice(), end: this.endOf('saved', snapshot) };
    return { format: JOURNAL_FORMAT, segments: [...this.earlier, ended] };
  }

  private begin(start: JournalStart, snapshot: () => RunSnapshot): void {
    this.segment = {
      build: this.stamp.build,
      configHash: this.stamp.configHash,
      openedAt: this.now(),
      start: structuredClone(start),
      entries: [],
      end: null,
    };
    this.snapshot = snapshot;
  }

  /**
   * Record a command, BEFORE it is applied. The command is copied: a
   * `chooseRecruit` carries the offered template itself, which the Run goes
   * on to own. With no journal open (the run has ended) it is dropped.
   */
  command(command: JournaledCommand): void {
    const segment = this.segment;
    if (!segment) return;
    segment.entries.push({
      t: 'run',
      ms: this.elapsed(segment),
      ...(this.battleTick !== null ? { tick: this.battleTick } : {}),
      command: structuredClone(command),
    });
  }

  /** Control is back from the Run (a command was applied, or a tick ran with
   *  the turn gates off): close the journal if the run ended meanwhile. */
  settle(): void {
    if (this.ending !== null) this.close(this.ending);
  }

  /** The Run is being reset or replaced: close the journal as it stands.
   *  Call it before the Run is disposed. No-op with no journal open. */
  abandon(): void {
    if (this.segment) this.close('abandoned');
  }

  /** Unsubscribe from the bus and drop any open journal, unreported. */
  dispose(): void {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes.length = 0;
    this.clear();
  }

  private elapsed(segment: JournalSegment): number {
    return Math.round(this.now() - segment.openedAt);
  }

  private close(reason: JournalEnd['reason']): void {
    const segment = this.segment;
    const snapshot = this.snapshot;
    if (!segment || !snapshot) return;
    segment.end = this.endOf(reason, snapshot());
    const journal: RunJournal = { format: JOURNAL_FORMAT, segments: [...this.earlier, segment] };
    this.clear();
    this.onClosed(journal);
  }

  private endOf(reason: JournalEnd['reason'], snapshot: RunSnapshot): JournalEnd {
    const segment = this.segment!;
    return {
      reason,
      ms: this.elapsed(segment),
      ...(this.battleTick !== null ? { tick: this.battleTick } : {}),
      hash: snapshotHash(snapshot),
    };
  }

  private clear(): void {
    this.earlier = [];
    this.segment = null;
    this.snapshot = null;
    this.battleTick = null;
    this.ending = null;
  }
}
