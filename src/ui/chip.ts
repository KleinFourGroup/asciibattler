/**
 * 96e — THE CHIP BASE + THE CHROME COLUMN (Round 7 §96, the idiom pass).
 *
 * The four page-lifetime chips (bits 48d · cache 49f · sector map 78e ·
 * pool 94e) each carried the same terminal plate in CSS, the same
 * `PULSE_MS = 450` + `pulse()` copy in TS, and a `position: fixed; top: N`
 * measured by hand from the chip above (20 · 76 · 132 · 188 px) — a
 * 5-digit balance or a font change desynchronized the column, and a hidden
 * chip (the map chip hides on MapScene) left its slot as a hole.
 *
 * Now: `.chip` is the plate (ui.css), `chipPulse(el)` is the one pulse,
 * and `createChromeColumn(mount)` is a Game-owned flex column the chips
 * mount INTO. Order is fixed by CSS `order` on each chip class (bits ·
 * cache · map · pool · can't-save; the can't-save chip is 116i's)
 * regardless of construction order, and a hidden chip COLLAPSES — the
 * chips below move up (the §96 kickoff decision D: bits never moves, cache
 * never hides, the map chip is always third when present, the pool chip
 * and the can't-save chip are display-only, so no click target ever
 * shifts). The column holds the run's state and the map; the settings chip
 * (116d) left it for the control column, below.
 * The column itself takes no pointer events (it is a box over the corner
 * of every screen — its gaps must not swallow a map click); the chips do.
 *
 * 101b — ONE WIDTH: the column owns `--chip-w` (ui.css `:root`) and every
 * chip stretches to it, so a chip's box depends on neither its text nor
 * which siblings are showing; the plate is `box-sizing: border-box` +
 * `white-space: nowrap` (two chips are <button>s, two are <div>s — the old
 * `min-width` meant two different outer widths). The battle HUD's hop chip
 * wears the same plate and sits at the column's left + `--chip-w` + a gutter.
 *
 * A chip's modal / overlay (the cache modal, the sector-map overlay) must
 * NOT mount into the column: the column's z-index makes a stacking
 * context that would trap a `z-index: 30` modal under the `z-index: 20`
 * corner buttons. Those take the page mount separately.
 *
 * THE CONTROL COLUMN is the chrome column's mirror in the top-right corner:
 * the same top, inset, width and plate. Its first row is the settings chip,
 * at one place on every screen of a run. Its second row is the one control
 * the screen that is up owns (Roster; Leave port; in a battle the speed
 * strip), which that screen puts into the column's slot and takes out when
 * it hides. The two rows are one height, so the strip is as tall as a chip
 * without either being measured. Everything the slot holds lies in one
 * cell, so while one screen fades out and the next fades in their two
 * controls cross in place, as they did when each was pinned to the corner.
 */

import { fadeIn } from './fade';

/** How long the value-change pulse glows (`.is-pulsing`). */
export const CHIP_PULSE_MS = 450;

/** The one pulse: returns a function that flashes `.is-pulsing` on `el`
 *  for CHIP_PULSE_MS, restarting the timer on a re-pulse. */
export function chipPulse(el: HTMLElement): () => void {
  let timer: number | null = null;
  return () => {
    if (timer !== null) window.clearTimeout(timer);
    el.classList.add('is-pulsing');
    timer = window.setTimeout(() => {
      el.classList.remove('is-pulsing');
      timer = null;
    }, CHIP_PULSE_MS);
  };
}

/** The Game-owned column the chips mount into (appended once to #ui). */
export function createChromeColumn(mount: HTMLElement): HTMLDivElement {
  const column = document.createElement('div');
  column.className = 'chrome-column';
  mount.appendChild(column);
  return column;
}

export interface ControlColumn {
  /** The column: the settings chip goes in as its first child. */
  readonly column: HTMLDivElement;
  /** The second row: the control of the screen that is up, or nothing. */
  readonly slot: HTMLDivElement;
}

/** The Game-owned control column (appended once to #ui, before the chrome
 *  column, so the Tab walk goes from a screen to Settings, to the screen's
 *  own control, and then to the chips). */
export function createControlColumn(mount: HTMLElement): ControlColumn {
  const column = document.createElement('div');
  column.className = 'control-column';
  const slot = document.createElement('div');
  slot.className = 'control-slot';
  column.appendChild(slot);
  mount.appendChild(column);
  return { column, slot };
}

/** Put a screen's control into the slot, fading in with its screen. The
 *  screen removes it on hide (at once, or by `fadeOutAndRemove`). */
export function mountControl(slot: HTMLElement, el: HTMLElement): void {
  el.classList.add('screen-fade');
  slot.appendChild(el);
  fadeIn(el);
}
