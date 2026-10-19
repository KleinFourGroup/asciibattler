/**
 * The bits chip, page-lifetime: Game owns it, and it never rides a scene's
 * mount and dispose, which would kill it on every swap. It is first in the
 * chrome column (src/ui/chip.ts), in the top-left corner on every screen,
 * in battle too.
 *
 * Wiring (gotcha #116):
 * - Run's constructor sets `bits` with no `run:bitsChanged`, so the first
 *   paint reads the live value through the injected getter.
 * - `run:started` only shows the chip again. On a page booted with a
 *   `character` dial, the first run's fires from Game's constructor before
 *   this chip exists; and each run's fires inside the new Run's
 *   constructor, before Game assigns `this.run`, so the getter would read
 *   the old run's balance. Game calls `refresh()` after each assignment
 *   (`resetRun`, `confirmCharacter`, `adopt`).
 * - The chip hides on `run:defeated` and `run:victory` (a bits chip over the
 *   game-over screen reads as leftover chrome), and shows again on the next
 *   `run:started`.
 *
 * Its layering is the chrome column's (ui.css `.chrome-column`, z-index
 * 15): above every screen (screens carry no z-index, so the chip shows over
 * the opaque reward and recruit screens), under the corner card-list
 * buttons (20) and the modals (30), and under the #scanlines rake (1000), so
 * the CRT covers it like every other piece of chrome.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { chipPulse } from './chip';

export class BitsOverlay {
  private readonly el: HTMLDivElement;
  private readonly value: HTMLSpanElement;
  /** A brief glow, so an earn or a spend is noticed with no hitsplat. */
  private readonly pulse: () => void;

  constructor(
    /** The chrome column (src/ui/chip.ts), not the page mount. */
    mount: HTMLElement,
    bus: EventBus<GameEvents>,
    private readonly getBits: () => number,
    /** Start hidden when no Run exists yet (a boot to the character
     *  select); `run:started` shows the chip when the select confirms (the
     *  new Run's constructor emits it, and the subscription below is live by
     *  then, unlike a boot with a `character` dial, whose Run comes before
     *  this chip). */
    startHidden = false,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'chip bits-overlay';
    this.pulse = chipPulse(this.el);
    if (startHidden) this.el.classList.add('is-hidden');
    this.value = document.createElement('span');
    this.value.className = 'bits-overlay__value';
    const label = document.createElement('span');
    label.className = 'bits-overlay__label';
    label.textContent = 'bits';
    this.el.appendChild(this.value);
    this.el.appendChild(label);
    mount.appendChild(this.el);
    this.refresh();

    // Page-lifetime subscriptions — never unsubscribed (the overlay lives
    // exactly as long as the bus does).
    bus.on('run:bitsChanged', ({ bits }) => {
      this.value.textContent = String(bits);
      this.pulse();
    });
    // Shows the chip only; the repaint is Game's `refresh()` (this event
    // fires before Game assigns the new run; see the header).
    bus.on('run:started', () => this.el.classList.remove('is-hidden'));
    bus.on('run:defeated', () => this.el.classList.add('is-hidden'));
    bus.on('run:victory', () => this.el.classList.add('is-hidden'));
  }

  /** Show the chip for a run that was loaded, not created: a loaded run
   *  emits no `run:started`, so Game says so itself (`Game.adopt`). */
  reveal(): void {
    this.el.classList.remove('is-hidden');
  }

  /** Hide the chip for a run that was left, not ended (Quit to menu):
   *  no `run:defeated` or `run:victory` says so. */
  conceal(): void {
    this.el.classList.add('is-hidden');
  }

  /** Re-read the live balance: the first paint, and Game's repaint after it
   *  assigns a run, the places the balance changes with no
   *  `run:bitsChanged`. */
  refresh(): void {
    this.value.textContent = String(this.getBits());
  }
}
