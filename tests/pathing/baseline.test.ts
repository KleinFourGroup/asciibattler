import { describe, it, expect } from 'vitest';
import { runMovementMetrics } from './harness';
import { openFieldScenario, corridorScenario, riverForkScenario } from './fixtures';

/**
 * The FIXTURE baseline, pinned exactly (the movement-layer sibling of a fuzz
 * baseline). The fixtures are ability-less and RNG-free, so these numbers are
 * fully deterministic properties of the movement algorithms — NOT quality
 * targets. Currently frozen at the post-45a state (2026-07-05; the §42c
 * pre-fix + post-43b2 numbers live in PATHING.md):
 *
 *   - openField: **|drift| = 0 exactly, both teams** — the §43 exit
 *     criterion, hit at 43b2, byte-identical through 45a (no in-flight
 *     traffic on anyone's route: the vacancy tiers never fire).
 *   - riverFork: **player drift 0.00 EXACT** (45a: the ford approach stops
 *     detouring around mid-move allies, and the residual −0.25 died);
 *     enemy +0.25 unchanged. The player-side crab-walk REMAINS (osc 0.923,
 *     sidestep 194) — that is §45b's (wait-vs-sidestep) charter, distinct
 *     from route-cost fairness.
 *   - corridor: thin tunnel throughput (0.75 / 1.50 per 100t) HELD through
 *     45a — the sealed tunnel has no detour to un-choose, so the vacancy
 *     discount can't add crossings (45b/45c own converting its queue/
 *     sidestep mass). corridor(6): one sidestep became an advance
 *     (12 → 11, osc 0.048 → 0.036) — a follower now routes through a
 *     vacating lane cell instead of crabbing around it.
 *
 * A DELIBERATE movement change (§43 tie-breaks, §45 cooperation) re-baselines
 * this file in its own commit — the new numbers are the change's measured
 * effect (diff them into PATHING.md). An UNRELATED commit tripping this test
 * has silently changed movement behavior: stop and investigate.
 *
 * Shipped-layout numbers are NOT pinned here (real battles are slow and
 * combat-coupled); they live in PATHING.md via `npm run pathing`.
 */

describe('fixture baseline (post-45a, 2026-07-05 — re-baseline deliberately)', () => {
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

  it('riverFork(4): drift ≈ 0; the crab-walk oscillation remains (§45b territory)', () => {
    const m = runMovementMetrics(riverForkScenario(4), 300);
    expect(m.teams.player.meanNetLateralDrift).toBeCloseTo(0, 10);
    expect(m.teams.enemy.meanNetLateralDrift).toBeCloseTo(0.25, 10);
    expect(m.teams.player.moves).toBe(310);
    expect(m.teams.player.backtracks).toBe(286);
    expect(m.teams.enemy.moves).toBe(19);
    expect(m.teams.enemy.backtracks).toBe(0);
    expect(m.teams.player.decisionMix.sidestep).toBe(194);
  });

  it('corridor(3) and corridor(6): tunnel throughput (unchanged through the §43 tie fixes)', () => {
    const three = runMovementMetrics(corridorScenario(3), 400);
    expect(three.gateCrossings).toBe(3);
    expect(three.throughputPer100Ticks).toBeCloseTo(0.75, 10);
    expect(three.teams.player.decisionMix.queue).toBe(1);
    expect(three.teams.player.decisionMix.sidestep).toBe(3);

    const six = runMovementMetrics(corridorScenario(6), 400);
    expect(six.gateCrossings).toBe(6);
    expect(six.throughputPer100Ticks).toBeCloseTo(1.5, 10);
    expect(six.teams.player.decisionMix.queue).toBe(9);
    expect(six.teams.player.decisionMix.sidestep).toBe(11);
  });
});
