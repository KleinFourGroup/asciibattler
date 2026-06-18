/**
 * R1 — the shared roster-view surface. A modal overlay that lists the player's
 * full roster as shared `full` UnitCards (P's component, the `roster` skin), and
 * a `RosterButton` controller that pairs a top-right "Roster" button with it.
 * The brief asks for one roster affordance reused on the Map / Recruit /
 * pre-turn screens ("These should all probably share code") — this is that one
 * piece; each screen just mounts a `RosterButton`.
 *
 * Presentation = a modal overlay (the user's call): a dimmed backdrop with a
 * bordered, scrollable panel; Esc, a backdrop click, or the ✕ all dismiss it.
 * The card ordering rides the pluggable `rosterOrder` seam (default recruitment
 * order).
 */

import type { UnitTemplate } from '../sim/Unit';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { buildUnitCard, unitCardFromTemplate } from './UnitCard';
import { orderRoster, type RosterOrder } from './rosterOrder';

export interface RosterViewOptions {
  /** Display order (the pluggable seam). Defaults to recruitment order. */
  readonly order?: RosterOrder;
}

/**
 * The modal overlay itself. Self-contained DOM + lifecycle; `open`/`close` are
 * idempotent. Mounts its overlay on the supplied `mount` (the shared UI mount),
 * a sibling of the host screen so it overlays at full opacity regardless of the
 * screen's fade/scroll state.
 */
export class RosterView {
  private overlay: HTMLDivElement | null = null;
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };

  constructor(
    private readonly mount: HTMLElement,
    private readonly audio: AudioPlayer,
  ) {}

  get isOpen(): boolean {
    return this.overlay !== null;
  }

  open(roster: readonly UnitTemplate[], opts?: RosterViewOptions): void {
    if (this.overlay) return; // already open — idempotent

    const overlay = document.createElement('div');
    overlay.className = 'roster-overlay';
    // Only a click on the backdrop itself (not one bubbling up from the modal)
    // dismisses, so clicks inside the panel don't close it.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    const modal = document.createElement('div');
    modal.className = 'roster-modal';

    const header = document.createElement('div');
    header.className = 'roster-modal-header';
    const title = document.createElement('div');
    title.className = 'roster-modal-title';
    title.textContent = `Your Roster — ${roster.length} unit${roster.length === 1 ? '' : 's'}`;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'roster-modal-close';
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Close roster');
    close.addEventListener('click', () => {
      this.audio.play('click');
      this.close();
    });
    header.append(title, close);

    const grid = document.createElement('div');
    grid.className = 'roster-grid';
    if (roster.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'roster-empty';
      empty.textContent = 'No units in your roster.';
      grid.appendChild(empty);
    } else {
      for (const unit of orderRoster(roster, opts?.order)) {
        const { el } = buildUnitCard(unitCardFromTemplate(unit), {
          mode: 'full',
          skin: 'roster',
        });
        grid.appendChild(el);
      }
    }

    modal.append(header, grid);
    overlay.appendChild(modal);
    this.mount.appendChild(overlay);
    this.overlay = overlay;
    window.addEventListener('keydown', this.onKeyDown);
  }

  close(): void {
    if (!this.overlay) return;
    window.removeEventListener('keydown', this.onKeyDown);
    this.overlay.remove();
    this.overlay = null;
  }

  /** Tear down for a host-screen `hide()` — closes any open overlay + detaches
   *  the Esc handler so a dismissed screen can't leave a live listener. */
  dispose(): void {
    this.close();
  }
}

/**
 * The reusable "view roster" affordance: a top-right button wired to a
 * `RosterView`. The roster is snapshotted at construction (it can't change while
 * a screen is up). The caller appends `.el` into its panel and calls `dispose()`
 * on screen `hide()` (which also closes the overlay if it's open).
 */
export class RosterButton {
  readonly el: HTMLButtonElement;
  private readonly view: RosterView;

  constructor(
    mount: HTMLElement,
    private readonly audio: AudioPlayer,
    private readonly roster: readonly UnitTemplate[],
    private readonly opts?: RosterViewOptions,
  ) {
    this.view = new RosterView(mount, audio);
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'roster-button';
    this.el.textContent = 'Roster';
    this.el.addEventListener('click', () => {
      this.audio.play('click');
      this.view.open(this.roster, this.opts);
    });
  }

  dispose(): void {
    this.view.dispose();
    this.el.remove();
  }
}
