import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { BattleEncounter, RunSnapshot } from '../run/Run';
import type { UnitTemplate } from '../sim/Unit';
import { JournalRecorder } from './JournalRecorder';
import { JOURNAL_FORMAT, snapshotHash, type JournalEntry, type RunJournal } from './journal';

const STAMP = { build: '0.1.0+abc1234', configHash: 'deadbeef' };
const START = { kind: 'seed', seed: 7, dials: 'character=soldier' } as const;
const HOLD = { kind: 'setObjective', team: 'player', objective: { mode: 'hold' } } as const;
const ENCOUNTER = {} as BattleEncounter;

/** A stand-in for the Run's saved state: the recorder only hashes it. */
const snap = (label: string): RunSnapshot => ({ label }) as unknown as RunSnapshot;

function setup(): {
  bus: EventBus<GameEvents>;
  recorder: JournalRecorder;
  closed: RunJournal[];
  clock: { t: number };
  state: { label: string };
} {
  const bus = new EventBus<GameEvents>();
  const closed: RunJournal[] = [];
  const clock = { t: 5000 };
  const state = { label: 'start' };
  const recorder = new JournalRecorder(bus, STAMP, () => clock.t, (j) => closed.push(j));
  return { bus, recorder, closed, clock, state };
}

/** The entries without their wall-clock field. */
const shape = (entries: readonly JournalEntry[]): unknown[] =>
  entries.map((e) => {
    if (e.t !== 'run') return e;
    const { ms: _ms, ...rest } = e;
    return rest;
  });

describe('JournalRecorder', () => {
  it('stamps the segment and keeps the start it was opened with', () => {
    const { recorder, clock, state } = setup();
    clock.t = 7000;
    recorder.open(START, () => snap(state.label));
    expect(recorder.journal).toEqual({
      format: JOURNAL_FORMAT,
      segments: [{ ...STAMP, openedAt: 7000, start: START, entries: [], end: null }],
    });
  });

  it('keeps the order of entries around a battle', () => {
    const { bus, recorder, state } = setup();
    recorder.open(START, () => snap(state.label));
    recorder.command({ kind: 'enterNode', nodeId: 0 });
    recorder.command({ kind: 'advanceTurn' });
    bus.emit('battle:started', { worldSeed: 1, encounter: ENCOUNTER });
    // A parked order is applied before the tick it is stamped with runs.
    bus.emit('command:applied', { tick: 1, command: HOLD });
    bus.emit('tick', { tick: 1 });
    bus.emit('tick', { tick: 2 });
    bus.emit('tick', { tick: 3 });
    bus.emit('command:applied', { tick: 3, command: { kind: 'clearObjective', team: 'player' } });
    bus.emit('battle:ended', { winner: 'draw', xpAwards: [] });
    recorder.command({ kind: 'advanceTurn' });

    expect(shape(recorder.journal!.segments[0]!.entries)).toEqual([
      { t: 'run', command: { kind: 'enterNode', nodeId: 0 } },
      { t: 'run', command: { kind: 'advanceTurn' } },
      { t: 'order', tick: 1, command: HOLD },
      { t: 'order', tick: 3, command: { kind: 'clearObjective', team: 'player' } },
      { t: 'battle', winner: 'draw', ticks: 3 },
      { t: 'run', command: { kind: 'advanceTurn' } },
    ]);
  });

  it('places a run command sent during a battle after the last tick that ran', () => {
    const { bus, recorder, state } = setup();
    recorder.open(START, () => snap(state.label));
    recorder.command({ kind: 'discardPacket', cacheIndex: 0 });
    bus.emit('battle:started', { worldSeed: 1, encounter: ENCOUNTER });
    recorder.command({ kind: 'discardPacket', cacheIndex: 1 });
    bus.emit('tick', { tick: 1 });
    bus.emit('tick', { tick: 2 });
    recorder.command({ kind: 'discardPacket', cacheIndex: 2 });
    bus.emit('battle:ended', { winner: 'player', xpAwards: [] });
    recorder.command({ kind: 'discardPacket', cacheIndex: 3 });

    expect(shape(recorder.journal!.segments[0]!.entries)).toEqual([
      { t: 'run', command: { kind: 'discardPacket', cacheIndex: 0 } },
      { t: 'run', tick: 0, command: { kind: 'discardPacket', cacheIndex: 1 } },
      { t: 'run', tick: 2, command: { kind: 'discardPacket', cacheIndex: 2 } },
      { t: 'battle', winner: 'player', ticks: 2 },
      { t: 'run', command: { kind: 'discardPacket', cacheIndex: 3 } },
    ]);
  });

  it('counts each command’s milliseconds from the segment’s opening', () => {
    const { recorder, clock, state } = setup();
    clock.t = 10_000;
    recorder.open(START, () => snap(state.label));
    clock.t = 10_250.4;
    recorder.command({ kind: 'advanceTurn' });
    clock.t = 13_000;
    recorder.command({ kind: 'advanceTurn' });
    expect(recorder.journal!.segments[0]!.entries.map((e) => (e.t === 'run' ? e.ms : null))).toEqual([250, 3000]);
  });

  it('copies a command, so the Run changing the object later leaves the entry alone', () => {
    const { recorder, state } = setup();
    recorder.open(START, () => snap(state.label));
    const template = { archetype: 'archer', level: 2 } as unknown as UnitTemplate;
    recorder.command({ kind: 'chooseRecruit', unitTemplate: template });
    (template as { level: number }).level = 9;
    const entry = recorder.journal!.segments[0]!.entries[0]!;
    expect(entry.t === 'run' && entry.command).toEqual({
      kind: 'chooseRecruit',
      unitTemplate: { archetype: 'archer', level: 2 },
    });
  });

  it('closes at the settle after the run ends, with the state as it is then', () => {
    const { bus, recorder, closed, clock, state } = setup();
    recorder.open(START, () => snap(state.label));
    recorder.command({ kind: 'advanceTurn' });
    bus.emit('run:defeated', {});
    // The Run is still inside its dispatch here: nothing is closed yet.
    expect(closed).toEqual([]);
    state.label = 'settled';
    clock.t = 5900;
    recorder.settle();

    expect(closed).toHaveLength(1);
    expect(closed[0]!.segments[0]!.end).toEqual({ reason: 'defeat', ms: 900, hash: snapshotHash(snap('settled')) });
    // The control: the hash is the settled state's, not the state at the emit.
    expect(snapshotHash(snap('settled'))).not.toBe(snapshotHash(snap('start')));
    expect(recorder.journal).toBeNull();
    recorder.settle();
    expect(closed).toHaveLength(1);
  });

  it('a settle with the run still going closes nothing; a victory closes as one', () => {
    const { bus, recorder, closed, state } = setup();
    recorder.open(START, () => snap(state.label));
    recorder.command({ kind: 'advanceTurn' });
    recorder.settle();
    expect(closed).toEqual([]);
    bus.emit('run:victory', {});
    recorder.settle();
    expect(closed[0]!.segments[0]!.end?.reason).toBe('victory');
  });

  it('a reset closes the journal as abandoned, with the tick when a battle was on', () => {
    const { bus, recorder, closed, state } = setup();
    recorder.open(START, () => snap(state.label));
    recorder.command({ kind: 'advanceTurn' });
    bus.emit('battle:started', { worldSeed: 1, encounter: ENCOUNTER });
    bus.emit('tick', { tick: 1 });
    bus.emit('tick', { tick: 2 });
    state.label = 'mid-battle';
    recorder.abandon();

    expect(closed).toHaveLength(1);
    const segment = closed[0]!.segments[0]!;
    expect(segment.end).toEqual({ reason: 'abandoned', ms: 0, tick: 2, hash: snapshotHash(snap('mid-battle')) });
    expect(segment.entries).toHaveLength(1);
    // Closed: the battle's later events and a later command reach nothing.
    bus.emit('tick', { tick: 3 });
    bus.emit('battle:ended', { winner: 'enemy', xpAwards: [] });
    recorder.command({ kind: 'advanceTurn' });
    recorder.abandon();
    expect(closed).toHaveLength(1);
    expect(segment.entries).toHaveLength(1);
    expect(recorder.journal).toBeNull();
  });

  it('outside a battle an abandoned end carries no tick', () => {
    const { recorder, closed, state } = setup();
    recorder.open(START, () => snap(state.label));
    recorder.abandon();
    expect(closed[0]!.segments[0]!.end).toEqual({ reason: 'abandoned', ms: 0, hash: snapshotHash(snap('start')) });
  });

  it('opening over an open journal abandons it first, and the new one starts clean', () => {
    const { bus, recorder, closed, state } = setup();
    recorder.open(START, () => snap('first'));
    recorder.command({ kind: 'advanceTurn' });
    bus.emit('battle:started', { worldSeed: 1, encounter: ENCOUNTER });
    bus.emit('tick', { tick: 1 });
    recorder.open({ kind: 'snapshot', snapshot: snap('loaded') }, () => snap(state.label));

    expect(closed).toHaveLength(1);
    expect(closed[0]!.segments[0]!.end).toEqual({ reason: 'abandoned', ms: 0, tick: 1, hash: snapshotHash(snap('first')) });
    expect(recorder.journal!.segments[0]!.start).toEqual({ kind: 'snapshot', snapshot: { label: 'loaded' } });
    // The old battle's tick did not leak into the new journal.
    recorder.command({ kind: 'advanceTurn' });
    expect(shape(recorder.journal!.segments[0]!.entries)).toEqual([{ t: 'run', command: { kind: 'advanceTurn' } }]);
  });

  it('with no journal open, commands and bus events record nothing', () => {
    const { bus, recorder, closed } = setup();
    recorder.command({ kind: 'advanceTurn' });
    bus.emit('battle:started', { worldSeed: 1, encounter: ENCOUNTER });
    bus.emit('command:applied', { tick: 1, command: HOLD });
    bus.emit('battle:ended', { winner: 'player', xpAwards: [] });
    bus.emit('run:defeated', {});
    recorder.settle();
    recorder.abandon();
    expect(recorder.journal).toBeNull();
    expect(closed).toEqual([]);
  });

  it('a battle end with no battle open is ignored (a synthetic emit)', () => {
    const { bus, recorder, state } = setup();
    recorder.open(START, () => snap(state.label));
    bus.emit('battle:ended', { winner: 'player', xpAwards: [] });
    bus.emit('command:applied', { tick: 4, command: HOLD });
    expect(recorder.journal!.segments[0]!.entries).toEqual([]);
  });

  it('dispose unsubscribes and reports nothing', () => {
    const { bus, recorder, closed, state } = setup();
    recorder.open(START, () => snap(state.label));
    recorder.dispose();
    bus.emit('run:defeated', {});
    recorder.settle();
    expect(closed).toEqual([]);
    expect(recorder.journal).toBeNull();
  });
});
