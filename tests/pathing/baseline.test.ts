import { describe, it, expect } from 'vitest';
import { runMovementMetrics } from './harness';
import { openFieldScenario, corridorScenario, riverForkScenario } from './fixtures';

/**
 * §42c — the FIXTURE baseline, pinned exactly (the movement-layer sibling of
 * a fuzz baseline). The fixtures are ability-less and RNG-free, so these
 * numbers are fully deterministic properties of the movement algorithms —
 * NOT quality targets. They freeze the 2026-07-04 pre-fix state recorded in
 * PATHING.md §42c:
 *
 *   - openField: the A* string tie-break drifts EVERY step world-left
 *     (net dx −4 per unit, both teams).
 *   - riverFork: the sidestep/repath crab-walk (osc 0.94) + both teams
 *     draining to the low-x ford.
 *   - corridor: thin tunnel throughput (0.75 / 1.50 per 100t).
 *
 * A DELIBERATE movement change (§43 tie-breaks, §45 cooperation) re-baselines
 * this file in its own commit — the new numbers are the change's measured
 * effect (diff them into PATHING.md). An UNRELATED commit tripping this test
 * has silently changed movement behavior: stop and investigate.
 *
 * Shipped-layout numbers are NOT pinned here (real battles are slow and
 * combat-coupled); they live in PATHING.md via `npm run pathing`.
 */

describe('§42c fixture baseline (pre-fix, 2026-07-04 — re-baseline deliberately)', () => {
  it('openField(4): total leftward tie-break drift, no contention', () => {
    const m = runMovementMetrics(openFieldScenario(4), 200);
    expect(m.teams.player.meanNetLateralDrift).toBeCloseTo(4, 10);
    expect(m.teams.enemy.meanNetLateralDrift).toBeCloseTo(-4, 10);
    expect(m.teams.player.meanNetDx).toBe(-4);
    expect(m.teams.enemy.meanNetDx).toBe(-4);
    expect(m.teams.player.moves).toBe(16);
    expect(m.teams.enemy.moves).toBe(16);
    expect(m.teams.player.backtracks).toBe(0);
    expect(m.teams.player.decisionMix.sidestep).toBe(0);
    expect(m.teams.player.decisionMix.advance).toBe(16);
  });

  it('riverFork(4): the crab-walk + the shared low-x ford', () => {
    const m = runMovementMetrics(riverForkScenario(4), 300);
    expect(m.teams.player.meanNetLateralDrift).toBeCloseTo(4, 10);
    expect(m.teams.enemy.meanNetLateralDrift).toBeCloseTo(-3.5, 10);
    expect(m.teams.player.moves).toBe(455);
    expect(m.teams.player.backtracks).toBe(429);
    expect(m.teams.enemy.moves).toBe(162);
    expect(m.teams.enemy.backtracks).toBe(145);
    expect(m.teams.player.decisionMix.sidestep).toBe(219);
  });

  it('corridor(3) and corridor(6): tunnel throughput', () => {
    const three = runMovementMetrics(corridorScenario(3), 400);
    expect(three.gateCrossings).toBe(3);
    expect(three.throughputPer100Ticks).toBeCloseTo(0.75, 10);
    expect(three.teams.player.decisionMix.queue).toBe(1);
    expect(three.teams.player.decisionMix.sidestep).toBe(3);

    const six = runMovementMetrics(corridorScenario(6), 400);
    expect(six.gateCrossings).toBe(6);
    expect(six.throughputPer100Ticks).toBeCloseTo(1.5, 10);
    expect(six.teams.player.decisionMix.queue).toBe(9);
    expect(six.teams.player.decisionMix.sidestep).toBe(12);
  });
});
