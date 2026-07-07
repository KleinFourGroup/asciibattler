import { describe, expect, it } from 'vitest';

import { RUN_STAT_BASES, foldRunStats, type RunStatModifier } from './runStats';

const mod = (
  stat: RunStatModifier['stat'],
  op: RunStatModifier['op'],
  value: number,
): RunStatModifier => ({ stat, op, value });

describe('foldRunStats (47a — the run-stat fold vocabulary)', () => {
  it('returns the same base object when no modifiers are active (identity guarantee)', () => {
    expect(foldRunStats(RUN_STAT_BASES, [])).toBe(RUN_STAT_BASES);
  });

  it('sums add modifiers across instances', () => {
    const folded = foldRunStats(RUN_STAT_BASES, [
      mod('cacheSize', 'add', 3),
      mod('cacheSize', 'add', 2),
    ]);
    expect(folded.cacheSize).toBe(RUN_STAT_BASES.cacheSize + 5);
  });

  it('multiplies mult modifiers across instances', () => {
    const folded = foldRunStats(RUN_STAT_BASES, [
      mod('bitsGain', 'mult', 1.2),
      mod('bitsGain', 'mult', 1.5),
    ]);
    expect(folded.bitsGain).toBeCloseTo(RUN_STAT_BASES.bitsGain * 1.2 * 1.5, 10);
  });

  it('applies adds before mults within a stat', () => {
    const folded = foldRunStats(RUN_STAT_BASES, [
      mod('cacheSize', 'mult', 0.5),
      mod('cacheSize', 'add', 4),
    ]);
    expect(folded.cacheSize).toBe((RUN_STAT_BASES.cacheSize + 4) * 0.5);
  });

  it('leaves untouched stats at their base value', () => {
    const folded = foldRunStats(RUN_STAT_BASES, [mod('cacheSize', 'add', 1)]);
    expect(folded.bitsGain).toBe(RUN_STAT_BASES.bitsGain);
  });

  it('does not round — fractional multiplier stats survive the fold', () => {
    const folded = foldRunStats(RUN_STAT_BASES, [mod('bitsGain', 'mult', 1.2)]);
    expect(folded.bitsGain).toBe(RUN_STAT_BASES.bitsGain * 1.2);
    expect(Number.isInteger(folded.bitsGain)).toBe(false);
  });

  it('clamps a folded stat at zero', () => {
    const folded = foldRunStats(RUN_STAT_BASES, [mod('cacheSize', 'add', -100)]);
    expect(folded.cacheSize).toBe(0);
  });

  it('does not mutate the base block', () => {
    const base = { ...RUN_STAT_BASES };
    foldRunStats(base, [mod('cacheSize', 'add', 3), mod('bitsGain', 'mult', 2)]);
    expect(base).toEqual(RUN_STAT_BASES);
  });

  // Design pins (the daemon.test.ts catalog-pin precedent): these are the
  // spec-locked launch bases, not tunable balance arithmetic.
  it('pins the spec-locked bases: neutral bitsGain, six cache slots', () => {
    expect(RUN_STAT_BASES.bitsGain).toBe(1);
    expect(RUN_STAT_BASES.cacheSize).toBe(6);
  });
});
