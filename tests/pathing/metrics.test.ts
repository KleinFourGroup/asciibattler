import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import { World } from '../../src/sim/World';
import { Unit, type Team, type UnitStats } from '../../src/sim/Unit';
import { deriveStats } from '../../src/sim/stats';
import { ARCHETYPE_CONFIG } from '../../src/sim/archetypes';
import type { GameEvents } from '../../src/core/events';
import { MovementMetricsCollector, type MetricsConfig } from './metrics';
import { runMovementMetrics } from './harness';
import {
  openFieldScenario,
  corridorScenario,
  riverForkScenario,
  CORRIDOR_GATE_X,
} from './fixtures';

/**
 * §42b — the movement-metrics harness. Two layers under test:
 *
 *   1. **Metric arithmetic** on synthetic event streams — hand-computable
 *      expectations, no sim in the loop (the collector is pure fold-over-
 *      events; these pin its math exactly).
 *   2. **Wiring + determinism** on the real fixtures — a battle measured
 *      twice from the same seed yields identical metrics, and the obvious
 *      structural facts hold. NO quality assertions here (drift ≈ 0 etc. are
 *      §43's exit criteria; the CURRENT sim is the thing being audited).
 */

/** A bare world + bus with hand-placed units and NO behaviors — the event
 *  source is the test itself. */
function synthetic(specs: { id: number; team: Team; x: number; y: number }[]): {
  world: World;
  bus: EventBus<GameEvents>;
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const stats: UnitStats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, luck: 0 };
  for (const s of specs) {
    world.units.push(
      new Unit({
        id: s.id,
        team: s.team,
        archetype: 'mercenary',
        glyph: 'M',
        stats,
        derived: deriveStats(stats, 1),
        position: { x: s.x, y: s.y },
      }),
    );
  }
  return { world, bus };
}

function collect(
  specs: { id: number; team: Team; x: number; y: number }[],
  config: MetricsConfig,
  feed: (bus: EventBus<GameEvents>) => void,
): ReturnType<MovementMetricsCollector['finish']> {
  const { world, bus } = synthetic(specs);
  const collector = new MovementMetricsCollector(world, bus, config);
  feed(bus);
  return collector.finish();
}

describe('metric arithmetic (synthetic event streams)', () => {
  it('lateral drift: mirrored diagonal steps read the SAME sign in each team frame', () => {
    // Player at (5,0) faces +y → lateral (-1,0); enemy at (5,10) faces −y →
    // lateral (+1,0). Each takes one diagonal step toward its own −x/+x side:
    // both are a +1 body-relative drift, world dx of −1 and +1 respectively.
    const m = collect(
      [
        { id: 1, team: 'player', x: 5, y: 0 },
        { id: 2, team: 'enemy', x: 5, y: 10 },
      ],
      {}, // forward auto-derived from the two centroids
      (bus) => {
        bus.emit('unit:moved', { unitId: 1, from: { x: 5, y: 0 }, to: { x: 4, y: 1 }, durationTicks: 1 });
        bus.emit('unit:moved', { unitId: 2, from: { x: 5, y: 10 }, to: { x: 6, y: 9 }, durationTicks: 1 });
      },
    );
    expect(m.teams.player.meanNetLateralDrift).toBeCloseTo(1, 10);
    expect(m.teams.enemy.meanNetLateralDrift).toBeCloseTo(1, 10);
    expect(m.teams.player.meanNetDx).toBe(-1);
    expect(m.teams.enemy.meanNetDx).toBe(1);
    expect(m.teams.player.meanNetDy).toBe(1);
    expect(m.teams.enemy.meanNetDy).toBe(-1);
  });

  it('drift averages over the team roster (a stationary unit dilutes the mean)', () => {
    const m = collect(
      [
        { id: 1, team: 'player', x: 5, y: 0 },
        { id: 2, team: 'player', x: 6, y: 0 },
        { id: 3, team: 'enemy', x: 5, y: 10 },
      ],
      { forward: { player: { x: 0, y: 1 }, enemy: { x: 0, y: -1 } } },
      (bus) => {
        // Unit 1 drifts 2 cells toward −x (lateral +2); unit 2 never moves.
        bus.emit('unit:moved', { unitId: 1, from: { x: 5, y: 0 }, to: { x: 4, y: 1 }, durationTicks: 1 });
        bus.emit('unit:moved', { unitId: 1, from: { x: 4, y: 1 }, to: { x: 3, y: 2 }, durationTicks: 1 });
      },
    );
    expect(m.teams.player.meanNetLateralDrift).toBeCloseTo(1, 10); // (2 + 0) / 2
    expect(m.teams.player.moves).toBe(2);
  });

  it('oscillation: A→B→A backtracks; a return OUTSIDE the window does not', () => {
    const m = collect(
      [{ id: 1, team: 'player', x: 0, y: 0 }],
      { forward: { player: { x: 1, y: 0 }, enemy: { x: -1, y: 0 } }, oscillationWindowMoves: 1 },
      (bus) => {
        // A→B→A: the return lands 1 move after vacating A → backtrack.
        bus.emit('unit:moved', { unitId: 1, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, durationTicks: 1 });
        bus.emit('unit:moved', { unitId: 1, from: { x: 1, y: 0 }, to: { x: 0, y: 0 }, durationTicks: 1 });
        // A→C→D→A: the return lands 3 moves after vacating A — outside
        // window 1 → NOT a backtrack. (C=(0,1), D=(1,1).)
        bus.emit('unit:moved', { unitId: 1, from: { x: 0, y: 0 }, to: { x: 0, y: 1 }, durationTicks: 1 });
        bus.emit('unit:moved', { unitId: 1, from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, durationTicks: 1 });
        bus.emit('unit:moved', { unitId: 1, from: { x: 1, y: 1 }, to: { x: 0, y: 0 }, durationTicks: 1 });
      },
    );
    expect(m.teams.player.backtracks).toBe(1);
    expect(m.teams.player.moves).toBe(5);
    expect(m.teams.player.oscillationRate).toBeCloseTo(1 / 5, 10);
  });

  it('a swap is one committed step per participant; swapping back is two backtracks', () => {
    const m = collect(
      [
        { id: 1, team: 'player', x: 0, y: 0 },
        { id: 2, team: 'player', x: 1, y: 0 },
        { id: 3, team: 'enemy', x: 5, y: 5 },
      ],
      { forward: { player: { x: 1, y: 0 }, enemy: { x: -1, y: 0 } } },
      (bus) => {
        bus.emit('unit:swapped', { unitA: 1, unitB: 2, cellA: { x: 0, y: 0 }, cellB: { x: 1, y: 0 }, durationTicks: 1 });
        bus.emit('unit:swapped', { unitA: 1, unitB: 2, cellA: { x: 1, y: 0 }, cellB: { x: 0, y: 0 }, durationTicks: 1 });
      },
    );
    expect(m.teams.player.moves).toBe(4);
    expect(m.teams.player.backtracks).toBe(2);
    expect(m.teams.player.meanNetDx).toBe(0); // both ended where they started
  });

  it('an aborted move is fully reverted (moves, drift, gate, backtrack)', () => {
    const m = collect(
      [
        { id: 1, team: 'player', x: 0, y: 0 },
        { id: 2, team: 'enemy', x: 5, y: 0 },
      ],
      {
        forward: { player: { x: 1, y: 0 }, enemy: { x: -1, y: 0 } },
        gate: (from, to) => from.x < 1 && to.x >= 1,
      },
      (bus) => {
        bus.emit('unit:moved', { unitId: 1, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, durationTicks: 4 });
        bus.emit('unit:moveAborted', { unitId: 1, from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
      },
    );
    expect(m.teams.player.moves).toBe(0);
    expect(m.teams.player.meanNetDx).toBe(0);
    expect(m.gateCrossings).toBe(0);
  });

  it('throughput: gate crossings normalized per 100 ticks', () => {
    const m = collect(
      [
        { id: 1, team: 'player', x: 0, y: 0 },
        { id: 2, team: 'enemy', x: 9, y: 0 },
      ],
      {
        forward: { player: { x: 1, y: 0 }, enemy: { x: -1, y: 0 } },
        gate: (from, to) => from.x < 5 && to.x >= 5,
      },
      (bus) => {
        for (let t = 1; t <= 50; t++) bus.emit('tick', { tick: t });
        bus.emit('unit:moved', { unitId: 1, from: { x: 4, y: 0 }, to: { x: 5, y: 0 }, durationTicks: 1 });
        bus.emit('unit:moved', { unitId: 1, from: { x: 4, y: 1 }, to: { x: 5, y: 1 }, durationTicks: 1 });
      },
    );
    expect(m.ticks).toBe(50);
    expect(m.gateCrossings).toBe(2);
    expect(m.throughputPer100Ticks).toBeCloseTo(4, 10);
  });

  it('throughput is null without a gate; contact + decision mix land per team', () => {
    const m = collect(
      [
        { id: 1, team: 'player', x: 0, y: 0 },
        { id: 2, team: 'enemy', x: 9, y: 0 },
      ],
      { forward: { player: { x: 1, y: 0 }, enemy: { x: -1, y: 0 } } },
      (bus) => {
        for (let t = 1; t <= 7; t++) bus.emit('tick', { tick: t });
        bus.emit('unit:moveDecision', { unitId: 1, kind: 'advance' });
        bus.emit('unit:moveDecision', { unitId: 1, kind: 'queue' });
        bus.emit('unit:moveDecision', { unitId: 2, kind: 'hold_band' });
        bus.emit('unit:moveDecision', { unitId: 999, kind: 'advance' }); // unknown: ignored
        bus.emit('unit:attacked', { attackerId: 2, targetId: 1, damage: 3, crit: false });
      },
    );
    expect(m.throughputPer100Ticks).toBeNull();
    expect(m.timeToFirstContactTicks).toBe(7);
    expect(m.teams.player.decisionMix.advance).toBe(1);
    expect(m.teams.player.decisionMix.queue).toBe(1);
    expect(m.teams.enemy.decisionMix.hold_band).toBe(1);
    expect(m.teams.enemy.decisionMix.advance).toBe(0);
  });
});

describe('fixture wiring + determinism (no quality assertions — that is §43+)', () => {
  it('open field: two runs from the same seed produce identical metrics', () => {
    const a = runMovementMetrics(openFieldScenario(4, 7), 200);
    const b = runMovementMetrics(openFieldScenario(4, 7), 200);
    expect(a).toEqual(b);
    expect(a.ticks).toBe(200); // ability-less: tick-capped, never resolves
    expect(a.teams.player.moves).toBeGreaterThan(0);
    expect(a.teams.enemy.moves).toBeGreaterThan(0);
  });

  it('corridor: movers cross the gate and the queue registers in the decision mix', () => {
    const m = runMovementMetrics(corridorScenario(3), 400);
    expect(m.gateCrossings).toBeGreaterThanOrEqual(3); // all three made it through
    expect(m.throughputPer100Ticks).not.toBeNull();
    // The column queued at least once somewhere (today's corridor behavior —
    // the mix is the observation, not a target).
    const mix = m.teams.player.decisionMix;
    expect(mix.advance).toBeGreaterThan(0);
    expect(mix.queue + mix.sidestep).toBeGreaterThan(0);
  });

  it('corridor gate constant matches the fixture geometry', () => {
    // Guard the fixture against a silent redesign: the gate plane must sit
    // INSIDE the walled span so a crossing means "traversed the corridor".
    const { units } = corridorScenario(1);
    const wallXs = units.filter((u) => u.team === 'neutral').map((u) => u.position.x);
    expect(Math.min(...wallXs)).toBeLessThan(CORRIDOR_GATE_X);
    expect(Math.max(...wallXs)).toBeGreaterThanOrEqual(CORRIDOR_GATE_X);
  });

  it('river fork: deterministic, and both teams engage across the band', () => {
    const a = runMovementMetrics(riverForkScenario(4, 11), 300);
    const b = runMovementMetrics(riverForkScenario(4, 11), 300);
    expect(a).toEqual(b);
    expect(a.teams.player.moves).toBeGreaterThan(0);
    expect(a.teams.enemy.moves).toBeGreaterThan(0);
  });

  it('river fork spawns are mirror-symmetric about the ford axis', () => {
    const { units } = riverForkScenario(4);
    const player = units.filter((u) => u.team === 'player').map((u) => u.position.x);
    const enemy = units.filter((u) => u.team === 'enemy').map((u) => u.position.x);
    expect(player).toEqual(enemy);
    const mean = player.reduce((s, x) => s + x, 0) / player.length;
    expect(mean).toBeCloseTo(6, 10); // the gaps at x=2 / x=10 are symmetric about 6
  });
});
