/**
 * The rarity star run, pinned against the tier ORDER (derived from
 * `RARITY_TIERS`, never hardcoded — a fifth tier re-derives every expectation
 * here and fails `RARITY_LABEL`'s `Record<UnitRarity, …>` at compile time
 * until it picks a label).
 */

import { describe, expect, it } from 'vitest';
import { RARITY_TIERS, type UnitRarity } from '../config/units';
import { RARITY_LABEL, STAR_FILLED, STAR_HOLLOW, rarityLabel, rarityRank, rarityStarParts } from './rarityDisplay';

/** The star run as the card shows it, its two halves side by side. */
function starRun(tier: UnitRarity): string {
  const { filled, hollow } = rarityStarParts(tier);
  return filled + hollow;
}

describe('rarityStarParts', () => {
  it('every tier renders exactly RARITY_TIERS.length glyphs (fixed width)', () => {
    for (const tier of RARITY_TIERS) {
      expect([...starRun(tier)], tier).toHaveLength(RARITY_TIERS.length);
    }
  });

  it('the filled count is the 1-based tier rank, hollow fills the rest', () => {
    RARITY_TIERS.forEach((tier, i) => {
      const run = [...starRun(tier)];
      expect(rarityRank(tier), tier).toBe(i + 1);
      expect(run.filter((g) => g === STAR_FILLED), tier).toHaveLength(i + 1);
      expect(run.filter((g) => g === STAR_HOLLOW), tier).toHaveLength(RARITY_TIERS.length - i - 1);
      // Filled first, hollow after — the run is a bar, not a scatter.
      expect(run.join(''), tier).toBe(STAR_FILLED.repeat(i + 1) + STAR_HOLLOW.repeat(RARITY_TIERS.length - i - 1));
    });
  });

  it('the lowest tier is one filled star, the highest is all filled', () => {
    expect(starRun(RARITY_TIERS[0])).toBe(STAR_FILLED + STAR_HOLLOW.repeat(RARITY_TIERS.length - 1));
    expect(starRun(RARITY_TIERS[RARITY_TIERS.length - 1]!)).toBe(STAR_FILLED.repeat(RARITY_TIERS.length));
  });

  it('every tier has a non-empty label distinct from the others', () => {
    const labels = RARITY_TIERS.map((tier) => rarityLabel(tier));
    for (const [i, label] of labels.entries()) {
      expect(label, RARITY_TIERS[i]).toBeTypeOf('string');
      expect(label.length, RARITY_TIERS[i]).toBeGreaterThan(0);
    }
    expect(new Set(labels).size).toBe(RARITY_TIERS.length);
    expect(Object.keys(RARITY_LABEL).sort()).toEqual([...RARITY_TIERS].sort());
  });
});
