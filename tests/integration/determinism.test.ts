/**
 * Deterministic-replay harness.
 *
 * Contract: given a fixed seed and an initial unit configuration, advancing the
 * World by N ticks must produce the *same* final state and the *same* emitted
 * event sequence, every run, forever. This is the load-bearing test for
 * "deterministic spectacle" (DESIGN.md) and ARCHITECTURE.md guiding principle 2.
 *
 * Why we care:
 *   - Replays / shareable seeds / bug repros all depend on it.
 *   - Catches accidental non-determinism that ESLint can't see: Map iteration
 *     order, Date.now()-as-randomness, Set ordering, sort stability assumptions,
 *     parallel async resolving in different orders, etc.
 */

import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/World';
import { Unit, type Team, type UnitStats } from '../../src/sim/Unit';
import { MovementBehavior } from '../../src/sim/behaviors/MovementBehavior';
import { AbilityBehavior } from '../../src/sim/behaviors/AbilityBehavior';
import { MeleeStrike } from '../../src/sim/abilities/strikes';
import { rollUnit } from '../../src/sim/archetypes';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';
import { Run, type BattleEncounter, type RunPhase } from '../../src/run/Run';
import type { RunConfig } from '../../src/run/RunConfig';
import { LAYOUT_IDS } from '../../src/sim/layouts';
import { HEALTH } from '../../src/config/health';

describe('determinism: world tick replay', () => {
  it('same seed + same initial team → same final unit positions after N ticks', () => {
    const a = runBattle(54321, 500);
    const b = runBattle(54321, 500);
    expect(snapshotPositions(a.world)).toEqual(snapshotPositions(b.world));
    expect(a.world.currentTick).toBe(b.world.currentTick);
  });

  it('same seed + same initial team → same emitted event sequence', () => {
    const a = runBattle(54321, 500);
    const b = runBattle(54321, 500);
    expect(a.events).toEqual(b.events);
    // Sanity: the recording is actually substantial.
    expect(a.events.length).toBeGreaterThan(20);
  });

  it('forked RNG for a battle does not perturb the run-level RNG stream', () => {
    // Two Runs at the same seed drive identical node-enter / battle-end
    // sequences. If consuming the first battle's forked RNG (worldSeed +
    // enemy team roll) had bled into the run stream, the second battle's
    // encounter would diverge. The encounter snapshot is the cleanest
    // observation point — it captures every consumer of the run RNG.
    const a = driveTwoBattles(2026);
    const b = driveTwoBattles(2026);
    expect(a).toEqual(b);
    // Sanity: encounters are non-empty and the two battles differ from
    // each other (otherwise the test would pass trivially).
    expect(a).toHaveLength(2);
    expect(a[0]).not.toEqual(a[1]);
  });

  it('two parallel battles with the same forked seed resolve identically', () => {
    // Simulates Phase 4's expected pattern: a run RNG forks per battle so
    // running the same battle "again" produces the same outcome. Here we
    // model that by forking from a shared parent.
    const parentA = new RNG(99);
    const parentB = new RNG(99);
    const battleA = runBattle(parentA.fork().next() * 0x100000000, 500);
    const battleB = runBattle(parentB.fork().next() * 0x100000000, 500);
    expect(snapshotPositions(battleA.world)).toEqual(snapshotPositions(battleB.world));
    expect(battleA.events).toEqual(battleB.events);
  });
});

describe('determinism: stat rolls', () => {
  it('rollUnit(archetype, rng) with the same rng state produces the same stats', () => {
    const a = rollUnit('mercenary', new RNG(7));
    const b = rollUnit('mercenary', new RNG(7));
    expect(a).toEqual(b);
  });
});

describe('determinism: map generation', () => {
  it('Run(seed).nodeMap is byte-identical across instances', () => {
    // Unit-level NodeMap determinism is pinned in src/run/NodeMap.test.ts.
    // This is the integration angle: the wiring inside Run actually uses
    // a deterministic fork of the run RNG, not (say) a Math.random()-
    // contaminated path.
    const a = new Run(2026, new EventBus<GameEvents>());
    const b = new Run(2026, new EventBus<GameEvents>());
    expect(a.nodeMap).toEqual(b.nodeMap);
  });
});

describe('determinism: RunConfig (G1)', () => {
  it('no config == empty config == undefined config (default path unmoved)', () => {
    const base = new Run(2026, new EventBus<GameEvents>());
    const empty = new Run(2026, new EventBus<GameEvents>(), {});
    const undef = new Run(2026, new EventBus<GameEvents>(), undefined);
    expect(empty.nodeMap).toEqual(base.nodeMap);
    expect(undef.nodeMap).toEqual(base.nodeMap);
    expect(empty.team).toEqual(base.team);
    expect(undef.team).toEqual(base.team);
  });

  it('a nodeMap-shape override leaves the team fork (next in order) unmoved', () => {
    // The fork hierarchy (nodeMap → team → levelup) means overriding the
    // *nodeMap* only changes its forked child stream — the parent advances by
    // exactly one fork either way, so the team fork is byte-identical.
    const base = new Run(2026, new EventBus<GameEvents>());
    const shaped = new Run(2026, new EventBus<GameEvents>(), { floorCount: 2 });
    expect(shaped.nodeMap).not.toEqual(base.nodeMap);
    expect(shaped.team).toEqual(base.team);
  });

  it('a forced short run resolves deterministically to completion', () => {
    const config: RunConfig = { floorCount: 2, forcedLayoutId: LAYOUT_IDS[0]! };
    const first = driveForcedRun(7, config);
    const second = driveForcedRun(7, config);
    expect(first).toEqual(second);
    expect(first.phase).toBe('complete');
    expect(first.encounter.layoutId).toBe(LAYOUT_IDS[0]!);
  });

  it('throws fast on an unknown forced layout id', () => {
    expect(() => new Run(7, new EventBus<GameEvents>(), { forcedLayoutId: 'not_a_layout' })).toThrow(
      /forcedLayoutId/,
    );
  });

  it('a leveled startingRoster is reproducible and applies the level', () => {
    // Level-ups draw from the team fork (a child stream), so same seed +
    // same config → identical leveled stats. The level field is honored.
    const config: RunConfig = { startingRoster: [{ archetype: 'rogue', level: 3 }] };
    const a = new Run(11, new EventBus<GameEvents>(), config);
    const b = new Run(11, new EventBus<GameEvents>(), config);
    expect(a.team).toEqual(b.team);
    expect(a.team).toHaveLength(1);
    expect(a.team[0]!.level).toBe(3);
  });
});

/**
 * Drive a Run through two node-enter / battle-end cycles and capture the
 * encounter snapshot at each battle. Returns clones because Run nulls out
 * `currentEncounter` on battle-end, but the snapshot we captured during
 * 'battle' phase is still the object we want to compare against.
 *
 * A2: imperative inputs (enter node, pick recruit) go through Run.dispatch
 * rather than bus events. `battle:ended` stays on the bus — it's a
 * notification, not a command.
 */
function driveTwoBattles(seed: number): BattleEncounter[] {
  const bus = new EventBus<GameEvents>();
  const run = new Run(seed, bus);
  const encounters: BattleEncounter[] = [];

  const first = run.nodeMap.edges.find((e) => e.from === run.nodeMap.rootId)?.to;
  if (first === undefined) throw new Error('test setup: root has no outgoing edge');
  run.dispatch({ kind: 'enterNode', nodeId: first });
  encounters.push(run.currentEncounter!);
  // H4: the encounter loop ends a node when the enemy pool empties, so chip it
  // out in one turn (player survivors >= the pool max).
  bus.emit('battle:ended', {
    winner: 'player',
    xpAwards: [],
    survivorPower: { player: HEALTH.enemyHealthMax, enemy: 0 },
  });
  // Victory routes through recruit phase. Pick the first offer to get
  // back to 'map' so the second hop is accepted.
  run.dispatch({ kind: 'chooseRecruit', unitTemplate: run.currentOffer![0]! });

  const second = run.nodeMap.edges.find((e) => e.from === first)?.to;
  if (second === undefined) throw new Error('test setup: first frontier has no outgoing edge');
  run.dispatch({ kind: 'enterNode', nodeId: second });
  encounters.push(run.currentEncounter!);
  // H4: the encounter loop ends a node when the enemy pool empties, so chip it
  // out in one turn (player survivors >= the pool max).
  bus.emit('battle:ended', {
    winner: 'player',
    xpAwards: [],
    survivorPower: { player: HEALTH.enemyHealthMax, enemy: 0 },
  });

  return encounters;
}

/**
 * G1 — drive a forced short run (floorCount 2 = exactly one battle) through
 * its single battle to completion, capturing the encounter (which Run nulls
 * out on battle-end). Used to prove a configured run is reproducible.
 */
function driveForcedRun(
  seed: number,
  config: RunConfig,
): { phase: RunPhase; encounter: BattleEncounter } {
  const bus = new EventBus<GameEvents>();
  const run = new Run(seed, bus, config);
  const next = run.nodeMap.edges.find((e) => e.from === run.nodeMap.rootId)?.to;
  if (next === undefined) throw new Error('test setup: root has no outgoing edge');
  run.dispatch({ kind: 'enterNode', nodeId: next });
  const encounter = run.currentEncounter!;
  // H4: the encounter loop ends a node when the enemy pool empties, so chip it
  // out in one turn (player survivors >= the pool max).
  bus.emit('battle:ended', {
    winner: 'player',
    xpAwards: [],
    survivorPower: { player: HEALTH.enemyHealthMax, enemy: 0 },
  });
  return { phase: run.phase, encounter };
}

/**
 * Run a deterministic battle from a seed and tick cap. Mirrors the spawn
 * layout Game.ts uses so the harness exercises the same code paths.
 */
function runBattle(
  seed: number,
  maxTicks: number,
): { world: World; events: RecordedEvent[] } {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(seed));
  const events = recordEvents(bus);

  const COLUMNS = [2, 4, 6, 8, 10];
  for (const x of COLUMNS) {
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'player', { x, y: 2 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(new MeleeStrike('sword'));
  }
  for (const x of COLUMNS) {
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'enemy', { x, y: 9 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(new MeleeStrike('sword'));
  }

  for (let i = 0; i < maxTicks && !world.ended; i++) world.tick();

  return { world, events };
}

interface UnitSnapshot {
  id: number;
  team: Team;
  x: number;
  y: number;
  currentHp: number;
  stats: UnitStats;
}

function snapshotPositions(world: World): UnitSnapshot[] {
  return world.units
    .map<UnitSnapshot>((u: Unit) => ({
      id: u.id,
      team: u.team,
      x: u.position.x,
      y: u.position.y,
      currentHp: u.currentHp,
      stats: u.stats,
    }))
    .sort((a, b) => a.id - b.id);
}

type RecordedEvent =
  | { kind: 'tick'; tick: number }
  | { kind: 'unit:spawned'; unitId: number }
  | { kind: 'unit:moved'; unitId: number; fx: number; fy: number; tx: number; ty: number }
  | { kind: 'unit:attacked'; attackerId: number; targetId: number; damage: number }
  | { kind: 'unit:died'; unitId: number }
  | { kind: 'battle:ended'; winner: GameEvents['battle:ended']['winner'] }
  // F2 — the phase-boundary stream must be deterministic too. Tapping it
  // here makes the "same seed → same event sequence" test cover it for free.
  | { kind: 'action:phase'; unitId: number; actionId: string; phase: string };

/**
 * Tap every event we care about into a flat ordered list. Used to assert
 * that two runs produce byte-identical event streams.
 */
function recordEvents(bus: EventBus<GameEvents>): RecordedEvent[] {
  const out: RecordedEvent[] = [];
  bus.on('tick', (p) => out.push({ kind: 'tick', tick: p.tick }));
  bus.on('unit:spawned', (p) => out.push({ kind: 'unit:spawned', unitId: p.unitId }));
  bus.on('unit:moved', (p) =>
    out.push({
      kind: 'unit:moved',
      unitId: p.unitId,
      fx: p.from.x,
      fy: p.from.y,
      tx: p.to.x,
      ty: p.to.y,
    }),
  );
  bus.on('unit:attacked', (p) =>
    out.push({
      kind: 'unit:attacked',
      attackerId: p.attackerId,
      targetId: p.targetId,
      damage: p.damage,
    }),
  );
  bus.on('unit:died', (p) => out.push({ kind: 'unit:died', unitId: p.unitId }));
  bus.on('battle:ended', (p) => out.push({ kind: 'battle:ended', winner: p.winner }));
  bus.on('action:phase', (p) =>
    out.push({ kind: 'action:phase', unitId: p.unitId, actionId: p.actionId, phase: p.phase }),
  );
  return out;
}
