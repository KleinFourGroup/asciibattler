/**
 * The run's pool chip, page-lifetime like the bits chip: Game owns it, and
 * it never rides a scene's mount and dispose. It is fourth in the chrome
 * column, after bits, the cache and the sector map. The pool is shown
 * everywhere in a run. The battle HUD and the pre-turn screen have full
 * gauges of their own, so the chip hides while one of them is up
 * (`setSuppressed`, from Game's swap) and morale reads once per screen; on
 * every other screen of a run this chip is the one read of the pool.
 *
 * Wiring:
 * - Run's constructor sets `playerHealth` with no event, so the first paint
 *   reads the live value through the injected getter.
 * - `run:started` only shows the chip again: the first run's, on a page
 *   booted with a `character` dial, fires before the chip exists, and a
 *   later one before Game assigns the new run. Game calls `refresh()` after
 *   each assignment (`resetRun`, `confirmCharacter`, `adopt`); gotcha #116.
 * - `run:poolChanged` is the paint signal: Run's one writer,
 *   `setPlayerHealth`, emits it for every change (a turn's charge, a rest,
 *   the seam's refill, an event's heal or damage), so no path leaves the
 *   chip stale.
 * - It hides on `run:defeated` and `run:victory`, and shows again on
 *   `run:started`.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { POOL_LABELS } from './chipLabels';
import { chipPulse } from './chip';

interface PoolReading {
  readonly current: number;
  readonly max: number;
}

export class PoolOverlay {
  private readonly el: HTMLDivElement;
  private readonly value: HTMLSpanElement;
  private readonly fill: HTMLDivElement;
  private readonly pulse: () => void;
  /** Hidden by the run's state: before a run, after a defeat or a victory,
   *  and after Quit to menu. */
  private runHidden: boolean;
  /** Hidden by the scene: a pre-turn or battle screen is up, whose full
   *  gauges are the one morale read, and the chip would make it read twice.
   *  Pushed by Game's swap. Two flags, one class: `is-hidden` is either, so
   *  a defeat inside a battle and the game-over swap after it can't fight
   *  over the class. */
  private suppressed = false;

  constructor(
    /** The chrome column (src/ui/chip.ts), not the page mount. */
    mount: HTMLElement,
    bus: EventBus<GameEvents>,
    private readonly getPool: () => PoolReading,
    startHidden = false,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'chip pool-overlay';
    this.pulse = chipPulse(this.el);
    this.runHidden = startHidden;
    this.applyHidden();
    const head = document.createElement('div');
    head.className = 'pool-overlay__head';
    const label = document.createElement('span');
    label.className = 'pool-overlay__label';
    label.textContent = POOL_LABELS.chip;
    this.value = document.createElement('span');
    this.value.className = 'pool-overlay__value';
    head.append(label, this.value);
    const bar = document.createElement('div');
    bar.className = 'pool-overlay__bar';
    this.fill = document.createElement('div');
    this.fill.className = 'pool-overlay__fill';
    bar.appendChild(this.fill);
    this.el.append(head, bar);
    mount.appendChild(this.el);
    this.refresh();

    // Page-lifetime subscriptions — never unsubscribed (the overlay lives
    // exactly as long as the bus does).
    bus.on('run:poolChanged', ({ after, max, reason }) => {
      this.paint(after, max);
      this.el.classList.toggle('is-losing', reason === 'chip' || reason === 'damage');
      this.pulse();
    });
    bus.on('run:started', () => this.setRunHidden(false));
    bus.on('run:defeated', () => this.setRunHidden(true));
    bus.on('run:victory', () => this.setRunHidden(true));
  }

  /** The scene's hide, pushed by Game's `swap` on every swap: true while a
   *  pre-turn or battle scene is mounted. The chrome column collapses the
   *  slot. */
  setSuppressed(suppressed: boolean): void {
    this.suppressed = suppressed;
    this.applyHidden();
  }

  /** Show the chip for a run that was loaded, not created: a loaded run
   *  emits no `run:started`, so Game says so itself (`Game.adopt`). The
   *  scene's own hide still applies. */
  reveal(): void {
    this.setRunHidden(false);
  }

  /** Hide the chip for a run that was left, not ended (Quit to menu):
   *  no `run:defeated` or `run:victory` says so. */
  conceal(): void {
    this.setRunHidden(true);
  }

  private setRunHidden(hidden: boolean): void {
    this.runHidden = hidden;
    this.applyHidden();
  }

  private applyHidden(): void {
    this.el.classList.toggle('is-hidden', this.runHidden || this.suppressed);
  }

  /** Re-read the live pool: the first paint, and Game's repaint after it
   *  assigns a run, the places the pool changes with no event. */
  refresh(): void {
    const { current, max } = this.getPool();
    this.el.classList.remove('is-losing');
    this.paint(current, max);
  }

  private paint(current: number, max: number): void {
    this.value.textContent = `${Math.max(0, current)} / ${max}`;
    const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.fill.style.width = `${pct * 100}%`;
    this.el.classList.toggle('is-low', max > 0 && current / max <= 0.25);
  }
}
