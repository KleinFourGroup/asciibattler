import { describe, it, expect } from 'vitest';
import { DIFFICULTY, resolveDifficultyMultipliers } from './difficulty';

/**
 * X1 + 48f — the per-run difficulty-multiplier resolution seam. Expectations
 * derive from the config module (never a hardcoded balance number), per the
 * balance-proof discipline; the one literal assertion is the *no-op contract*
 * (the shipped default IS 1.0), on which the byte-identical guarantee rests.
 */
describe('resolveDifficultyMultipliers (X1/48f — the per-run difficulty seam)', () => {
  it('no overrides → the difficulty.json defaults', () => {
    expect(resolveDifficultyMultipliers()).toEqual({
      waveSize: DIFFICULTY.waveSizeMultiplier,
      levelBudget: DIFFICULTY.levelBudgetMultiplier,
      bits: DIFFICULTY.bitsMultiplier,
    });
  });

  it('the shipped defaults are the identity 1.0 (the byte-identical no-op contract)', () => {
    expect(DIFFICULTY.waveSizeMultiplier).toBe(1);
    expect(DIFFICULTY.levelBudgetMultiplier).toBe(1);
    expect(DIFFICULTY.bitsMultiplier).toBe(1);
  });

  it('an override wins per-field; the unset fields fall back to the defaults', () => {
    expect(resolveDifficultyMultipliers({ waveSize: 1.5 })).toEqual({
      waveSize: 1.5,
      levelBudget: DIFFICULTY.levelBudgetMultiplier,
      bits: DIFFICULTY.bitsMultiplier,
    });
    expect(resolveDifficultyMultipliers({ levelBudget: 0.5 })).toEqual({
      waveSize: DIFFICULTY.waveSizeMultiplier,
      levelBudget: 0.5,
      bits: DIFFICULTY.bitsMultiplier,
    });
    expect(resolveDifficultyMultipliers({ bits: 1.5 })).toEqual({
      waveSize: DIFFICULTY.waveSizeMultiplier,
      levelBudget: DIFFICULTY.levelBudgetMultiplier,
      bits: 1.5,
    });
  });

  it('all overrides are honoured', () => {
    expect(resolveDifficultyMultipliers({ waveSize: 2, levelBudget: 0.75, bits: 1.25 })).toEqual({
      waveSize: 2,
      levelBudget: 0.75,
      bits: 1.25,
    });
  });

  it('an explicit undefined field falls back to the default (not NaN)', () => {
    expect(
      resolveDifficultyMultipliers({ waveSize: undefined, levelBudget: 1.25, bits: undefined }),
    ).toEqual({
      waveSize: DIFFICULTY.waveSizeMultiplier,
      levelBudget: 1.25,
      bits: DIFFICULTY.bitsMultiplier,
    });
  });
});
