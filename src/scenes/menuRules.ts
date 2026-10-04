/**
 * 116c — the menu's two rules, pure, so they are pinned without a page.
 *
 * WHEN THE MENU BOOTS (Round 8 spec D6): on a plain URL. A run dial that
 * parses (`seed=`, `character=`, …) or a board-explorer bookmark (`bp=`) is a
 * dev entry, and the page boots as it did before the menu: the map with a
 * character pinned, character select without. Every driver pins `character=`
 * (the board fixtures, the probe runner's `--seed`, the recorder, `drive()`),
 * so none of them meets the menu. A dial whose value parses to nothing
 * (`?character=nobody`) changed nothing, so that page is a plain boot.
 *
 * THE SEED FIELD holds digits only. Its text is cleaned as it is typed, so
 * the field has no refused state to show, and it is read through the URL
 * dial's own parser, so the field and `?seed=` accept the same seeds.
 */

import { parseRunConfig, RUN_CONFIG_PARAMS } from '../run/RunConfig';

/** The board explorer's URL parameter. Spelled here because its own module
 *  (`BOARD_PANEL_PARAM`, src/dev/boardPanel/state.ts) is DEV-only and this
 *  one ships; menuRules.test.ts holds the two equal. */
export const BOOKMARK_PARAM = 'bp';

/** The most digits a seed takes. Every number that long is an exact integer,
 *  and a seed the game drew from the clock (13 digits) fits. */
export const SEED_MAX_DIGITS = 15;

/** Whether a page at this URL query boots to the menu. */
export function bootsToMenu(search: string): boolean {
  const params = new URLSearchParams(search);
  if (params.has(BOOKMARK_PARAM)) return false;
  return Object.keys(parseRunConfig(params)).length === 0;
}

/** What the seed field keeps of what was typed or pasted into it. */
export function cleanSeedText(raw: string): string {
  return raw.replace(/\D+/g, '').slice(0, SEED_MAX_DIGITS);
}

/** The seed the field's text names; undefined when it names none, and the
 *  run's seed is then the caller's to pick. */
export function seedFromText(text: string): number | undefined {
  const clean = cleanSeedText(text);
  if (clean === '') return undefined;
  return parseRunConfig(new URLSearchParams({ [RUN_CONFIG_PARAMS.seed]: clean })).seed;
}
