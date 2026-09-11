/**
 * 94e — the persistent run-pool chip: the bits chip's page-lifetime sibling
 * (the 48d/49f ownership pattern — Game owns it, it never rides the Scene
 * mount/dispose cycle), the FOURTH chip of the left column (bits · cache · the 78e sector-map chip · this).
 * The user's §93 verdict item 7b: the pool "must be displayed during events —
 * really, everywhere." The battle HUD and the pre/post-turn screens keep
 * their own full gauges (the authoritative in-encounter read); this chip is
 * the always-on one, so the map, an event, the port, a reward, a recruit
 * and the sector seam never hide the run's real budget.
 *
 * Wiring (the BitsOverlay notes apply verbatim):
 * - Run's constructor sets `playerHealth` directly — no event — so the first
 *   paint reads the live value via the injected getter.
 * - The FIRST run's `run:started` fires before any constructor subscription
 *   exists and, on a reset, before Game reassigns `this.run`; it serves as
 *   the re-SHOW signal only. Game calls `refresh()` from `resetRun` /
 *   `restore` AFTER the assignment.
 * - `run:poolChanged` (94e) is the paint signal: the ONE Run chokepoint
 *   (`setPlayerHealth`) emits it for every write — the chip, a rest, the
 *   seam refill, an event's heal or damage op — so the chip cannot go stale
 *   on a path that used to write the field silently (the kickoff audit
 *   found four of the five writes emitted nothing).
 * - Hides on `run:defeated` / `run:victory`, re-shows on `run:started`.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { POOL_LABELS } from './chipLabels';
import { chipPulse } from './chip';

export interface PoolReading {
  readonly current: number;
  readonly max: number;
}

export class PoolOverlay {
  private readonly el: HTMLDivElement;
  private readonly value: HTMLSpanElement;
  private readonly fill: HTMLDivElement;
  private readonly pulse: () => void;

  constructor(
    /** 96e — the chrome column (src/ui/chip.ts), not the page mount. */
    mount: HTMLElement,
    bus: EventBus<GameEvents>,
    private readonly getPool: () => PoolReading,
    startHidden = false,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'chip pool-overlay';
    this.pulse = chipPulse(this.el);
    if (startHidden) this.el.classList.add('is-hidden');
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
    bus.on('run:started', () => this.el.classList.remove('is-hidden'));
    bus.on('run:defeated', () => this.el.classList.add('is-hidden'));
    bus.on('run:victory', () => this.el.classList.add('is-hidden'));
  }

  /** Re-read the live pool (the first paint + Game's post-reassignment
   *  re-paint — the sites where the pool changes without an event). */
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
