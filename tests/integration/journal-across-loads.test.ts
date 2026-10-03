import { describe, expect, it } from 'vitest';
import { configHash } from '../../src/config/configHash';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { JournalRecorder } from '../../src/journal/JournalRecorder';
import { snapshotHash, type JournalSegment, type RunJournal } from '../../src/journal/journal';
import { JournalRefused, replayJournal } from '../../src/journal/replayJournal';
import { Run } from '../../src/run/Run';
import { TEST_BUILD, asFile, bytes, driveRun } from '../journalDrive';

// 115d — THE JOURNAL ACROSS A LOAD. A run whose tab is closed and opened
// again at several gates is recorded as one journal of several segments:
// each save kept a copy of the journal with its open segment ended `saved`,
// and each load resumed it. The journal must replay to the bytes of the same
// run played straight through. Two of the loads are on another build, so
// their segments start from the whole snapshot; the others resume from the
// saved hash and replay on from the segment before.

const START = { kind: 'seed', seed: 2, dials: 'sectorHops=2&character=soldier' } as const;
const OTHER_BUILD = '0.0.0+other';
/** The gates the tab is closed at, and the build the next page is on. */
const RELOADS = new Map<number, string>([
  [3, TEST_BUILD],
  [11, TEST_BUILD],
  [19, OTHER_BUILD],
  [27, OTHER_BUILD],
  [33, TEST_BUILD],
]);

describe('115d — the journal across a load', () => {
  const straight = driveRun({ start: START, choiceSeed: 2 });
  const across = driveRun({
    start: START,
    choiceSeed: 2,
    reloadAt: (gate) => {
      const build = RELOADS.get(gate);
      return build === undefined ? null : { build };
    },
  });
  const journal = asFile(across.journal);

  it('records one segment per sitting, each load resumed or restarted from the snapshot by build', () => {
    expect(['defeat', 'complete']).toContain(straight.run.phase);
    expect(across.battles).toBe(straight.battles);
    expect(bytes(across.run)).toBe(bytes(straight.run));
    expect(journal.segments.map((s) => s.start.kind)).toEqual([
      'seed',
      'resume',
      'resume',
      'snapshot',
      'resume',
      'snapshot',
    ]);
    expect(journal.segments.map((s) => s.build)).toEqual([
      TEST_BUILD,
      TEST_BUILD,
      TEST_BUILD,
      OTHER_BUILD,
      OTHER_BUILD,
      TEST_BUILD,
    ]);
    expect(journal.segments.slice(0, -1).map((s) => s.end?.reason)).toEqual(Array(5).fill('saved'));
    expect(['defeat', 'victory']).toContain(journal.segments.at(-1)!.end?.reason);
    // Each resume starts from the hash the segment before was saved at.
    journal.segments.forEach((s, i) => {
      if (s.start.kind === 'resume') expect(s.start.hash).toBe(journal.segments[i - 1]!.end!.hash);
    });
  });

  it('replays to the bytes of the run played straight through', () => {
    const replay = replayJournal(journal);
    expect(replay.segments).toHaveLength(6);
    expect(replay.segments.every((s) => !s.open)).toBe(true);
    expect(replay.segments.reduce((n, s) => n + s.battles, 0)).toBe(straight.battles);
    expect(bytes(replay.segments.at(-1)!.run)).toBe(bytes(straight.run));
  });

  /** A copy of the journal with its segments edited. */
  const edited = (edit: (segments: JournalSegment[]) => void): RunJournal => {
    const file = asFile(journal);
    edit(file.segments as JournalSegment[]);
    return file;
  };

  describe('controls', () => {

    it('a resume from a changed hash is refused, naming the segment', () => {
      const file = edited((segments) => {
        segments[1] = { ...segments[1]!, start: { kind: 'resume', hash: 'deadbeef', dials: START.dials } };
      });
      expect(() => replayJournal(file)).toThrow(JournalRefused);
      expect(() => replayJournal(file)).toThrow('segment 1: it resumes from hash deadbeef');
    });

    it('a resume after a segment recorded on another build is refused', () => {
      // Segment 1 resumes after segment 0; stamped with another build, it
      // could not have loaded the save that way.
      const file = edited((segments) => {
        segments[1] = { ...segments[1]!, build: OTHER_BUILD };
      });
      expect(() => replayJournal(file)).toThrow(
        `segment 1: it resumes, and segment 0 was recorded on build ${TEST_BUILD}`,
      );
    });
  });

  describe("the recorder's resume", () => {
    // The state the finished run ended in, as a save would hold it.
    const snapshot = JSON.parse(JSON.stringify(across.run.toJSON())) as ReturnType<Run['toJSON']>;
    const loadInto = (saved: RunJournal | null) => {
      const recorder = new JournalRecorder(
        new EventBus<GameEvents>(),
        { build: TEST_BUILD, configHash: configHash() },
        () => 0,
        () => undefined,
      );
      const kind = recorder.resume(saved, snapshot, '', () => snapshot);
      return { kind, journal: recorder.journal! };
    };

    it('starts over from the snapshot when the saved journal does not end saved at its hash', () => {
      const none = loadInto(null);
      expect(none.kind).toBe('snapshot');
      expect(none.journal.segments).toHaveLength(1);
      // The finished journal ends in defeat or victory, not saved.
      const finished = loadInto(journal);
      expect(finished.kind).toBe('snapshot');
      expect(finished.journal.segments).toHaveLength(1);
    });

    it('carries the segments of a journal saved at this snapshot', () => {
      const saved = edited((segments) => {
        segments[5] = { ...segments[5]!, end: { reason: 'saved', ms: 0, hash: snapshotHash(snapshot) } };
      });
      const resumed = loadInto(saved);
      expect(resumed.kind).toBe('resume');
      expect(resumed.journal.segments).toHaveLength(7);
      expect(resumed.journal.segments[6]!.start).toEqual({ kind: 'resume', hash: snapshotHash(snapshot), dials: '' });
    });
  });
});
