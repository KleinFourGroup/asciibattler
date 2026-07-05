import { describe, it, expect } from 'vitest';
import { runMovementMetrics } from './harness';
import { openFieldScenario, corridorScenario, riverForkScenario } from './fixtures';

/**
 * The FIXTURE baseline, pinned exactly (the movement-layer sibling of a fuzz
 * baseline). The fixtures are ability-less and RNG-free, so these numbers are
 * fully deterministic properties of the movement algorithms — NOT quality
 * targets. Currently frozen at the post-43b state (2026-07-05 — numerically
 * identical to post-43a: 43b's sidestep tie rule measured BYTE-IDENTICAL on
 * all four fixtures, a deliberate no-re-pin; the §42c pre-fix numbers live
 * in PATHING.md):
 *
 *   - openField: the A* string tie-break is FIXED (was: every step drifted
 *     world-left, net dx −4 both teams). The residual ±1 drift is NOT
 *     pathing: all enemies tie at Chebyshev 9 from every spawn here, and the
 *     `nearest` targeting strategy resolves the tie to the lowest unit id
 *     (= the leftmost spawn), funneling every unit toward the same flank —
 *     the 43a-filed TARGETING-tie audit finding (43b2's). Zero sidesteps.
 *   - riverFork: the sidestep/repath crab-walk, essentially untouched by
 *     43a (osc 0.925/0.845) — and PROVEN untouched by the sidestep tie (43b
 *     changed the tie rule; this fixture didn't move a byte: its forced
 *     sidesteps never present a both-viable equidistant tie). The residual
 *     drift is 43b2's targeting funnel; the oscillation is §45b's
 *     (wait-vs-sidestep).
 *   - corridor: thin tunnel throughput (0.75 / 1.50 per 100t), unchanged —
 *     a 1-wide tunnel has no route ties for a tie-break to decide.
 *
 * A DELIBERATE movement change (§43 tie-breaks, §45 cooperation) re-baselines
 * this file in its own commit — the new numbers are the change's measured
 * effect (diff them into PATHING.md). An UNRELATED commit tripping this test
 * has silently changed movement behavior: stop and investigate.
 *
 * Shipped-layout numbers are NOT pinned here (real battles are slow and
 * combat-coupled); they live in PATHING.md via `npm run pathing`.
 */

describe('fixture baseline (post-43b, 2026-07-05 — re-baseline deliberately)', () => {
  it('openField(4): A* drift dead; the ±1 residue is the targeting-tie funnel', () => {
    const m = runMovementMetrics(openFieldScenario(4), 200);
    expect(m.teams.player.meanNetLateralDrift).toBeCloseTo(1, 10);
    expect(m.teams.enemy.meanNetLateralDrift).toBeCloseTo(-1, 10);
    expect(m.teams.player.meanNetDx).toBe(-1);
    expect(m.teams.enemy.meanNetDx).toBe(-1);
    expect(m.teams.player.moves).toBe(19);
    expect(m.teams.enemy.moves).toBe(18);
    expect(m.teams.player.backtracks).toBe(0);
    expect(m.teams.player.decisionMix.sidestep).toBe(0);
    expect(m.teams.player.decisionMix.advance).toBe(19);
  });

  it('riverFork(4): the crab-walk persists (43b2/§45 territory)', () => {
    const m = runMovementMetrics(riverForkScenario(4), 300);
    expect(m.teams.player.meanNetLateralDrift).toBeCloseTo(3.75, 10);
    expect(m.teams.enemy.meanNetLateralDrift).toBeCloseTo(-3.5, 10);
    expect(m.teams.player.moves).toBe(453);
    expect(m.teams.player.backtracks).toBe(419);
    expect(m.teams.enemy.moves).toBe(168);
    expect(m.teams.enemy.backtracks).toBe(142);
    expect(m.teams.player.decisionMix.sidestep).toBe(212);
  });

  it('corridor(3) and corridor(6): tunnel throughput (unchanged by 43a)', () => {
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
