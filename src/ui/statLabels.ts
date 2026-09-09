/**
 * Shared short labels for the 11 raw `UnitStats`, used by every screen that
 * lists a unit's stat block (PromotionScreen deltas + the RecruitScreen
 * card). Kept in one place so the two screens can't drift on label text or
 * ordering — iterating `Object.keys(STAT_LABELS)` yields the canonical
 * display order (CON, STR, RNG, MAG, LCK, DEF, PRC, EVA, SPD, MOB, POW). I1
 * keeps this in sync with `STAT_KEYS` (the level-up draw order) so "draw order
 * == card order" holds.
 */

import type { UnitStats } from '../sim/Unit';
import { t } from '../i18n/ui';

// §95c — the labels come from the UI string table; the KEY ORDER below is
// the load-bearing part (it is the display order) and stays in code.
export const STAT_LABELS: Record<keyof UnitStats, string> = {
  constitution: t('stat.constitution'),
  strength: t('stat.strength'),
  ranged: t('stat.ranged'),
  magic: t('stat.magic'),
  luck: t('stat.luck'),
  defense: t('stat.defense'),
  precision: t('stat.precision'),
  evasion: t('stat.evasion'),
  speed: t('stat.speed'),
  mobility: t('stat.mobility'),
  power: t('stat.power'),
};
