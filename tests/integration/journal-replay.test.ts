import { describe, expect, it } from 'vitest';
import type { JournalEntry, JournalSegment, RunJournal } from '../../src/journal/journal';
import { JournalDivergence, JournalRefused, replayJournal } from '../../src/journal/replayJournal';
import { asFile, bytes, driveRun, expectSameReplay, replayPlants as plants, type Plants } from '../journalDrive';

// Record a whole gated run, replay its journal, and compare the two Runs'
// saved state byte for byte (the phase's exit). The journal goes through JSON
// text first, as an exported file does. The run at the shipped length is in
// journal-replay-full.test.ts, so the two files run side by side.

/** A copy of the journal with its one segment's entries rewritten. */
function withEntries(journal: RunJournal, edit: (entries: JournalEntry[]) => JournalEntry[]): RunJournal {
  const segment = journal.segments[0]!;
  return { ...journal, segments: [{ ...segment, entries: edit([...segment.entries]) }] };
}
const withSegment = (journal: RunJournal, patch: Partial<JournalSegment>): RunJournal => ({
  ...journal,
  segments: [{ ...journal.segments[0]!, ...patch }],
});

const SHORT = { kind: 'seed', seed: 7, dials: 'hops=3&character=soldier' } as const;

describe('record, replay, compare', () => {
  const cases = [
    SHORT,
    { kind: 'seed', seed: 11, dials: 'hops=4&character=priest' },
    { kind: 'seed', seed: 23, dials: 'sectorHops=3&character=gambler' },
  ] as const;

  let discarded = 0;
  for (const start of cases) {
    it(`seed ${start.seed} (${start.dials}) replays to the same bytes`, () => {
      discarded += expectSameReplay(start).discards;
    }, 30_000);
  }

  it('the mid-battle discard was a real one in at least one of those runs', () => {
    // A discard from an empty cache is a no-op the replay could misplace unseen.
    expect(discarded).toBeGreaterThan(0);
  });

  it('a run abandoned in mid-battle replays to the state it was left in', () => {
    const recorded = driveRun({ start: SHORT, plants: { ...plants(), abandonAt: { battle: 2, tick: 150 } } });
    expect(recorded.abandoned).toBe(true);
    const replay = replayJournal(asFile(recorded.journal)).segments[0]!;
    expect(replay.battles).toBe(2);
    expect(bytes(replay.run)).toBe(bytes(recorded.run));
  });

  it('a segment started from a snapshot replays', () => {
    // Play to the map after the third battle, save there, and continue from the save.
    const first = driveRun({
      start: SHORT,
      plants: { ...plants(), abandonWhen: (run, battles) => battles >= 3 && run.phase === 'map' },
    });
    expect(first.abandoned).toBe(true);
    const snapshot = first.run.toJSON();
    expect(snapshot.phase).toBe('map');

    // Loaded without its dials, the run has the shipped length, so
    // the continuation is left at the map three battles on.
    const start = { kind: 'snapshot', snapshot, dials: '' } as const;
    const recorded = driveRun({
      start,
      choiceSeed: 3,
      plants: { ...plants(), abandonWhen: (run, battles) => battles >= 3 && run.phase === 'map' },
    });
    expect(recorded.battles).toBeGreaterThanOrEqual(3);
    const journal = asFile(recorded.journal);
    expect(journal.segments[0]!.start.kind).toBe('snapshot');
    const replay = replayJournal(journal).segments[0]!;
    expect(replay.battles).toBe(recorded.battles);
    expect(bytes(replay.run)).toBe(bytes(recorded.run));
    // The first half replays on its own too, to the snapshot the second began from.
    expect(bytes(replayJournal(asFile(first.journal)).segments[0]!.run)).toBe(JSON.stringify(snapshot));
  });

  it('a journal still being played replays as far as it goes', () => {
    const recorded = driveRun({ start: SHORT, plants: plants() });
    const open = withSegment(asFile(recorded.journal), { end: null });
    const replay = replayJournal(open).segments[0]!;
    expect(replay.open).toBe(true);
    expect(bytes(replay.run)).toBe(bytes(recorded.run));
  });
});

describe('the controls: a journal that was changed does not replay', () => {
  const recorded = driveRun({ start: SHORT, plants: plants() });
  const journal = asFile(recorded.journal);
  const entries = journal.segments[0]!.entries;

  it('the journal as recorded does (the baseline the controls differ from)', () => {
    expect(() => replayJournal(journal)).not.toThrow();
  });

  it('a run command dropped: the replay stops at the entry that no longer fits', () => {
    // The first Fight: without it the first order has no battle.
    const fight = entries.findIndex((e) => e.t === 'run' && e.command.kind === 'advanceTurn');
    const dropped = withEntries(journal, (list) => list.filter((_, i) => i !== fight));
    expect(() => replayJournal(dropped)).toThrow(JournalDivergence);
    expect(() => replayJournal(dropped)).toThrow(
      `segment 0, battle 1, entry ${fight}: the journal has an order for tick 1, and the replay is not in a battle`,
    );
  });

  it('a battle order dropped: the replay diverges', () => {
    const order = entries.findIndex((e) => e.t === 'order' && e.tick === 1);
    const dropped = withEntries(journal, (list) => list.filter((_, i) => i !== order));
    expect(() => replayJournal(dropped)).toThrow(JournalDivergence);
  });

  it('a battle order’s tick moved: the replay diverges', () => {
    const order = entries.findIndex((e) => e.t === 'order' && e.tick === 6);
    const moved = withEntries(journal, (list) =>
      list.map((e, i) => (i === order && e.t === 'order' ? { ...e, tick: 30 } : e)),
    );
    expect(() => replayJournal(moved)).toThrow(JournalDivergence);
  });

  it('a checkpoint’s tick moved: the replay names that battle', () => {
    const checkpoints = entries.flatMap((e, i) => (e.t === 'battle' ? [i] : []));
    const third = checkpoints[2]!;
    const moved = withEntries(journal, (list) =>
      list.map((e, i) => (i === third && e.t === 'battle' ? { ...e, ticks: e.ticks + 1 } : e)),
    );
    const was = entries[third]!;
    const ticks = was.t === 'battle' ? was.ticks : -1;
    expect(() => replayJournal(moved)).toThrow(
      new RegExp(`segment 0, battle 3, entry ${third}: the journal's battle ended \\w+ after ${ticks + 1} ticks, and the replay's ended \\w+ after ${ticks}$`),
    );
  });

  it('the final hash changed: the replay reaches the end and says so', () => {
    const end = { ...journal.segments[0]!.end!, hash: '00000000' };
    expect(() => replayJournal(withSegment(journal, { end }))).toThrow(
      /segment 0, battle \d+, the end: the journal's final snapshot hash is 00000000, and the replay's is [0-9a-f]{8}$/,
    );
  });

  it('an abandoned end’s tick moved: the Run’s state depends on where the battle stood', () => {
    // Abandon the third battle one tick before the tick it ended on.
    const third = entries.filter((e) => e.t === 'battle')[2]!;
    const last = (third.t === 'battle' ? third.ticks : 0) - 1;
    const abandonAt = (tick: number): Plants => ({ ...plants(), abandonAt: { battle: 2, tick } });
    const late = driveRun({ start: SHORT, plants: abandonAt(last) });
    const early = driveRun({ start: SHORT, plants: abandonAt(20) });
    // The premise: units fell in between, and the Run's ledger holds them.
    expect(late.run.fallenLedger.length).toBeGreaterThan(early.run.fallenLedger.length);

    const abandoned = asFile(late.journal);
    expect(abandoned.segments[0]!.end!.tick).toBe(last);
    expect(() => replayJournal(abandoned)).not.toThrow();
    const end = { ...abandoned.segments[0]!.end!, tick: 20 };
    expect(() => replayJournal(withSegment(abandoned, { end }))).toThrow(
      /the end: the journal's final snapshot hash is [0-9a-f]{8}, and the replay's is [0-9a-f]{8}$/,
    );
  });

  it('another config hash is refused before anything is replayed', () => {
    const other = withSegment(journal, { configHash: 'ffffffff' });
    expect(() => replayJournal(other)).toThrow(JournalRefused);
    expect(() => replayJournal(other)).toThrow(/recorded under config ffffffff/);
  });

  it('another format is refused', () => {
    // Format 1, the journal before 115d's resume start and saved end.
    const other = { ...journal, format: 1 } as unknown as RunJournal;
    expect(() => replayJournal(other)).toThrow(JournalRefused);
  });
});
