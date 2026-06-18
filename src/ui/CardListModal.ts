/**
 * R1/R2 — the shared card-list surface. A modal overlay that lists a set of
 * units as shared `full` UnitCards (P's component, the `roster` skin), and a
 * `CardListButton` controller that pairs a corner button with it. The brief
 * asks for one shared card-list affordance across the roster view (R1) and the
 * draw/discard pile views (R2) — this is that one piece; each consumer just
 * mounts a `CardListButton` with its own label, position, and source.
 *
 * Presentation = a modal overlay (the user's call): a dimmed backdrop with a
 * bordered, scrollable panel; Esc, a backdrop click, or the ✕ all dismiss it.
 * The card ordering rides the pluggable `rosterOrder` seam (default recruitment
 * order). The PILE consumers (R2) pass contents already canonicalized to
 * recruitment order by the Run, so the modal never reveals the next-draw
 * sequence ("contents only, unordered").
 */

import type { UnitTemplate } from '../sim/Unit';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { buildUnitCard, unitCardFromTemplate } from './UnitCard';
import { orderRoster, type RosterOrder } from './rosterOrder';

export interface CardListModalOptions {
  /** Display order (the pluggable seam). Defaults to recruitment order. */
  readonly order?: RosterOrder;
  /** Message shown when the list is empty (e.g. "The draw pile is empty."). */
  readonly emptyText?: string;
}

/**
 * The modal overlay itself. Self-contained DOM + lifecycle; `open`/`close` are
 * idempotent. Mounts its overlay on the supplied `mount` (the shared UI mount),
 * a sibling of the host screen so it overlays at full opacity regardless of the
 * screen's fade/scroll state.
 */
export class CardListModal {
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

  /** Open the modal listing `units`. `title` is the heading prefix ("Your
   *  Roster" / "Draw Pile" / "Discard Pile"); the count is appended. */
  open(title: string, units: readonly UnitTemplate[], opts?: CardListModalOptions): void {
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
    const titleEl = document.createElement('div');
    titleEl.className = 'roster-modal-title';
    titleEl.textContent = `${title} — ${units.length} unit${units.length === 1 ? '' : 's'}`;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'roster-modal-close';
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => {
      this.audio.play('click');
      this.close();
    });
    header.append(titleEl, close);

    const grid = document.createElement('div');
    grid.className = 'roster-grid';
    if (units.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'roster-empty';
      empty.textContent = opts?.emptyText ?? 'No units.';
      grid.appendChild(empty);
    } else {
      for (const unit of orderRoster(units, opts?.order)) {
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

/** Where a `CardListButton` anchors → its CSS position modifier. Roster sits
 *  top-right (R1); the piles sit in the bottom corners (R2). */
export type CardListButtonPosition = 'roster' | 'draw' | 'discard';

export interface CardListButtonOptions {
  /** The button face text (e.g. "Roster", "Draw Pile"). */
  readonly text: string;
  /** The modal heading prefix (e.g. "Your Roster", "Draw Pile"). */
  readonly title: string;
  /** Corner anchor → `.card-list-button--{position}`. */
  readonly position: CardListButtonPosition;
  /** Read the units to show, AT CLICK TIME — a thunk so a pile reflects the
   *  latest contents after a redraw (the host refreshes its stored copy). */
  readonly getUnits: () => readonly UnitTemplate[];
  readonly emptyText?: string;
  readonly order?: RosterOrder;
}

/**
 * The reusable corner button wired to a `CardListModal`. The caller appends
 * `.el` into its panel and calls `dispose()` on screen `hide()` (which also
 * closes the overlay if it's open).
 */
export class CardListButton {
  readonly el: HTMLButtonElement;
  private readonly modal: CardListModal;

  constructor(mount: HTMLElement, audio: AudioPlayer, opts: CardListButtonOptions) {
    this.modal = new CardListModal(mount, audio);
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = `card-list-button card-list-button--${opts.position}`;
    this.el.textContent = opts.text;
    this.el.addEventListener('click', () => {
      audio.play('click');
      // Spread only the present options (exactOptionalPropertyTypes — no
      // explicit `undefined`s).
      this.modal.open(opts.title, opts.getUnits(), {
        ...(opts.order !== undefined ? { order: opts.order } : {}),
        ...(opts.emptyText !== undefined ? { emptyText: opts.emptyText } : {}),
      });
    });
  }

  dispose(): void {
    this.modal.dispose();
    this.el.remove();
  }
}
