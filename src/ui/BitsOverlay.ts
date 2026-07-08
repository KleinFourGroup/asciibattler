/**
 * 48d — the persistent bits overlay: the game's FIRST page-lifetime UI
 * element. Game owns it (the `playback`/`keybindings` ownership pattern;
 * the `UnitOverlayLayer` "Game-owned DOM inserted once" precedent) and it
 * deliberately never rides the Scene mount/dispose cycle — that cycle is
 * exactly what would kill it on swaps. Top-left corner (the spec lock:
 * bits own the corner in ALL cases; the battle hop chip moved to its
 * right — ui.css `.hud-hop`), visible in and out of battle.
 *
 * Wiring subtleties (the §48 kickoff audit + one found browser-side):
 * - Run's constructor sets `bits` directly — no `run:bitsChanged` fires for
 *   the starting balance, so the first paint reads the live value via the
 *   injected getter.
 * - The FIRST run's `run:started` fires from Game's field initializer,
 *   BEFORE any constructor subscription exists — here it serves only as the
 *   reset re-SHOW signal. It cannot drive the reset re-PAINT either: it
 *   emits from inside the new Run's constructor, i.e. before Game has
 *   reassigned `this.run`, so the getter would read the OLD run's balance
 *   (browser-verified: the chip kept the dead run's total). Game calls
 *   `refresh()` from `resetRun` AFTER the assignment instead.
 * - `Run` is never null; the overlay hides on `run:defeated`/`run:victory`
 *   (a bits chip floating over the game-over screen reads as leftover
 *   chrome) and re-shows on the next `run:started`.
 *
 * Layering: z-index 15 — above every screen (screens carry no z-index, so
 * the chip stays visible over the opaque reward/recruit/post-turn scenes),
 * below the corner card-list buttons (20) and modals (30 — a focused modal
 * may dim it), and below the #scanlines rake (1000) so the CRT treatment
 * covers it like every other piece of chrome.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

/** How long the value-change pulse glows (`.is-pulsing`). */
const PULSE_MS = 450;

export class BitsOverlay {
  private readonly el: HTMLDivElement;
  private readonly value: HTMLSpanElement;
  private pulseTimer: number | null = null;

  constructor(
    mount: HTMLElement,
    bus: EventBus<GameEvents>,
    private readonly getBits: () => number,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'bits-overlay';
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
    // Re-SHOW only — the re-paint comes from Game.resetRun via refresh()
    // (this event fires before Game's run reference is reassigned; see the
    // header).
    bus.on('run:started', () => this.el.classList.remove('is-hidden'));
    bus.on('run:defeated', () => this.el.classList.add('is-hidden'));
    bus.on('run:victory', () => this.el.classList.add('is-hidden'));
  }

  /** Re-read the live balance (the first paint + Game.resetRun's re-paint —
   *  the only sites where the balance changes without a `run:bitsChanged`). */
  refresh(): void {
    this.value.textContent = String(this.getBits());
  }

  /** A brief glow so an earn is noticeable mid-battle without a hitsplat. */
  private pulse(): void {
    if (this.pulseTimer !== null) window.clearTimeout(this.pulseTimer);
    this.el.classList.add('is-pulsing');
    this.pulseTimer = window.setTimeout(() => {
      this.el.classList.remove('is-pulsing');
      this.pulseTimer = null;
    }, PULSE_MS);
  }
}
