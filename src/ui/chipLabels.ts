/**
 * §91d — the chip rule's PLAYER-FACING words, in one place. The run-side
 * `chipRule.ts` owns the arithmetic; this owns what the screens SAY about it,
 * keyed on the rule(s) a turn charges by, so the pre-turn risk line, the
 * post-turn chip lines and the unit card's power tooltip flip together when
 * `health.chipMode` does (91e flips the default) — and a tick-capped turn
 * that pays two rules says so instead of mislabeling one of them.
 *
 * Pure (strings in, strings out), so the wording is pinned headless even
 * though the screens that render it are eyeball-only.
 */

import type { ChipRule } from '../run/chipRule';

/** The two post-turn chip lines: what hit the ENEMY pool (the line the player
 *  is glad about) and what hit the PLAYER pool. */
export interface ChipLineLabels {
  readonly toEnemyPool: string;
  readonly toPlayerPool: string;
}

/** Labels for the rule set a turn paid (`rulesForTurn(reason)`): survivors
 *  alone, casualties alone, or both (a cap turn under the surcharge). */
export function chipLineLabels(rules: ReadonlySet<ChipRule>): ChipLineLabels {
  const survivors = rules.has('survivors');
  const casualties = rules.has('casualties');
  if (survivors && casualties) {
    return {
      toEnemyPool: 'Enemy fallen + your survivors → enemy pool',
      toPlayerPool: 'Your fallen + enemy survivors → your pool',
    };
  }
  if (casualties) {
    return {
      toEnemyPool: 'Enemy fallen → enemy pool',
      toPlayerPool: 'Your fallen → your pool',
    };
  }
  return {
    toEnemyPool: 'Your survivors → enemy pool',
    toPlayerPool: 'Enemy survivors → your pool',
  };
}

/** The pre-turn risk line's hover text: what the "up to N" bound counts. */
export function riskLineTitle(mode: ChipRule): string {
  return mode === 'casualties'
    ? 'The most your pool can lose this turn: every unit in your hand falling. Only your own fallen cost you — win without losses and you lose nothing.'
    : 'The most your pool can lose this turn: every enemy in the wave surviving the fight. Kill them and you lose nothing.';
}

/** The unit card's POWER clarifier (the clause after "Power N —"). `team` is
 *  the card's side when the card knows it (the compact battle cards); omit it
 *  for a side-agnostic line (the roster / recruit stat rows). */
export function powerTooltip(mode: ChipRule, team?: 'player' | 'enemy'): string {
  if (mode === 'casualties') {
    if (team === 'player') return 'what your pool loses if this unit falls';
    if (team === 'enemy') return 'what the enemy pool loses when this unit falls';
    return "what its side's pool loses if this unit falls";
  }
  return 'chips the opposing health pool each turn it survives';
}
