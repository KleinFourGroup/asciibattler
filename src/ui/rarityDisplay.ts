/**
 * The rarity stars: the channel for a unit's rarity tier that is not
 * colour. The card's tint by tier (`.unit-card--rarity-*` in ui.css) is
 * too faint to survive grayscale, so the stars carry the tier. The star run
 * is a count, a shape: fixed width, filled and hollow, `★☆☆☆` for common to
 * `★★★★` for legendary, so the tier reads at a glance and the header never
 * changes width between tiers. A count over a written name was the user's
 * call: it reads as an order, where "Uncommon" needs the ladder known. The
 * tier's name is a tooltip on the run (`rarity.<tier>`, a literal key per
 * tier so the key-scan pin sees each one).
 *
 * The run's length is `RARITY_TIERS.length`, and the label table is a
 * `Record<UnitRarity, …>`, so a fifth tier fails to compile until it has a
 * label; `rarityDisplay.test.ts` pins the run's shape against the tier
 * order, derived and never hardcoded. The stars are DOM text and never
 * touch the glyph atlas. Their hue is CSS (`.unit-card--rarity-*
 * .unit-card__rarity`, the tints' four colours), a comfort and not the
 * channel.
 */

import { RARITY_TIERS, type UnitRarity } from '../config/units';
import { t } from '../i18n/ui';

export const STAR_FILLED = '★';
export const STAR_HOLLOW = '☆';

/** The tier's name for the player, one literal key per tier, since the
 *  key-scan pin cannot see a computed key. */
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

/** The run's two halves. The card builder puts each in its own span, so
 *  the hollow half sits dimmer (CSS) and the filled count stands out. */
export function rarityStarParts(tier: UnitRarity): { filled: string; hollow: string } {
  const filled = rarityRank(tier);
  return {
    filled: STAR_FILLED.repeat(filled),
    hollow: STAR_HOLLOW.repeat(RARITY_TIERS.length - filled),
  };
}

export function rarityLabel(tier: UnitRarity): string {
  return RARITY_LABEL[tier];
}
