import { describe, expect, it } from 'vitest';
import { configHash } from '../../src/config/configHash';
import { JOURNAL_FORMAT, snapshotHash, type JournalEntry } from '../../src/journal/journal';
import type { WorldCommand } from '../../src/sim/Command';
import { driveRun, TEST_BUILD, type Plants } from '../journalDrive';

// The journal recorded from a whole gated run (Round 8 spec D4). The plants
// decide what the journal should hold, so each expectation is counted on the
// driver's side and compared with what the recorder wrote.

const START = { kind: 'seed', seed: 7, dials: 'hops=3&character=soldier' } as const;
const HOLD: WorldCommand = { kind: 'setObjective', team: 'player', objective: { mode: 'hold' } };
const CLEAR: WorldCommand = { kind: 'clearObjective', team: 'player' };

/** An order parked before tick 1 and another in tick 6's drain, every battle. */
function ordersAt1And6(planted: { battle: number; tick: number }[]): Plants {
  return {
    orders: (battle, tick) => {
      if (tick !== 1 && tick !== 6) return [];
      planted.push({ battle, tick });
      return [tick === 1 ? HOLD : CLEAR];
    },
    parked: (_battle, tick) => tick === 1,
  };
}

const withoutMs = (entries: readonly JournalEntry[]): unknown[] =>
  entries.map((e) => {
    if (e.t !== 'run') return e;
    const { ms: _ms, ...rest } = e;
    return rest;
  });

describe('a gated headless run, recorded', () => {
  it('holds the stamp, the start, every battle with its orders in place, and the end', () => {
    const planted: { battle: number; tick: number }[] = [];
    const { journal, closes, run, battles, abandoned } = driveRun({ start: START, plants: ordersAt1And6(planted) });

    expect(abandoned).toBe(false);
    expect(closes).toBe(1);
    expect(battles).toBeGreaterThan(1);
    expect(journal!.format).toBe(JOURNAL_FORMAT);
    expect(journal!.segments).toHaveLength(1);
    const segment = journal!.segments[0]!;
    expect(segment.build).toBe(TEST_BUILD);
    expect(segment.configHash).toBe(configHash());
    expect(segment.start).toEqual(START);

    // Walk the entries battle by battle: the command that starts a battle,
    // then its orders at the planted ticks, then its checkpoint.
    const entries = segment.entries;
    const checkpoints = entries.flatMap((e, i) => (e.t === 'battle' ? [i] : []));
    expect(checkpoints).toHaveLength(battles);
    checkpoints.forEach((at, battle) => {
      const checkpoint = entries[at]!;
      const ticks = checkpoint.t === 'battle' ? checkpoint.ticks : -1;
      const want = planted.filter((p) => p.battle === battle).map((p) => p.tick);
      expect(want.length, `battle ${battle} ran long enough for both plants`).toBe(2);
      expect(ticks).toBeGreaterThanOrEqual(6);
      expect(withoutMs(entries.slice(at - 3, at))).toEqual([
        { t: 'run', command: { kind: 'advanceTurn' } },
        { t: 'order', tick: 1, command: HOLD },
        { t: 'order', tick: 6, command: CLEAR },
      ]);
    });
    expect(entries.filter((e) => e.t === 'order')).toHaveLength(planted.length);
    // Outside a battle no command carries a tick.
    expect(entries.every((e) => e.t !== 'run' || e.tick === undefined)).toBe(true);
    // The wall clock only ever counts up.
    const ms = entries.flatMap((e) => (e.t === 'run' ? [e.ms] : []));
    expect(ms).toEqual([...ms].sort((a, b) => a - b));

    expect(['defeat', 'complete']).toContain(run.phase);
    expect(segment.end).toEqual({
      reason: run.phase === 'defeat' ? 'defeat' : 'victory',
      ms: segment.end!.ms,
      hash: snapshotHash(run.toJSON()),
    });
    expect(segment.end!.ms).toBeGreaterThanOrEqual(ms.at(-1)!);
  });

  it('places a mid-battle discardPacket between the orders around it', () => {
    const planted: { battle: number; tick: number }[] = [];
    const { journal } = driveRun({
      start: START,
      plants: {
        ...ordersAt1And6(planted),
        commands: (battle, tick) => (battle === 0 && tick === 3 ? [{ kind: 'discardPacket', cacheIndex: 0 }] : []),
      },
    });
    const entries = journal!.segments[0]!.entries;
    const first = entries.findIndex((e) => e.t === 'battle');
    expect(withoutMs(entries.slice(first - 4, first))).toEqual([
      { t: 'run', command: { kind: 'advanceTurn' } },
      { t: 'order', tick: 1, command: HOLD },
      { t: 'run', tick: 3, command: { kind: 'discardPacket', cacheIndex: 0 } },
      { t: 'order', tick: 6, command: CLEAR },
    ]);
    // It is the only command the journal places inside a battle.
    expect(entries.filter((e) => e.t === 'run' && e.tick !== undefined)).toHaveLength(1);
  });

  it('a reset in mid-battle closes the journal there', () => {
    const planted: { battle: number; tick: number }[] = [];
    const { journal, closes, run, battles, abandoned } = driveRun({
      start: START,
      plants: { ...ordersAt1And6(planted), abandonAt: { battle: 1, tick: 4 } },
    });
    expect(abandoned).toBe(true);
    expect(closes).toBe(1);
    expect(battles).toBe(2);
    const segment = journal!.segments[0]!;
    expect(segment.end).toEqual({
      reason: 'abandoned',
      ms: segment.end!.ms,
      tick: 4,
      hash: snapshotHash(run.toJSON()),
    });
    // The first battle is whole; the second has its parked order and no checkpoint.
    expect(segment.entries.filter((e) => e.t === 'battle')).toHaveLength(1);
    expect(withoutMs(segment.entries.slice(-2))).toEqual([
      { t: 'run', command: { kind: 'advanceTurn' } },
      { t: 'order', tick: 1, command: HOLD },
    ]);
  });

  it('recording changes nothing: the same run with no recorder ends in the same state', () => {
    const plants = ordersAt1And6([]);
    const recorded = driveRun({ start: START, plants });
    const bare = driveRun({ start: START, plants, record: false });
    expect(bare.journal).toBeNull();
    expect(JSON.stringify(bare.run.toJSON())).toBe(JSON.stringify(recorded.run.toJSON()));
    // The control: the orders themselves do change the run, so the comparison can fail.
    const noOrders = driveRun({ start: START, record: false });
    expect(JSON.stringify(noOrders.run.toJSON())).not.toBe(JSON.stringify(bare.run.toJSON()));
  });
});
