import { describe, it, expect } from 'vitest';
import { DIFFICULTY, resolveDifficultyMultipliers, scaledEnemyPool } from './difficulty';

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
      enemyMorale: DIFFICULTY.enemyMoraleMultiplier,
    });
  });

  it('the shipped defaults are the identity 1.0 (the byte-identical no-op contract)', () => {
    expect(DIFFICULTY.waveSizeMultiplier).toBe(1);
    expect(DIFFICULTY.levelBudgetMultiplier).toBe(1);
    expect(DIFFICULTY.bitsMultiplier).toBe(1);
    expect(DIFFICULTY.enemyMoraleMultiplier).toBe(1);
  });

  it('an override wins per-field; the unset fields fall back to the defaults', () => {
    expect(resolveDifficultyMultipliers({ waveSize: 1.5 })).toEqual({
      waveSize: 1.5,
      levelBudget: DIFFICULTY.levelBudgetMultiplier,
      bits: DIFFICULTY.bitsMultiplier,
      enemyMorale: DIFFICULTY.enemyMoraleMultiplier,
    });
    expect(resolveDifficultyMultipliers({ levelBudget: 0.5 })).toEqual({
      waveSize: DIFFICULTY.waveSizeMultiplier,
      levelBudget: 0.5,
      bits: DIFFICULTY.bitsMultiplier,
      enemyMorale: DIFFICULTY.enemyMoraleMultiplier,
    });
    expect(resolveDifficultyMultipliers({ bits: 1.5 })).toEqual({
      waveSize: DIFFICULTY.waveSizeMultiplier,
      levelBudget: DIFFICULTY.levelBudgetMultiplier,
      bits: 1.5,
      enemyMorale: DIFFICULTY.enemyMoraleMultiplier,
    });
    expect(resolveDifficultyMultipliers({ enemyMorale: 1.2 })).toEqual({
      waveSize: DIFFICULTY.waveSizeMultiplier,
      levelBudget: DIFFICULTY.levelBudgetMultiplier,
      bits: DIFFICULTY.bitsMultiplier,
      enemyMorale: 1.2,
    });
  });

  it('all overrides are honoured', () => {
    expect(
      resolveDifficultyMultipliers({ waveSize: 2, levelBudget: 0.75, bits: 1.25, enemyMorale: 1.1 }),
    ).toEqual({
      waveSize: 2,
      levelBudget: 0.75,
      bits: 1.25,
      enemyMorale: 1.1,
    });
  });

  it('an explicit undefined field falls back to the default (not NaN)', () => {
    expect(
      resolveDifficultyMultipliers({
        waveSize: undefined,
        levelBudget: 1.25,
        bits: undefined,
        enemyMorale: undefined,
      }),
    ).toEqual({
      waveSize: DIFFICULTY.waveSizeMultiplier,
      levelBudget: 1.25,
      bits: DIFFICULTY.bitsMultiplier,
      enemyMorale: DIFFICULTY.enemyMoraleMultiplier,
    });
  });
});

/**
 * The enemy pool's rounding, on explicit inputs (a primitive test reads no
 * shipped balance number). The expected values are worked by hand: pool × m,
 * then to the nearest whole.
 */
describe('scaledEnemyPool (the enemy-morale multiplier on a pool)', () => {
  it('at 1 it is the pool exactly', () => {
    for (const pool of [1, 4, 13, 22, 44, 100]) expect(scaledEnemyPool(pool, 1)).toBe(pool);
  });

  it('rounds to the nearest whole', () => {
    // 13 × 1.1 = 14.3 → 14; 13 × 1.2 = 15.6 → 16.
    expect(scaledEnemyPool(13, 1.1)).toBe(14);
    expect(scaledEnemyPool(13, 1.2)).toBe(16);
    // 44 × 1.1 = 48.4 → 48; 44 × 1.2 = 52.8 → 53.
    expect(scaledEnemyPool(44, 1.1)).toBe(48);
    expect(scaledEnemyPool(44, 1.2)).toBe(53);
    // 17 × 1.1 = 18.7 → 19; 17 × 1.2 = 20.4 → 20.
    expect(scaledEnemyPool(17, 1.1)).toBe(19);
    expect(scaledEnemyPool(17, 1.2)).toBe(20);
    // Below 1 it shrinks the same way: 22 × 0.5 = 11.
    expect(scaledEnemyPool(22, 0.5)).toBe(11);
  });

  it('a small pool does not grow at a small step: 4 × 1.1 = 4.4 → 4', () => {
    expect(scaledEnemyPool(4, 1.1)).toBe(4);
    expect(scaledEnemyPool(5, 1.1)).toBe(6); // 5.5, and the half goes up
  });

  it('is never under 1, so no multiplier empties a pool', () => {
    expect(scaledEnemyPool(13, 0.01)).toBe(1);
    expect(scaledEnemyPool(1, 0.4)).toBe(1);
  });
});
