/**
 * 96c — the Screen base: ONE show / hide / fade lifecycle for the eleven
 * full-viewport DOM screens (character select · map · pre-turn · post-turn
 * · promotion · recruit · reward · port · event · sector cleared · game
 * over). Before it, each re-implemented the same four lines around
 * `fade.ts` by hand (the Round 7 kickoff audit §E "screen shells ×13").
 *
 * The shape, chosen so no scene call site and no `show()` signature moved:
 *
 *   show(...args) {            // the subclass keeps its own arguments
 *     this.hide();             // EXPLICIT, first — the subclass's hide()
 *                              // tears down ITS state; PreTurnScreen then
 *                              // seeds fresh state before rendering, so the
 *                              // base must never hide implicitly
 *     …build el…
 *     this.present(el);        // mount + fade in (the only shared part)
 *   }
 *   override hide() {          // only if the subclass has its own teardown
 *     …its teardown…
 *     super.hide();            // fade out + remove + null the container
 *   }
 *
 * `present` does NOT hide a previous container: a screen that presents
 * twice without hiding would leak the first, and that is the subclass's
 * bug to see, not the base's to paper over. The HUD is not a Screen — it
 * is seven independently faded panes over the battle canvas (HUD.ts) and
 * keeps its own lifecycle; the two modals (CardListModal, the cache modal)
 * and the sector-map overlay are the 96f shell's business.
 */

import { fadeIn, fadeOutAndRemove } from './fade';

export abstract class Screen {
  /** The mounted root while shown; null between show() and hide(). */
  protected container: HTMLDivElement | null = null;

  protected constructor(protected readonly mount: HTMLElement) {}

  /** Mount `el` as this screen's root and fade it in (`.screen-fade` +
   *  `.is-visible` on the next frame — see fade.ts for the rAF reason). */
  protected present(el: HTMLDivElement): void {
    el.classList.add('screen-fade');
    this.mount.appendChild(el);
    this.container = el;
    fadeIn(el);
  }

  /** Fade the root out and remove it after FADE_MS; the reference drops NOW
   *  so a show() during the fade never touches the dying element. */
  hide(): void {
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
    }
  }
}
