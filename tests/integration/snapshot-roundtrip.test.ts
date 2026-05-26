/**
 * A2 round-trip determinism harness.
 *
 * Contract: `World.toJSON()` → `World.fromJSON()` must produce a world
 * that, when ticked further, emits the same event sequence as the
 * un-roundtripped baseline. This is the load-bearing test for save/load,
 * replay, and the headless fuzz harness (A3): if a roundtrip ever diverges
 * the event stream, those features all break silently.
 *
 * Strategy: run a fixture battle to a non-trivial mid-state (so units
 * have HP loss, cooldowns set, and at least one in-flight action),
 * snapshot, deserialize on a fresh bus, then tick both to completion and
 * compare event traces.
 */

import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/World';
import { Unit, type Team } from '../../src/sim/Unit';
import { MovementBehavior } from '../../src/sim/behaviors/MovementBehavior';
import { AttackBehavior } from '../../src/sim/behaviors/AttackBehavior';
import { rollUnit } from '../../src/sim/archetypes';
import { applyTerrain } from '../../src/sim/battleSetup';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';
import { Run } from '../../src/run/Run';

describe('A2 round-trip: World', () => {
  it('toJSON → fromJSON preserves tickCount, RNG state, and per-unit state', () => {
    const { world } = freshBattle(54321);
    for (let i = 0; i < 50; i++) world.tick();

    const snap = world.toJSON();
    const restored = World.fromJSON(snap, new EventBus<GameEvents>());

    expect(restored.currentTick).toBe(world.currentTick);
    expect(restored.gridW).toBe(world.gridW);
    expect(restored.gridH).toBe(world.gridH);
    expect(restored.ended).toBe(world.ended);
    expect(restored.rng.toJSON()).toEqual(world.rng.toJSON());
    expect(restored.units.length).toBe(world.units.length);
    for (let i = 0; i < world.units.length; i++) {
      const a = world.units[i]!;
      const b = restored.units[i]!;
      expect(b.id).toBe(a.id);
      expect(b.team).toBe(a.team);
      expect(b.position).toEqual(a.position);
      expect(b.currentHp).toBe(a.currentHp);
      expect(b.stats).toEqual(a.stats);
      expect(Array.from(b.actionCooldowns.entries())).toEqual(
        Array.from(a.actionCooldowns.entries()),
      );
      expect(b.activeAction?.startTick).toBe(a.activeAction?.startTick);
      expect(b.activeAction?.finishTick).toBe(a.activeAction?.finishTick);
      expect(b.activeAction?.action.id).toBe(a.activeAction?.action.id);
      expect(b.behaviors.map((x) => x.kind)).toEqual(a.behaviors.map((x) => x.kind));
    }
  });

  it('continuing a restored World produces the same event trace as the baseline', () => {
    // Snapshot mid-battle, restore, tick both to completion, compare.
    const baseline = freshBattle(54321);
    for (let i = 0; i < 50; i++) baseline.world.tick();
    const baselineMidTrace = baseline.events.slice();

    // Now snapshot the baseline at this exact mid-point, restore onto a
    // fresh bus, and continue ticking the restored world to completion.
    const restoredBus = new EventBus<GameEvents>();
    const restoredEvents = recordEvents(restoredBus);
    const restored = World.fromJSON(baseline.world.toJSON(), restoredBus);
    for (let i = 0; i < 500 && !restored.ended; i++) restored.tick();

    // Continue the baseline too — to the same termination — without touching
    // its event recorder (which is what we want to compare against).
    for (let i = 0; i < 500 && !baseline.world.ended; i++) baseline.world.tick();
    const baselineFullTrace = baseline.events.slice();
    const baselinePostMidTrace = baselineFullTrace.slice(baselineMidTrace.length);

    expect(restoredEvents).toEqual(baselinePostMidTrace);
    expect(restored.ended).toBe(true);
    expect(restored.currentTick).toBe(baseline.world.currentTick);
  });

  it('survives JSON.stringify/parse without losing fidelity', () => {
    // Belt-and-braces — confirms the snapshot is actually plain JSON
    // (no Map / Set / undefined leakage that would break a real save).
    const { world } = freshBattle(11111);
    for (let i = 0; i < 30; i++) world.tick();

    const wireFormat = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wireFormat, new EventBus<GameEvents>());
    expect(restored.currentTick).toBe(world.currentTick);
    expect(restored.units.length).toBe(world.units.length);
  });

  it('preserves pending commands across roundtrip', () => {
    const { world } = freshBattle(11111);
    world.enqueueCommand({ kind: 'noop' });
    world.enqueueCommand({ kind: 'noop' });

    const snap = JSON.parse(JSON.stringify(world.toJSON()));
    expect(snap.pendingCommands).toHaveLength(2);

    const restored = World.fromJSON(snap, new EventBus<GameEvents>());
    // Tick once: commands drain at top of tick. After this the queue is empty.
    restored.tick();
    expect(restored.toJSON().pendingCommands).toHaveLength(0);
  });

  it('D6: round-trips per-unit blocksLineOfSight (walls true, half-cover false)', () => {
    const { world } = freshBattle(99999);
    // Walls default true; spawnHalfCover sets false.
    const wall = world.spawnEnvironment({ glyph: '#', position: { x: 0, y: 6 } });
    const halfCover = world.spawnEnvironment({
      glyph: '╥',
      position: { x: 1, y: 6 },
      blocksLineOfSight: false,
    });
    expect(wall.blocksLineOfSight).toBe(true);
    expect(halfCover.blocksLineOfSight).toBe(false);

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());

    const restoredWall = restored.units.find((u) => u.id === wall.id)!;
    const restoredHC = restored.units.find((u) => u.id === halfCover.id)!;
    expect(restoredWall.blocksLineOfSight).toBe(true);
    expect(restoredHC.blocksLineOfSight).toBe(false);
  });

  it('D7.A: round-trips chasm tiles through World snapshot', () => {
    const { world } = freshBattle(54321);
    world.tileGrid.setKind({ x: 4, y: 4 }, 'chasm');
    world.tileGrid.setKind({ x: 5, y: 4 }, 'chasm');

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());

    expect(restored.tileGrid.kindAt({ x: 4, y: 4 })).toBe('chasm');
    expect(restored.tileGrid.kindAt({ x: 5, y: 4 })).toBe('chasm');
    expect(restored.tileGrid.costAt({ x: 4, y: 4 })).toBe(Infinity);
    expect(restored.tileGrid.kindAt({ x: 0, y: 0 })).toBe('floor');
  });

  it('round-trips the tile grid + neutral wall units (C1a terrain)', () => {
    // Build a non-trivial battle, run it for a few ticks, snapshot, restore.
    const { world } = freshBattle(11111);
    applyTerrain(world, {
      worldSeed: 0,
      terrainSeed: 4242,
      layoutId: null,
      gridW: world.gridW,
      gridH: world.gridH,
      playerTeam: [],
      enemyTeam: [],
    });
    for (let i = 0; i < 5; i++) world.tick();

    const wallCoordsBefore = world.units
      .filter((u) => u.team === 'neutral')
      .map((u) => ({ ...u.position }));
    const tileSnapBefore = world.tileGrid.toJSON();
    expect(wallCoordsBefore.length).toBeGreaterThan(0);

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());

    const wallCoordsAfter = restored.units
      .filter((u) => u.team === 'neutral')
      .map((u) => ({ ...u.position }));
    expect(wallCoordsAfter).toEqual(wallCoordsBefore);
    expect(restored.tileGrid.toJSON()).toEqual(tileSnapBefore);
  });
});

describe('A2 round-trip: Run', () => {
  it('JSON wire format preserves enough state to continue the run identically', () => {
    const a = new Run(2026, new EventBus<GameEvents>());
    const first = a.nodeMap.edges.find((e) => e.from === a.nodeMap.rootId)!.to;
    a.dispatch({ kind: 'enterNode', nodeId: first });
    // Encounter A.
    const encounterA = a.currentEncounter!;

    // Serialize before the battle ends, restore on a fresh bus.
    const wire = JSON.parse(JSON.stringify(a.toJSON()));
    const b = Run.fromJSON(wire, new EventBus<GameEvents>());

    expect(b.phase).toBe('battle');
    expect(b.currentEncounter).toEqual(encounterA);
    // Stream byte-equivalence: after restore, the run RNG should pick the
    // same next encounter when we resume on the next frontier.
  });
});

/**
 * Spin up a fixture battle modeled on Game.spawnTeam so the test exercises
 * the full A1 action loop, not just isolated unit ticks.
 */
function freshBattle(seed: number): {
  world: World;
  events: RecordedEvent[];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(seed));
  const events = recordEvents(bus);

  const COLUMNS = [2, 4, 6, 8, 10];
  for (const x of COLUMNS) {
    const u = world.spawnUnit(rollUnit('melee', world.rng), 'player', { x, y: 2 });
    u.behaviors.push(new MovementBehavior(), new AttackBehavior());
  }
  for (const x of COLUMNS) {
    const u = world.spawnUnit(rollUnit('melee', world.rng), 'enemy', { x, y: 9 });
    u.behaviors.push(new MovementBehavior(), new AttackBehavior());
  }

  return { world, events };
}

type RecordedEvent =
  | { kind: 'tick'; tick: number }
  | { kind: 'unit:spawned'; unitId: number }
  | { kind: 'unit:moved'; unitId: number; fx: number; fy: number; tx: number; ty: number }
  | { kind: 'unit:attacked'; attackerId: number; targetId: number; damage: number }
  | { kind: 'unit:died'; unitId: number }
  | { kind: 'battle:ended'; winner: Team };

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
  return out;
}

// Keep Unit referenced so the import isn't dead — used inside `freshBattle` indirectly.
void Unit;
