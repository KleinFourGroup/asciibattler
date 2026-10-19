/**
 * The Screen base: one show, hide and fade lifecycle for the twelve
 * full-viewport DOM screens (menu, character select, map, pre-turn,
 * promotion, recruit, reward, port, event, rest, sector cleared, game
 * over).
 *
 * The shape:
 *
 *   show(...args) {            // the subclass keeps its own arguments
 *     this.hide();             // explicit, first: the subclass's hide()
 *                              // tears down its state; PreTurnScreen then
 *                              // seeds fresh state before rendering, so the
 *                              // base must never hide implicitly
 *     …build el…
 *     this.present(el);        // mount and fade in (the only shared part)
 *   }
 *   override hide() {          // only if the subclass has its own teardown
 *     …its teardown…
 *     super.hide();            // fade out, remove, null the container
 *   }
 *
 * `present` does not hide a previous container: a screen that presents
 * twice without hiding would leak the first, and that is the subclass's
 * bug to see, not the base's to paper over. The HUD is not a Screen: it is
 * seven independently faded panes over the battle canvas (HUD.ts) and keeps
 * its own lifecycle; the modals and overlays are modal.ts's.
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
    // The screen takes focus on present (`tabindex=-1`, no scroll, no ring:
    // `.screen-fade:focus { outline: none }`, since a container is not a
    // control, as the modal shell's isn't), so the next Tab enters this
    // screen's controls instead of resuming from wherever the previous
    // screen's removed control sat, which in Firefox ran the walk off the
    // document, through the browser's UI and around to the chrome column.
    el.tabIndex = -1;
    el.focus({ preventScroll: true });
    fadeIn(el);
  }

  /** Fade the root out and remove it after FADE_MS; the reference drops at
   *  once, so a show() during the fade never touches the dying element. */
  hide(): void {
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
    }
  }
}
