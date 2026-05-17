// Step 5.2: shared fade-in / fade-out helpers for UI screen transitions.
// Pairs with `.screen-fade` and `.screen-fade.is-visible` in ui.css.
//
// fadeIn requires the element to already carry the `screen-fade` class and
// to be in the DOM. fadeOutAndRemove removes the element from the DOM after
// FADE_MS; callers must drop their reference before scheduling removal so a
// later show() doesn't operate on the dying element.

export const FADE_MS = 180;

export function fadeIn(el: HTMLElement): void {
  // rAF so the browser commits the initial opacity:0 paint before
  // .is-visible flips it; without this, the transition gets skipped because
  // the two style mutations collapse into one frame.
  requestAnimationFrame(() => el.classList.add('is-visible'));
}

export function fadeOutAndRemove(el: HTMLElement): void {
  el.classList.remove('is-visible');
  setTimeout(() => el.remove(), FADE_MS);
}
