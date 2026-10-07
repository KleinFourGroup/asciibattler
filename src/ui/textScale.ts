/**
 * 116k — THE TEXT SCALE: the settings' multiplier on the UI's text (Round 8
 * spec D7).
 *
 * Every font-size in ui.css is a `--text-*` token in rem, and the boxes that
 * hold text are sized in rem too (DESIGN "Tokens"), so the DOM layer follows
 * one number: the root element's font-size. It is set as a percentage, so it
 * multiplies the browser's own default instead of replacing it. What is not
 * text keeps its size at every scale: the canvas, the map's node grid, the
 * bars over a unit, and gaps, borders and paddings, which are in px.
 *
 * THE OFFERED SIZES are measured ones (WORKLOG §116k): each was laid out on
 * every screen of a driven run. A larger size needs a larger window; the
 * settings row says so. The stored field takes any number from 0.5 to 3
 * (src/settings/settings.ts), and the page draws the nearest offered size,
 * so a hand-edited store can't put the settings modal out of reach.
 *
 * THE HOLD: while the settings modal is up, a new size is stored at once
 * and drawn when the modal closes. Drawn at once it would re-lay the modal
 * under the pointer that chose it, and a control must not move across its
 * own click (DESIGN "Layout stability").
 */

export const TEXT_SCALE_CHOICES = [1, 1.1, 1.25, 1.5] as const;
export type TextScaleChoice = (typeof TEXT_SCALE_CHOICES)[number];

/** The offered size nearest a stored value; a tie takes the smaller. */
export function nearestTextScale(stored: number): TextScaleChoice {
  let best: TextScaleChoice = TEXT_SCALE_CHOICES[0];
  for (const choice of TEXT_SCALE_CHOICES) {
    if (Math.abs(choice - stored) < Math.abs(best - stored)) best = choice;
  }
  return best;
}

/** The root element's font-size for a size: none at 1, so the page is then
 *  exactly the page without the setting. */
export function rootFontSize(scale: TextScaleChoice): string {
  return scale === 1 ? '' : `${Math.round(scale * 100)}%`;
}

/** The root element, as far as this module uses it; a test hands in a stand-in. */
export interface TextScaleRoot {
  readonly style: { fontSize: string };
}

let holds = 0;
let waiting: number | null = null;

function draw(stored: number, root: TextScaleRoot | undefined): void {
  const el = root ?? (typeof document === 'undefined' ? undefined : document.documentElement);
  if (el === undefined) return;
  el.style.fontSize = rootFontSize(nearestTextScale(stored));
}

/** The setting's consumer (src/settings/apply.ts): draw the page at the
 *  stored size now, or when the last hold is released. */
export function setTextScale(stored: number, root?: TextScaleRoot): void {
  if (holds > 0) {
    waiting = stored;
    return;
  }
  draw(stored, root);
}

/** Keep the page at its size until the returned function is called (once);
 *  the last size set meanwhile is drawn then. */
export function holdTextScale(root?: TextScaleRoot): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    if (holds > 0 || waiting === null) return;
    const stored = waiting;
    waiting = null;
    draw(stored, root);
  };
}
