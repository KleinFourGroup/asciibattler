/**
 * The button factory: one place that mints a `<button>`, always with
 * `type="button"`.
 *
 * Deliberately dumb: type, class, label, click. The audio cue stays in the
 * caller's handler (most play `click`, a few `pickup`), since the factory
 * must not decide. The look comes from the class: `btn--primary` is the
 * primary-action idiom (ui.css), with two modifiers that name a deliberate
 * per-site delta, `btn--dim` (a pass, 0.7 until hovered) and `btn--exit`
 * (the end screens' controls, game over and sector cleared: an amber fill
 * on hover, with nothing else on screen to act on). A site's position stays
 * on its own class (`.preturn-continue` pins bottom-center): layout is the
 * screen's, look is the idiom's. A control in the control column (Roster,
 * Leave port) wears the chip's plate instead, `chip control-chip`.
 *
 * `label` may be '' for a button that carries children (the character
 * select card); `tooltip` attaches the tooltip as a control's, so touch
 * opens it with a long-press and the tap keeps acting.
 */

import { attachTooltip, type TooltipContent } from './tooltip';

interface ButtonOptions {
  readonly className: string;
  readonly onClick: (ev: MouseEvent) => void;
  readonly tooltip?: TooltipContent;
}

export function button(label: string, opts: ButtonOptions): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = opts.className;
  if (label !== '') el.textContent = label;
  if (opts.tooltip !== undefined) attachTooltip(el, opts.tooltip, { touch: 'press' });
  el.addEventListener('click', opts.onClick);
  return el;
}
