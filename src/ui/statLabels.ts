/**
 * Shared short labels for the 8 raw `UnitStats`, used by every screen that
 * lists a unit's stat block (PromotionScreen deltas + the RecruitScreen
 * card). Kept in one place so the two screens can't drift on label text or
 * ordering — iterating `Object.keys(STAT_LABELS)` yields the canonical
 * display order (CON, STR, RNG, MAG, LCK, AGI, MOB, DEF).
 */

import type { UnitStats } from '../sim/Unit';

export const STAT_LABELS: Record<keyof UnitStats, string> = {
  constitution: 'CON',
  strength: 'STR',
  ranged: 'RNG',
  magic: 'MAG',
  luck: 'LCK',
  agility: 'AGI',
  mobility: 'MOB',
  defense: 'DEF',
};
