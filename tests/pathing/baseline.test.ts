import { describe, it, expect } from 'vitest';
import { runMovementMetrics } from './harness';
import { openFieldScenario, corridorScenario, riverForkScenario } from './fixtures';

/**
 * The FIXTURE baseline, pinned exactly (the movement-layer sibling of a fuzz
 * baseline). The fixtures are ability-less and RNG-free, so these numbers are
 * fully deterministic properties of the movement algorithms — NOT quality
 * targets. Currently frozen at the post-45b state (2026-07-05; the §42c
 * pre-fix + post-43b2/45a numbers live in PATHING.md):
 *
 *   - openField: **|drift| = 0 exactly, both teams** — the §43 exit
 *     criterion, hit at 43b2, byte-identical through 45a/45b (no in-flight
 *     traffic on anyone's route: the vacancy tiers never fire).
 *   - riverFork: **THE CRAB-WALK IS DEAD** — §45b's target. Oscillation
 *     0.923 → 0.087, sidestep 194 → 4, moves 310 → 23 (the standoff
 *     shuttle was almost all of the fixture's motion). Two §45b rules did
 *     it: the ETA-gated wait (queue behind a draining lane) and the
 *     sidestep PROGRESS GUARD (never crab to a cell farther from the
 *     goal — the shuttle engine). Drift back to the symmetric ±0.25
 *     (45a's player 0.00 was partly shuttle-averaging; the drift GATE
 *     |x| <= 0.5 holds either way).
 *   - corridor: thin tunnel throughput (0.75 / 1.50 per 100t) HELD through
 *     45a+45b — queue/sidestep churn converts to waits/queues with zero
 *     crossings lost (osc 0.029/0.037 → 0.000/0.014, moves down).
 *
 * A DELIBERATE movement change (§43 tie-breaks, §45 cooperation) re-baselines
 * this file in its own commit — the new numbers are the change's measured
 * effect (diff them into PATHING.md). An UNRELATED commit tripping this test
 * has silently changed movement behavior: stop and investigate.
 *
 * Shipped-layout numbers are NOT pinned here (real battles are slow and
 * combat-coupled); they live in PATHING.md via `npm run pathing`.
 */

describe('fixture baseline (post-45b, 2026-07-05 — re-baseline deliberately)', () => {
  it('openField(4): drift ZERO both teams — the §43 exit criterion', () => {
    const m = runMovementMetrics(openFieldScenario(4), 200);
    expect(m.teams.player.meanNetLateralDrift).toBeCloseTo(0, 10);
    expect(m.teams.enemy.meanNetLateralDrift).toBeCloseTo(0, 10);
    expect(m.teams.player.meanNetDx).toBeCloseTo(0, 10);
    expect(m.teams.enemy.meanNetDx).toBeCloseTo(0, 10);
    expect(m.teams.player.moves).toBe(16);
    expect(m.teams.enemy.moves).toBe(16);
    expect(m.teams.player.backtracks).toBe(0);
    expect(m.teams.player.decisionMix.sidestep).toBe(0);
    expect(m.teams.player.decisionMix.advance).toBe(16);
  });

  it('riverFork(4): the crab-walk is dead (osc 0.923 → 0.087, the §45b exit)', () => {
    const m = runMovementMetrics(riverForkScenario(4), 300);
    expect(m.teams.player.meanNetLateralDrift).toBeCloseTo(-0.25, 10);
    expect(m.teams.enemy.meanNetLateralDrift).toBeCloseTo(0.25, 10);
    expect(m.teams.player.oscillationRate).toBeCloseTo(0.087, 3);
    expect(m.teams.player.moves).toBe(23);
    expect(m.teams.enemy.moves).toBe(19);
    expect(m.teams.enemy.backtracks).toBe(0);
    expect(m.teams.player.decisionMix.sidestep).toBe(4);
  });

  it('corridor(3) and corridor(6): tunnel throughput (held through §43 + §45a/b)', () => {
    const three = runMovementMetrics(corridorScenario(3), 400);
    expect(three.gateCrossings).toBe(3);
    expect(three.throughputPer100Ticks).toBeCloseTo(0.75, 10);
    expect(three.teams.player.decisionMix.queue).toBe(5);
    expect(three.teams.player.decisionMix.sidestep).toBe(1);

    const six = runMovementMetrics(corridorScenario(6), 400);
    expect(six.gateCrossings).toBe(6);
    expect(six.throughputPer100Ticks).toBeCloseTo(1.5, 10);
    expect(six.teams.player.decisionMix.queue).toBe(13);
    // §45c — one more flicker crab became a lane-hold (6 → 5).
    expect(six.teams.player.decisionMix.sidestep).toBe(5);
  });
});
