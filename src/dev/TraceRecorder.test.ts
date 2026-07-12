import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { BattleEncounter } from '../run/Run';
import { TraceRecorder, type BattleTrace } from './TraceRecorder';
import { configHash } from './configHash';

function makeEncounter(worldSeed: number): BattleEncounter {
  return {
    worldSeed,
    terrainSeed: worldSeed + 1,
    layoutId: null,
    gridW: 10,
    gridH: 10,
    theme: 'grassland',
    playerTeam: [],
    enemyTeam: [],
  };
}

function setup(): { bus: EventBus<GameEvents>; traces: BattleTrace[]; recorder: TraceRecorder } {
  const bus = new EventBus<GameEvents>();
  const traces: BattleTrace[] = [];
  const recorder = new TraceRecorder(bus, (t) => traces.push(t));
  return { bus, traces, recorder };
}

const HOLD = { kind: 'setObjective', team: 'player', objective: { mode: 'hold' } } as const;

describe('TraceRecorder (53b)', () => {
  it('assembles a full trace: encounter + stamped commands + outcome', () => {
    const { bus, traces } = setup();
    const encounter = makeEncounter(42);

    bus.emit('battle:started', { worldSeed: 42, encounter });
    bus.emit('tick', { tick: 1 });
    bus.emit('command:applied', { tick: 1, command: HOLD });
    bus.emit('tick', { tick: 2 });
    bus.emit('tick', { tick: 3 });
    bus.emit('command:applied', { tick: 3, command: { kind: 'clearObjective', team: 'player' } });
    bus.emit('battle:ended', { winner: 'player', xpAwards: [] });

    expect(traces).toHaveLength(1);
    const trace = traces[0]!;
    expect(trace.version).toBe(1);
    expect(trace.configHash).toBe(configHash());
    expect(trace.encounter).toEqual(encounter);
    expect(trace.commands).toEqual([
      { tick: 1, command: HOLD },
      { tick: 3, command: { kind: 'clearObjective', team: 'player' } },
    ]);
    expect(trace.outcome).toEqual({ winner: 'player', ticks: 3 });
  });

  it('pins the encounter at record time (a later mutation of the source object is invisible)', () => {
    const { bus, traces } = setup();
    const encounter = makeEncounter(7);
    bus.emit('battle:started', { worldSeed: 7, encounter });
    (encounter as { gridW: number }).gridW = 999; // the Run moving on to another turn
    bus.emit('battle:ended', { winner: 'draw', xpAwards: [] });
    expect(traces[0]?.encounter.gridW).toBe(10);
  });

  it('a second battle:started discards the open (abandoned) trace', () => {
    const { bus, traces } = setup();
    bus.emit('battle:started', { worldSeed: 1, encounter: makeEncounter(1) });
    bus.emit('tick', { tick: 1 });
    bus.emit('command:applied', { tick: 1, command: HOLD });
    // Abandoned (e.g. resetRun) — no battle:ended. A new battle begins:
    bus.emit('battle:started', { worldSeed: 2, encounter: makeEncounter(2) });
    bus.emit('tick', { tick: 1 });
    bus.emit('battle:ended', { winner: 'enemy', xpAwards: [] });

    expect(traces).toHaveLength(1);
    expect(traces[0]?.encounter.worldSeed).toBe(2);
    expect(traces[0]?.commands).toEqual([]); // the abandoned battle's command didn't leak
  });

  it('battle:ended with no open trace is ignored (synthetic test-fixture ends)', () => {
    const { bus, traces } = setup();
    bus.emit('battle:ended', { winner: 'player', xpAwards: [] });
    expect(traces).toEqual([]);
  });

  it('records one trace per battle across consecutive battles', () => {
    const { bus, traces } = setup();
    for (const seed of [10, 20]) {
      bus.emit('battle:started', { worldSeed: seed, encounter: makeEncounter(seed) });
      bus.emit('tick', { tick: 1 });
      bus.emit('battle:ended', { winner: 'draw', xpAwards: [] });
    }
    expect(traces.map((t) => t.encounter.worldSeed)).toEqual([10, 20]);
  });

  it('dispose unsubscribes — later battles are not recorded', () => {
    const { bus, traces, recorder } = setup();
    recorder.dispose();
    bus.emit('battle:started', { worldSeed: 1, encounter: makeEncounter(1) });
    bus.emit('battle:ended', { winner: 'player', xpAwards: [] });
    expect(traces).toEqual([]);
  });
});
