/**
 * The short labels of the 11 raw `UnitStats`, in one place so no list of
 * stats can drift on a label or the order: iterating
 * `Object.keys(STAT_LABELS)` gives the order (CON, STR, RNG, MAG, LCK, DEF,
 * PRC, EVA, SPD, MOB, POW; the card lifts POW above its grid). It is the
 * level-up draws' order (`STAT_KEYS` in `leveling.ts`), kept the same by
 * hand, so the card's rows and the draws read alike.
 */

import type { UnitStats } from '../sim/Unit';
import { t } from '../i18n/ui';

// The labels come from the UI string table; the key order below is the
// display order, so it stays in code.
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
