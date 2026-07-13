import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { RNG } from '../core/RNG';
import { World } from '../sim/World';
import { spawnEncounter } from '../sim/battleSetup';
import { rollUnit } from '../sim/archetypes';
import type { BattleEncounter } from '../run/Run';
import { TraceRecorder, type BattleTrace } from './TraceRecorder';
import { replayTrace } from './replayTrace';
import { secondsToTicks } from '../config';
import { HEALTH } from '../config/health';

/**
 * 53c — THE fidelity keystone: a battle recorded live (including commands
 * issued at a pre-battle parked drain, a normal between-ticks enqueue, and a
 * mid-battle parked drain) must replay byte-identically from its trace alone.
 */

/** Ordered (name, payload-JSON) capture over a fixed event subset — the
 *  determinism-test pattern. Payloads stringified at capture time so later
 *  mutation can't alias. `battle:started` is deliberately absent (the live
 *  drive emits it for the recorder; the replay never does), and so is the
 *  bare `tick` marker: a live PARKED drain emits its command markers BETWEEN
 *  tick markers, while the replay applies the same commands inside tick E's
 *  drain (after the marker) — a pure bus-interleaving difference with zero
 *  unit-observable effect. Unit-observable identity is what the final
 *  world-state oracle (`toJSON` byte compare, which includes tickCount and
 *  the full RNG state) and `result.ticks` pin exactly. */
const CAPTURED = [
  'command:applied',
  'objective:set',
  'objective:cleared',
  'unit:spawned',
  'unit:moved',
  'unit:attacked',
  'unit:died',
  'action:phase',
  'battle:ended',
] as const;

function captureEvents(bus: EventBus<GameEvents>): string[] {
  const log: string[] = [];
  for (const name of CAPTURED) {
    bus.on(name, (payload) => log.push(`${name} ${JSON.stringify(payload)}`));
  }
  return log;
}

function makeEncounter(): BattleEncounter {
  const rosterRng = new RNG(5);
  return {
    worldSeed: 123,
    terrainSeed: 456,
    layoutId: null,
    gridW: 12,
    gridH: 12,
    theme: 'grassland',
    playerTeam: [
      rollUnit('mercenary', rosterRng),
      rollUnit('mercenary', rosterRng),
      rollUnit('ranged', rosterRng),
    ],
    enemyTeam: [
      rollUnit('mercenary', rosterRng),
      rollUnit('mercenary', rosterRng),
      rollUnit('ranged', rosterRng),
    ],
    battleRules: [],
  };
}

/**
 * Drive the encounter live, the BattleScene way (tick while alive, draw at
 * the cap), issuing commands through all three real input timings. Returns
 * everything the fidelity assertions need.
 */
function driveLive(encounter: BattleEncounter): {
  trace: BattleTrace;
  events: string[];
  world: World;
} {
  const bus = new EventBus<GameEvents>();
  const events = captureEvents(bus);
  const traces: BattleTrace[] = [];
  new TraceRecorder(bus, (t) => traces.push(t));

  bus.emit('battle:started', { worldSeed: encounter.worldSeed, encounter });
  const world = new World(bus, new RNG(encounter.worldSeed), encounter.gridW, encounter.gridH);
  world.installBattleRules(encounter.battleRules ?? []);
  spawnEncounter(world, encounter);

  const enemyId = world.units.find((u) => u.team === 'enemy')?.id;
  if (enemyId === undefined) throw new Error('fixture: no enemy spawned');

  // 1. The countdown case — an order placed while parked, before any tick.
  world.enqueueCommand({ kind: 'setObjective', team: 'player', objective: { mode: 'hold' } });
  world.drainCommands(); // stamps effective tick 1

  const maxTurnTicks = secondsToTicks(HEALTH.maxTurnSeconds);
  while (!world.ended) {
    // 2. A normal between-ticks enqueue — applies at tick 10's in-tick drain.
    if (world.currentTick === 9) {
      world.enqueueCommand({
        kind: 'setObjective',
        team: 'player',
        objective: { mode: 'engage', target: { kind: 'enemy', unitId: enemyId } },
      });
    }
    world.tick();
    // 3. A mid-battle PAUSE — parked drain after tick 25 ran; stamps 26.
    if (world.currentTick === 25 && !world.ended) {
      world.enqueueCommand({ kind: 'clearObjective', team: 'player' });
      world.drainCommands();
    }
    if (!world.ended && world.currentTick >= maxTurnTicks) world.resolveAsDraw();
  }

  expect(world.currentTick).toBeGreaterThan(26); // all three injections landed pre-end
  expect(traces).toHaveLength(1);
  return { trace: traces[0]!, events, world };
}

describe('replayTrace (53c — the fidelity keystone)', () => {
  it('a recorded battle replays byte-identically: outcome, event trace, final world state', () => {
    const encounter = makeEncounter();
    const live = driveLive(encounter);

    // The three input timings landed with their effective-tick stamps.
    expect(live.trace.commands.map((c) => c.tick)).toEqual([1, 10, 26]);

    const replayBus = new EventBus<GameEvents>();
    const replayEvents = captureEvents(replayBus);
    const result = replayTrace(live.trace, replayBus);

    expect(result.winner).toBe(live.trace.outcome.winner);
    expect(result.ticks).toBe(live.trace.outcome.ticks);
    // Byte-identical event trace — the determinism contract, end to end.
    expect(replayEvents).toEqual(live.events);
    // Byte-identical final world state.
    expect(JSON.stringify(result.world.toJSON())).toBe(JSON.stringify(live.world.toJSON()));
  });

  it('a command-less trace replays identically too (the --objective=none / passive-human case)', () => {
    const encounter = makeEncounter();
    const bus = new EventBus<GameEvents>();
    const events = captureEvents(bus);
    const traces: BattleTrace[] = [];
    new TraceRecorder(bus, (t) => traces.push(t));
    bus.emit('battle:started', { worldSeed: encounter.worldSeed, encounter });
    const world = new World(bus, new RNG(encounter.worldSeed), encounter.gridW, encounter.gridH);
    world.installBattleRules([]);
    spawnEncounter(world, encounter);
    const maxTurnTicks = secondsToTicks(HEALTH.maxTurnSeconds);
    while (!world.ended) {
      world.tick();
      if (!world.ended && world.currentTick >= maxTurnTicks) world.resolveAsDraw();
    }

    const replayBus = new EventBus<GameEvents>();
    const replayEvents = captureEvents(replayBus);
    const result = replayTrace(traces[0]!, replayBus);
    expect(replayEvents).toEqual(events);
    expect(JSON.stringify(result.world.toJSON())).toBe(JSON.stringify(world.toJSON()));
  });

  it('refuses a trace from another schema version', () => {
    const trace = driveLive(makeEncounter()).trace;
    const stale = { ...trace, version: 2 as unknown as 1 };
    expect(() => replayTrace(stale)).toThrow(/unsupported trace version/);
  });

  it('refuses a trace recorded under a different config fingerprint', () => {
    const trace = driveLive(makeEncounter()).trace;
    const foreign = { ...trace, configHash: 'deadbeef' };
    expect(() => replayTrace(foreign)).toThrow(/recorded under config deadbeef/);
  });

  it('throws when recorded commands outlive the replayed battle (a divergence tell)', () => {
    const trace = driveLive(makeEncounter()).trace;
    const doctored: BattleTrace = {
      ...trace,
      commands: [
        ...trace.commands,
        { tick: trace.outcome.ticks + 100, command: { kind: 'noop' } },
      ],
    };
    expect(() => replayTrace(doctored)).toThrow(/still holds commands stamped/);
  });

  it('54c — beforeTick observes every tick + the stamped commands, changing nothing', () => {
    const live = driveLive(makeEncounter());
    const plain = replayTrace(live.trace);

    const tickSequence: number[] = [];
    const commandTicks: number[] = [];
    const hooked = replayTrace(live.trace, new EventBus<GameEvents>(), {
      beforeTick: (world, tick, commands) => {
        // The hook sees the PRE-tick state — what the live player saw when
        // they issued this tick's commands.
        expect(world.currentTick).toBe(tick - 1);
        tickSequence.push(tick);
        if (commands.length > 0) commandTicks.push(tick);
      },
    });

    // The observation changed nothing: same outcome, same final world bytes.
    expect(hooked.winner).toBe(plain.winner);
    expect(hooked.ticks).toBe(plain.ticks);
    expect(JSON.stringify(hooked.world.toJSON())).toBe(JSON.stringify(plain.world.toJSON()));
    // Fired once per tick, in order, and surfaced the three stamped ticks.
    expect(tickSequence).toEqual(Array.from({ length: hooked.ticks }, (_, i) => i + 1));
    expect(commandTicks).toEqual([1, 10, 26]);
  });
});
