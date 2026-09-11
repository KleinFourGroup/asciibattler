/**
 * 96d — THE BUTTON FACTORY: one place that mints a `<button>` (Round 7
 * §96, the idiom pass). Before it, 28 inline `createElement('button')`
 * sites repeated the same four lines — and three of them forgot
 * `type="button"` (the kickoff audit; harmless without a form, wrong on
 * principle) — while `actionButton()` lived byte-identical in PortScreen
 * AND RewardScreen.
 *
 * Deliberately dumb: type · class · label · click. The audio cue stays in
 * the caller's handler (most play `click`, a few `pickup`, the sector-map
 * close plays nothing — the factory must not decide). Chrome comes from
 * the CLASS: `btn--primary` is THE primary-action idiom (ui.css), with the
 * three look modifiers that name a deliberate per-site delta —
 * `btn--dim` (a pass, 0.7 until hovered), `btn--exit` (the game-over pair:
 * amber fill on hover, the only thing on screen), `btn--corner` (the
 * pinned port leave, sized for a corner). A site's POSITION stays on its
 * own class (`.preturn-continue` pins bottom-center, `.port-leave` top-
 * right) — layout is the screen's, look is the idiom's.
 *
 * `label` may be '' for a button that carries children (the character
 * select card); `title` is the native tooltip until §97 replaces it.
 */

export interface ButtonOptions {
  readonly className: string;
  readonly onClick: (ev: MouseEvent) => void;
  readonly title?: string;
}

export function button(label: string, opts: ButtonOptions): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = opts.className;
  if (label !== '') el.textContent = label;
  if (opts.title !== undefined) el.title = opts.title;
  el.addEventListener('click', opts.onClick);
  return el;
}
