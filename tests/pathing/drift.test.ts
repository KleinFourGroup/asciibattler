import { describe, it, expect } from 'vitest';
import { runMovementMetrics } from './harness';
import { corridorScenario, openFieldScenario, riverForkScenario } from './fixtures';
import { measureLayout } from './capture';

/**
 * §43c — the drift QUALITY GATES: the Pathfinding-Audit round's fairness
 * exit criterion (**|mean lateral drift| ≈ 0 on symmetric fixtures, both
 * teams**), landed as standing regression tests once all three §43 tie fixes
 * (43a A* straightness / 43b sidestep cell-parity / 43b2 targeting
 * alignment) measured green and the user's native River playtest confirmed
 * ("no drift I can ID at all", 2026-07-05).
 *
 * These are BOUNDS, not pins — deliberately distinct from
 * `baseline.test.ts`:
 *
 *   - the BASELINE pins exact values and is expected to be re-pinned by
 *     every deliberate movement change (§45 cooperation will move it);
 *   - these GATES encode the fairness *invariant* and must survive every
 *     re-baseline. A §45 change that trips a gate has re-introduced a
 *     systematic bias — that is a bug in the change, never a number to
 *     relax. (Tolerances leave room for honest combat-noise jitter, not
 *     for a new funnel: the pre-fix readings were 4.00 on the fixtures and
 *     3.4–4.1 on shipped river.)
 *
 * The shipped-river gate runs three real battles (~seconds each) — kept to
 * the one map the round was called on (the user's original "walks left on
 * River" report).
 */

describe('§43c drift gates — symmetric fixtures (seed-invariant)', () => {
  it('openField(4): |mean lateral drift| ≤ 0.5 for both teams', () => {
    const m = runMovementMetrics(openFieldScenario(4), 200);
    expect(Math.abs(m.teams.player.meanNetLateralDrift)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(m.teams.enemy.meanNetLateralDrift)).toBeLessThanOrEqual(0.5);
  });

  it('riverFork(4): |mean lateral drift| ≤ 0.5 for both teams', () => {
    const m = runMovementMetrics(riverForkScenario(4), 300);
    expect(Math.abs(m.teams.player.meanNetLateralDrift)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(m.teams.enemy.meanNetLateralDrift)).toBeLessThanOrEqual(0.5);
  });
});

/**
 * §45b — the COOPERATION gates, same doctrine as the drift gates above:
 * bounds that survive every re-baseline, never to be relaxed.
 *
 *   - the OSCILLATION gate encodes "the crab-walk stays dead". Pre-§45b the
 *     riverFork standoff read 0.923 (a unit reversing on ~every move — the
 *     shuttle between the two plugged fords); post-§45b it reads 0.087. The
 *     0.5 bound is the ROADMAP §45 target line with generous combat-noise
 *     headroom — a change that trips it has re-created a shuttle.
 *   - the THROUGHPUT floor encodes "queueing must never cost crossings". The
 *     sealed corridor has pushed 0.75 / 1.50 per 100t through every §43+§45
 *     change; patience dials (wait gates, progress guard) may reshape the
 *     decision mix freely but may not starve the gate.
 */
describe('§45b cooperation gates — oscillation + throughput (seed-invariant)', () => {
  it('riverFork(4): player oscillation stays ≤ 0.5 (was 0.923 pre-§45b)', () => {
    const m = runMovementMetrics(riverForkScenario(4), 300);
    expect(m.teams.player.oscillationRate).toBeLessThanOrEqual(0.5);
    expect(m.teams.enemy.oscillationRate).toBeLessThanOrEqual(0.5);
  });

  it('corridor(3)/(6): gate throughput holds its floor (0.75 / 1.50 per 100t)', () => {
    const three = runMovementMetrics(corridorScenario(3), 400);
    expect(three.throughputPer100Ticks).toBeGreaterThanOrEqual(0.75);
    const six = runMovementMetrics(corridorScenario(6), 400);
    expect(six.throughputPer100Ticks).toBeGreaterThanOrEqual(1.5);
  });
});

describe('§43c drift gates — shipped River (real battles, seeds 100–102)', () => {
  // One measurement pass shared by both gates (three real battles).
  const SEEDS = [100, 101, 102] as const;
  let runs: { seed: number; m: ReturnType<typeof measureLayout> }[] | null = null;
  const measure = () => (runs ??= SEEDS.map((seed) => ({ seed, m: measureLayout('river', seed) })));

  it(
    'per-seed, per-team |mean lateral drift| stays bounded (≤ 2.5)',
    () => {
      // Pre-fix worst case: 3.44 / −4.14 (a whole team leaning one way).
      // Post-§43 readings sit ≤ 1.11; the slack above that is combat noise
      // headroom, not license.
      for (const { seed, m } of measure()) {
        for (const team of ['player', 'enemy'] as const) {
          const drift = Math.abs(m.teams[team].meanNetLateralDrift);
          expect(drift, `river seed ${seed} ${team} |lat drift|`).toBeLessThanOrEqual(2.5);
        }
      }
    },
    120_000,
  );

  it(
    'net dx is sign-mixed across team-seeds (the everyone-drains-left signature stays dead)',
    () => {
      // The §42c bug signature: net dx ≤ 0 in ALL SIX team-seeds (both teams
      // draining toward the low-x ford). Fixed = at least one team-seed nets
      // rightward. Any future change that reads all-one-sign here has
      // re-introduced a world-framed funnel.
      const dxs = measure().flatMap(({ m }) => [m.teams.player.meanNetDx, m.teams.enemy.meanNetDx]);
      expect(dxs.some((dx) => dx > 0)).toBe(true);
      expect(dxs.some((dx) => dx < 0)).toBe(true);
    },
    120_000,
  );
});
