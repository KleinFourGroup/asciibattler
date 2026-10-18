/**
 * §91d — the chip rule's PLAYER-FACING words, in one place. The run-side
 * `chipRule.ts` owns the arithmetic; this owns what the screens SAY about it:
 * the pre-turn risk line, the last-turn strip's chip lines and the unit
 * card's power tooltip. A tick-capped turn that pays two rules says so
 * instead of mislabeling one of them.
 *
 * Pure (strings in, strings out), so the wording is pinned headless even
 * though the screens that render it are eyeball-only.
 */

import type { ChipRule } from '../run/chipRule';
import { t } from '../i18n/ui';

/** The last-turn strip's two chip lines (on the pre-turn screen): what hit
 *  the ENEMY pool (the line the player is glad about) and what hit the
 *  PLAYER pool. */
export interface ChipLineLabels {
  readonly toEnemyPool: string;
  readonly toPlayerPool: string;
}

/** Labels for the rule set a turn paid (`rulesForTurn(reason)`): casualties
 *  alone, or both (a cap turn under the surcharge). */
export function chipLineLabels(rules: ReadonlySet<ChipRule>): ChipLineLabels {
  if (rules.has('survivors')) {
    return {
      toEnemyPool: t('chip.line.both.toEnemyPool'),
      toPlayerPool: t('chip.line.both.toPlayerPool'),
    };
  }
  return {
    toEnemyPool: t('chip.line.casualties.toEnemyPool'),
    toPlayerPool: t('chip.line.casualties.toPlayerPool'),
  };
}

/** The pre-turn risk line's hover text: what the "up to N" bound counts. */
export function riskLineTitle(): string {
  return t('chip.risk.casualties');
}

/** The unit card's POWER clarifier (the clause after "Power N —"). `team` is
 *  the card's side when the card knows it (the compact battle cards); omit it
 *  for a side-agnostic line (the roster / recruit stat rows). */
export function powerTooltip(team?: 'player' | 'enemy'): string {
  if (team === 'player') return t('chip.power.casualties.player');
  if (team === 'enemy') return t('chip.power.casualties.enemy');
  return t('chip.power.casualties.side');
}

/** 94e — the pool's player-facing NAMES, in one place: the two full gauges
 *  (the pre-turn screen, the HUD) and the persistent chip's short label.
 *  94f flips these to the "morale" wording (the user's DESIGN call) — the
 *  config keys and snapshot fields keep their names. */
export const POOL_LABELS = {
  player: t('pool.player'),
  enemy: t('pool.enemy'),
  chip: t('pool.chip'),
} as const;
