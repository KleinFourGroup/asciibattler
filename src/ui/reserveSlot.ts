/**
 * 101e — the reservation idiom (DESIGN "Layout stability (101)"): a block
 * that comes and goes ABOVE a click target keeps its layout slot and hides
 * by `visibility` (`.is-reserved`, ui.css) instead of leaving the flow — the
 * Promotion delta block's precedent, generalized. On a centered column a
 * removed child re-centers everything, so the control the player just
 * pressed moves out from under the pointer.
 *
 * `visibility: hidden` already drops the subtree from hit-testing and the
 * Tab order; `aria-hidden` keeps the placeholder text away from a reader.
 * The element must carry its REAL content (or content of the same box) —
 * the slot is sized by construction, never by a measured number.
 */
export function reserveSlot(el: HTMLElement): void {
  el.classList.add('is-reserved');
  el.setAttribute('aria-hidden', 'true');
}
