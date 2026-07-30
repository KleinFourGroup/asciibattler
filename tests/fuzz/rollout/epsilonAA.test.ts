/**
 * 69f — the A/A ε methodology's contracts:
 *
 * 1. THE CONTROL IS EXACTLY ZERO — byte-inert vs null under shared
 *    pairs margins 0 through the FULL pipeline (the 69d pin re-asserted
 *    at the methodology layer): the floor read measures luck-resample
 *    noise, not estimator slop.
 * 2. DETERMINISM — same rng seed + options ⇒ identical result (margins,
 *    σ, ε), so a derived per-site ε is reproducible, never a one-off.
 * 3. SHAPE — ⌊N/2⌋ disjoint margins; ε = 2σ exactly; σ finite ≥ 0.
 * 4. The guard: fewer than 2 evaluations throws.
 *
 * Deliberately NOT asserted: that σ > 0 on any particular context (a
 * short-horizon context can legitimately tie), or any particular ε
 * value — real per-site values are §70's business, derived by
 * readEpsilonAA.ts on real site contexts.
 */

import { describe, expect, it } from 'vitest';
import { EventBus } from '../../../src/core/EventBus';
import type { GameEvents } from '../../../src/core/events';
import { RNG } from '../../../src/core/RNG';
import { Run } from '../../../src/run/Run';
import { deriveEpsilonAA } from './epsilonAA';

function liveRun(seed: number): Run {
  return new Run(seed, new EventBus<GameEvents>());
}

describe('deriveEpsilonAA (69f — the amended A/A methodology)', () => {
  it('the byte-inert control margins EXACTLY zero through the full pipeline', () => {
    const result = deriveEpsilonAA(liveRun(20260730), new RNG(11), {
      evaluations: 2,
      controls: 2,
    });
    expect(result.controlMaxAbs).toBe(0);
  });

  it('determinism: same seed + options ⇒ identical margins, σ, and ε', () => {
    const opts = { evaluations: 4, controls: 1 } as const;
    const a = deriveEpsilonAA(liveRun(20260730), new RNG(11), opts);
    const b = deriveEpsilonAA(liveRun(20260730), new RNG(11), opts);
    expect(a).toEqual(b);
  });

  it('shape: ⌊N/2⌋ margins, ε = 2σ, σ finite and non-negative', () => {
    const result = deriveEpsilonAA(liveRun(20260730), new RNG(11), {
      evaluations: 5, // odd on purpose — the trailing evaluation is dropped
      controls: 1,
    });
    expect(result.margins).toHaveLength(2);
    expect(Number.isFinite(result.sigma)).toBe(true);
    expect(result.sigma).toBeGreaterThanOrEqual(0);
    expect(result.epsilon).toBe(2 * result.sigma);
  });

  it('throws below 2 evaluations', () => {
    expect(() =>
      deriveEpsilonAA(liveRun(7), new RNG(1), { evaluations: 1 }),
    ).toThrow(/at least 2 evaluations/);
  });
});
