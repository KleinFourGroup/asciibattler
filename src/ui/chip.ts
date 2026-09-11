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
 * cache · map · pool) regardless of construction order, and a hidden chip
 * COLLAPSES — the chips below move up (the §96 kickoff decision D: bits
 * never moves, cache never hides, the map chip is always third when
 * present, the pool chip is display-only, so no click target ever shifts).
 * The column itself takes no pointer events (it is a box over the corner
 * of every screen — its gaps must not swallow a map click); the chips do.
 *
 * A chip's modal / overlay (the cache modal, the sector-map overlay) must
 * NOT mount into the column: the column's z-index makes a stacking
 * context that would trap a `z-index: 30` modal under the `z-index: 20`
 * corner buttons. Those take the page mount separately.
 */

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
