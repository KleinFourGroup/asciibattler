/**
 * 98b — the rarity STARS: the "never color alone" second channel for a
 * unit's rarity tier (Round 7 spec §1). Until 98b rarity was four card-wash
 * tints at alpha ≤ 0.16 (`ui.css` `.unit-card--rarity-*`) — nothing survives
 * grayscale at that alpha, and no text named the tier anywhere. The star run
 * is a COUNT (a shape channel): fixed-width filled + hollow, `★☆☆☆` common →
 * `★★★★` legendary, so the tier reads without counting and the header never
 * shifts width between tiers. The user's call over a written tier name (the
 * kickoff, call A): a count reads ordinally where "Uncommon" needs the ladder
 * known. The tier NAME rides a §97 tooltip on the run (`rarity.<tier>`, a
 * literal key per tier so the key-scan pin sees each one).
 *
 * The run's LENGTH is `RARITY_TIERS.length`, and the table is
 * `Record<UnitRarity, …>` — a fifth tier fails to compile until it picks a
 * label, and `rarityDisplay.test.ts` pins the run shape against the tier
 * order (derived, never hardcoded). DOM text only (the stars never touch the
 * glyph atlas). The hue is CSS (`.unit-card--rarity-* .unit-card__rarity`,
 * the four §61e tint tokens) — comfort, not the channel.
 */

import { RARITY_TIERS, type UnitRarity } from '../config/units';
import { t } from '../i18n/ui';

export const STAR_FILLED = '★';
export const STAR_HOLLOW = '☆';

/** The player-facing tier name, one literal key per tier (the key-scan pin
 *  cannot see a computed key — the 95f EMPOWER_DISPLAY discipline). */
export const RARITY_LABEL: Record<UnitRarity, string> = {
  common: t('rarity.common'),
  uncommon: t('rarity.uncommon'),
  rare: t('rarity.rare'),
  legendary: t('rarity.legendary'),
};

/** 1-based rank of a tier in the ascending `RARITY_TIERS` order. */
export function rarityRank(tier: UnitRarity): number {
  return RARITY_TIERS.indexOf(tier) + 1;
}

/** The two halves of the run — the card builder puts each in its own span
 *  so the hollow half can sit dimmer (CSS), the filled count popping. */
export function rarityStarParts(tier: UnitRarity): { filled: string; hollow: string } {
  const filled = rarityRank(tier);
  return {
    filled: STAR_FILLED.repeat(filled),
    hollow: STAR_HOLLOW.repeat(RARITY_TIERS.length - filled),
  };
}

/** The fixed-width star run as one string: `rank` filled + the rest hollow,
 *  always `RARITY_TIERS.length` glyphs long. */
export function rarityStars(tier: UnitRarity): string {
  const { filled, hollow } = rarityStarParts(tier);
  return filled + hollow;
}

export function rarityLabel(tier: UnitRarity): string {
  return RARITY_LABEL[tier];
}
