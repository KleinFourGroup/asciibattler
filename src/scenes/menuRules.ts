/**
 * 116c — the menu's rules, pure, so they are pinned without a page.
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
 *
 * THE SEED A RUN SHOWS (116c-post2, on its end screen) is what the field
 * takes back: `seedShown`, below.
 *
 * THE CREDITS ON THE WAY (116j): a won run's end screen leads to the menu,
 * and the first time by way of the credits. `creditsOnTheWay` is the rule.
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

/** The seed a run shows the player: its stream root (`Run.streamRoot`), as
 *  digits. A run reads its seed only as `seed >>> 0`, so the root names the
 *  same run as the seed it was created with, in ten digits at most where a
 *  seed drawn from the clock is thirteen. A loaded run has its root too,
 *  where the seed as given is only in a journal's start. */
export function seedShown(streamRoot: number): string {
  return String(streamRoot);
}

/**
 * Whether leaving a run's end screen opens the credits over the menu: the
 * run was won, the page goes to the menu from a run's end (it booted to the
 * menu; a page booted by a run dial starts the next run instead), and the
 * credits have not been shown this way before. A defeat never shows them,
 * and the menu's own Credits row is always there.
 */
export function creditsOnTheWay(won: boolean, toMenu: boolean, creditsSeen: boolean): boolean {
  return won && toMenu && !creditsSeen;
}
