import { describe, expect, it } from 'vitest';

import { RUN_STAT_BASES, foldRunStats, type RunStatModifier } from './runStats';
import { RECRUITMENT } from '../config/recruitment';

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

  // 64a — CONFIG-DERIVED, not pinned to a literal (the balance-proof-tests
  // norm): the offer-size base must track recruitment.json, so a tuning edit
  // there can never silently desync the fold's baseline.
  it('64a: recruitOfferSize base derives from recruitment.json', () => {
    expect(RUN_STAT_BASES.recruitOfferSize).toBe(RECRUITMENT.defaultOfferSize);
  });

  // 64b — same discipline for the promoted tier weights: one source of
  // truth in recruitment.json, the fold's bases can never desync from it.
  it('64b: the four rarity-weight bases derive from recruitment.json', () => {
    expect(RUN_STAT_BASES.rarityWeightCommon).toBe(RECRUITMENT.rarityWeights.common);
    expect(RUN_STAT_BASES.rarityWeightUncommon).toBe(RECRUITMENT.rarityWeights.uncommon);
    expect(RUN_STAT_BASES.rarityWeightRare).toBe(RECRUITMENT.rarityWeights.rare);
    expect(RUN_STAT_BASES.rarityWeightLegendary).toBe(RECRUITMENT.rarityWeights.legendary);
  });

  // 64b — the Seal's exact fold shape: a mult-0 zeroes the weight (adds
  // apply first, then mults; the max(0,·) clamp keeps it sampler-legal).
  it('64b: a mult-0 modifier zeroes a tier weight (the no-commons fold)', () => {
    const folded = foldRunStats(RUN_STAT_BASES, [mod('rarityWeightCommon', 'mult', 0)]);
    expect(folded.rarityWeightCommon).toBe(0);
    expect(folded.rarityWeightUncommon).toBe(RUN_STAT_BASES.rarityWeightUncommon);
  });
});
