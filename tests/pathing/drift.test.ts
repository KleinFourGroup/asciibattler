import { describe, it, expect } from 'vitest';
import { runMovementMetrics } from './harness';
import { openFieldScenario, riverForkScenario } from './fixtures';
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
