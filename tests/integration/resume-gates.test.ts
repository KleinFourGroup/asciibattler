import { describe, expect, it } from 'vitest';
import { secondsToTicks } from '../../src/config';
import { DECK } from '../../src/config/deck';
import { ENCOUNTER_IDS } from '../../src/config/encounters';
import { EVENTS } from '../../src/config/events';
import { HEALTH } from '../../src/config/health';
import { SectorMapSchema } from '../../src/config/sectorMap';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { RNG } from '../../src/core/RNG';
import { PHASE_ROWS, pickerFor } from '../../src/dev/probe/drive';
import { Run, type RunPhase, type RunSnapshot } from '../../src/run/Run';
import { parseRunConfig, type RunConfig } from '../../src/run/RunConfig';
import { World } from '../../src/sim/World';
import { spawnEncounter } from '../../src/sim/battleSetup';

// 115a — `Run.resume()`: a run loaded from a save re-emits the gate event of
// the phase it was saved in, with the payload the live run emitted on
// arriving there. Game mounts every screen from these events, so this pin is
// what makes a resumed screen the one that was left. The two facts Run v47
// saves (the sector-cleared gate's, and the last turn's winner and reason)
// are read by no simulation code, so no continuation check can catch their
// loss: this comparison is their only guard, and its controls show it sees
// them.

/** Each gate phase and the event the live run emits on arriving there; the
 *  map has none (Game routes it by the phase). */
const GATE_EVENT = {
  map: null,
  port: 'port:entered',
  event: 'event:entered',
  'turn-intro': 'turn:starting',
  reward: 'reward:offered',
  promotion: 'promotion:pending',
  recruit: 'recruit:offered',
  sectorCleared: 'sector:cleared',
  defeat: 'run:defeated',
  complete: 'run:victory',
} as const satisfies Partial<Record<RunPhase, keyof GameEvents | null>>;
type GatePhase = keyof typeof GATE_EVENT;
const GATE_EVENTS = Object.values(GATE_EVENT).filter((e) => e !== null);

interface Emitted {
  readonly name: string;
  readonly payload: string;
}

/** Record every gate event emitted on `bus`, as JSON text. */
function listen(bus: EventBus<GameEvents>): Emitted[] {
  const seen: Emitted[] = [];
  for (const name of GATE_EVENTS) {
    bus.on(name, (payload: unknown) => seen.push({ name, payload: JSON.stringify(payload) }));
  }
  return seen;
}

/** One arrival at a gate: the save taken there, and what the live run emitted. */
interface Arrival {
  readonly phase: GatePhase;
  readonly save: string;
  readonly live: Emitted | null;
}

const maxTurnTicks = secondsToTicks(HEALTH.maxTurnSeconds);

/** Play a gated run by the pane kit's rows, as `tests/journalDrive.ts` does,
 *  and keep a save at every arrival at a gate: a step that ended in a gate
 *  phase and emitted that phase's event (the map: emitted none). A step
 *  that stays in its gate (a reward portion taken, a port purchase) is not
 *  an arrival. */
function arrivals(seed: number, dials: string): Arrival[] {
  const bus = new EventBus<GameEvents>();
  let world: World | null = null;
  bus.on('battle:started', ({ worldSeed, encounter }) => {
    world = new World(bus, new RNG(worldSeed), encounter.gridW, encounter.gridH);
    world.installBattleRules(encounter.battleRules ?? []);
    spawnEncounter(world, encounter);
  });
  const emitted = listen(bus);
  const run = new Run(seed, bus, parseRunConfig(new URLSearchParams(dials)));
  run.pauseAtTurnGates = true;
  const pick = pickerFor('seeded', seed);
  const out: Arrival[] = [{ phase: 'map', save: JSON.stringify(run.toJSON()), live: null }];
  for (let sent = 0; sent < 5000; sent++) {
    const before = run.phase;
    const step = PHASE_ROWS[run.phase](run, pick);
    if (step === 'end') return out;
    emitted.length = 0;
    if (step === 'fight') {
      const w = world as World | null;
      if (w === null) throw new Error('arrivals: the battle phase with no World');
      while (!w.ended) {
        w.tick();
        if (!w.ended && w.currentTick >= maxTurnTicks) w.resolveAsDraw();
      }
    } else {
      run.dispatch(step.command);
    }
    const phase = run.phase;
    if (!(phase in GATE_EVENT)) continue;
    const gate = phase as GatePhase;
    const want = GATE_EVENT[gate];
    const live = emitted.filter((e) => e.name === want).at(-1) ?? null;
    const arrived = want === null ? before !== 'map' && emitted.length === 0 : live !== null;
    if (arrived) out.push({ phase: gate, save: JSON.stringify(run.toJSON()), live });
  }
  throw new Error('arrivals: 5000 steps without the run ending');
}

/** Load a save on a fresh bus and return what its `resume()` emits. */
function resumed(save: string, config: RunConfig): Emitted[] {
  const bus = new EventBus<GameEvents>();
  const emitted = listen(bus);
  const run = Run.fromJSON(JSON.parse(save) as RunSnapshot, bus, config);
  run.resume();
  run.dispose();
  return emitted;
}

// Step zero (WORKLOG §115a): a `sectorHops=2` run clears its first sector in
// about fifteen battles; no short run met a port, so one full-length run is
// here for that gate.
const RUNS: ReadonlyArray<readonly [number, string]> = [
  [2, 'sectorHops=2&character=soldier'],
  [1, 'sectorHops=2&character=soldier'],
  [1, 'character=soldier'],
];

describe('115a — Run.resume(): a loaded run re-emits its gate', () => {
  const played = RUNS.map(([seed, dials]) => ({ seed, dials, arrivals: arrivals(seed, dials) }));

  it('emits, for every arrival at every gate kind, the payload the live run emitted there', () => {
    const met = new Map<GatePhase, number>();
    let stripsCarried = 0;
    for (const { dials, arrivals: list } of played) {
      const config = parseRunConfig(new URLSearchParams(dials));
      for (const { phase, save, live } of list) {
        met.set(phase, (met.get(phase) ?? 0) + 1);
        expect(resumed(save, config), `${dials} at ${phase}`).toEqual(live === null ? [] : [live]);
        if (live?.name === 'turn:starting' && !live.payload.includes('"lastTurn":null')) stripsCarried++;
      }
    }
    // Every gate kind was compared at least once, and the strip was carried.
    expect([...met.keys()].sort()).toEqual(Object.keys(GATE_EVENT).sort());
    expect(stripsCarried).toBeGreaterThan(0);
  });

  it('sees the two v47 facts: a save with either one changed resumes to a different payload', () => {
    const all = played.flatMap((p) => p.arrivals.map((a) => ({ ...a, dials: p.dials })));
    const strip = all.find((a) => a.phase === 'turn-intro' && !a.live!.payload.includes('"lastTurn":null'))!;
    const cleared = all.find((a) => a.phase === 'sectorCleared')!;
    const plant = (a: (typeof all)[number], edit: (snap: RunSnapshot) => void): Emitted[] => {
      const snap = JSON.parse(a.save) as RunSnapshot;
      edit(snap);
      return resumed(JSON.stringify(snap), parseRunConfig(new URLSearchParams(a.dials)));
    };
    expect(plant(strip, () => undefined)).toEqual([strip.live]);
    expect(plant(strip, (s) => (s.lastTurn = null))).not.toEqual([strip.live]);
    expect(plant(cleared, () => undefined)).toEqual([cleared.live]);
    expect(plant(cleared, (s) => (s.clearedSector = { ...s.clearedSector!, poolBefore: -1 }))).not.toEqual([
      cleared.live,
    ]);
  });

  it("refuses the 'battle' and 'turn-outcome' phases by name", () => {
    const bus = new EventBus<GameEvents>();
    // An elite root, so the first entry is a fight (the shipped root is an event).
    const run = new Run(3, bus, { hopCount: 2, firstNodeKind: 'elite' });
    run.pauseAtTurnGates = true;
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    expect(run.phase).toBe('turn-intro');
    run.dispatch({ kind: 'advanceTurn' });
    expect(run.phase).toBe('battle');
    expect(() => Run.fromJSON(run.toJSON(), new EventBus<GameEvents>()).resume()).toThrow(
      "the 'battle' phase is not a gate",
    );
    const outcome = { ...run.toJSON(), phase: 'turn-outcome' as const };
    expect(() => Run.fromJSON(outcome, new EventBus<GameEvents>()).resume()).toThrow(
      "the 'turn-outcome' phase is not a gate",
    );
  });

  it('a save whose phase lacks its state throws by name, and an unknown cleared sector rejects at load', () => {
    const [, , first] = played;
    const reward = first!.arrivals.find((a) => a.phase === 'reward')!;
    const snap = { ...(JSON.parse(reward.save) as RunSnapshot), pendingRewards: null };
    expect(() => Run.fromJSON(snap, new EventBus<GameEvents>()).resume()).toThrow(
      "the 'reward' phase with no pendingRewards",
    );
    const cleared = played[0]!.arrivals.find((a) => a.phase === 'sectorCleared')!;
    const stale = JSON.parse(cleared.save) as RunSnapshot;
    stale.clearedSector = { sectorId: 'no-such-sector', poolBefore: 1 };
    expect(() => Run.fromJSON(stale, new EventBus<GameEvents>())).toThrow("cleared sector id 'no-such-sector'");
  });
});

describe('115a — Run.fromJSON(snapshot, bus, config?): the config inputs', () => {
  // Every input the run reads after construction, by its field name.
  const INPUTS = [
    'sectorMap',
    'forcedLayoutId',
    'forcedEncounterId',
    'eventCatalog',
    'forcedEventId',
    'singleSectorRun',
    'sectorHopsOverride',
    'sectorScatterConfig',
    'rootStampedByDial',
    'passIsFinal',
    'drawAmountAdd',
    'difficultyMultipliers',
  ] as const;
  const read = (run: Run): Record<string, unknown> =>
    Object.fromEntries(INPUTS.map((k) => [k, (run as unknown as Record<string, unknown>)[k]]));

  // A two-sector fixture map and a cut catalog: inputs whose value is an
  // object compare by identity below, since a copy of the default would
  // equal it.
  const sectorMap = SectorMapSchema.parse({
    nodes: [
      { id: 'a', sectors: ['the-start'] },
      { id: 'b', sectors: ['the-start'] },
    ],
    edges: [{ from: 'a', to: 'b' }],
    sources: ['a'],
    sinks: ['b'],
  });
  const eventCatalog = EVENTS.slice(0, 3);
  const shared: RunConfig = {
    sectorMap,
    eventCatalog,
    forcedEventId: eventCatalog[0]!.id,
    forcedLayoutId: 'procedural',
    forcedEncounterId: ENCOUNTER_IDS[0]!,
    firstNodeKind: 'event',
    eliteChance: 1,
    portChance: 0,
    eventChance: 0.5,
    waveSizeMultiplier: 1.5,
    levelBudgetMultiplier: 0.5,
    bitsMultiplier: 2,
    drawAmountAdd: 1,
    passIsFinal: !DECK.grantQueue.passIsFinal,
  };
  // `hopCount` and `sectorHops` exclude each other, so two configs.
  const configs: RunConfig[] = [
    { ...shared, hopCount: 4 },
    { ...shared, sectorHops: 3 },
  ];

  it('with the config, a loaded run reads what the live run read; without one, the shipped defaults', () => {
    const plain = read(new Run(5, new EventBus<GameEvents>()));
    const differs = new Set<string>();
    for (const config of configs) {
      const live = new Run(5, new EventBus<GameEvents>(), config);
      const loaded = read(Run.fromJSON(live.toJSON(), new EventBus<GameEvents>(), config));
      expect(loaded).toEqual(read(live));
      expect(loaded['sectorMap']).toBe(sectorMap);
      expect(loaded['eventCatalog']).toBe(eventCatalog);
      expect(read(Run.fromJSON(live.toJSON(), new EventBus<GameEvents>()))).toEqual(plain);
      for (const k of INPUTS) {
        const value = read(live)[k];
        if (typeof value === 'object' && value !== null && k !== 'difficultyMultipliers') {
          if (value !== plain[k]) differs.add(k);
        } else if (JSON.stringify(value) !== JSON.stringify(plain[k])) {
          differs.add(k);
        }
      }
    }
    // The control: each input is off its default in one config or the
    // other, so an input the load forgot would show above.
    expect([...differs].sort()).toEqual([...INPUTS].sort());
  });

  it('the snapshot wins over the config for what shaped construction', () => {
    const live = new Run(5, new EventBus<GameEvents>(), { startingBits: 7 });
    const loaded = Run.fromJSON(live.toJSON(), new EventBus<GameEvents>(), { startingBits: 99 });
    expect(loaded.bits).toBe(7);
    expect(JSON.stringify(loaded.toJSON())).toBe(JSON.stringify(live.toJSON()));
  });

  it('hopCount with sectorHops throws at load as at construction', () => {
    const snap = new Run(5, new EventBus<GameEvents>()).toJSON();
    expect(() => Run.fromJSON(snap, new EventBus<GameEvents>(), { hopCount: 3, sectorHops: 3 })).toThrow(
      'mutually exclusive',
    );
  });
});
