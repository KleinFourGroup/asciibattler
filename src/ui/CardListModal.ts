/**
 * The shared card list: a modal that lists a set of units as shared `full`
 * UnitCards (the `roster` skin), and `CardListButton`, which pairs a button
 * with it. The roster view and the two pile views are this one piece; each
 * mounts a `CardListButton` with its own label, place and source.
 *
 * It is a modal (the shell, src/ui/modal.ts): a dimmed backdrop with a
 * bordered, scrollable panel, which Esc, a backdrop click or the ✕
 * dismisses. The cards' order is `rosterOrder`'s (recruitment order by
 * default). The piles come from the Run already in recruitment order, so
 * the modal never shows the next draw's sequence (contents only, unordered).
 *
 * The picker: pass `selection` and the modal becomes a picker. Cards toggle
 * selected (in a one-card picker a click replaces the pick; a multi-card
 * picker stops at its cap), and a footer button confirms at exactly `count`
 * picked. Confirming closes the modal and reports source indices (positions
 * in the `units` array as passed; `orderRosterWithIndices` carries the
 * mapping, so a sorted display can't skew a `rosterIndex` command). Esc,
 * the backdrop and the ✕ only cancel; they never confirm. The port's crew
 * removal is the picker's one user.
 */

import type { UnitTemplate } from '../sim/Unit';
import { t } from '../i18n/ui';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { buildUnitCard, unitCardFromTemplate } from './UnitCard';
import { pressable } from './pressable';
import { orderRosterWithIndices, type RosterOrder } from './rosterOrder';
import { openModal, type ModalHandle } from './modal';

/** The picker's contract. `count` cards must be selected to confirm. */
interface CardListSelection {
  /** Exactly how many cards the picker wants. */
  readonly count: number;
  /** The confirm button's words (the port's: "Remove for N bits ▸"). */
  readonly confirmText: string;
  /** Called with the selected source indices (ascending), after the modal
   *  closes. The caller owns what happens next (dispatch, re-open, …). */
  readonly onConfirm: (sourceIndices: number[]) => void;
}

interface CardListModalOptions {
  /** Display order (the pluggable seam). Defaults to recruitment order. */
  readonly order?: RosterOrder;
  /** Message shown when the list is empty (e.g. "The draw pile is empty."). */
  readonly emptyText?: string;
  /** Present, with `count > 0`, for a picker; absent for a plain view. */
  readonly selection?: CardListSelection;
}

/**
 * The modal overlay itself. Self-contained DOM + lifecycle; `open`/`close` are
 * idempotent. Mounts its overlay on the supplied `mount` (the shared UI mount),
 * a sibling of the host screen so it overlays at full opacity regardless of the
 * screen's fade/scroll state.
 */
export class CardListModal {
  /** The shell (src/ui/modal.ts) owns the overlay, the header, the ✕, Esc,
   *  the backdrop and the focus trap; this class owns the body. */
  private handle: ModalHandle | null = null;
  // The picker's confirm button (null in a plain view); the selection
  // state itself is open()-scoped, so a re-open always starts clean.
  private confirmButton: HTMLButtonElement | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly audio: AudioPlayer,
  ) {}

  /** Open the modal listing `units`. `title` is the heading prefix ("Your
   *  Roster" / "Draw Pile" / "Discard Pile"); the count is appended. */
  open(title: string, units: readonly UnitTemplate[], opts?: CardListModalOptions): void {
    if (this.handle !== null) return; // already open — idempotent

    const handle = openModal(this.mount, {
      title: t('cardlist.title', { title, count: units.length }),
      onCloseClick: () => this.audio.play('click'),
      onClose: () => {
        this.handle = null;
        this.confirmButton = null;
      },
    });
    this.handle = handle;
    const modal = handle.content;

    const selection = opts?.selection;
    const picking = selection !== undefined && selection.count > 0;
    // The picker's state: the selected source indices, and the card
    // elements by source index (classes toggle in place, with no re-render).
    const selected = new Set<number>();
    const cardEls = new Map<number, HTMLDivElement>();

    const grid = document.createElement('div');
    grid.className = 'roster-grid';
    if (units.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'roster-empty';
      empty.textContent = opts?.emptyText ?? t('cardlist.empty');
      grid.appendChild(empty);
    } else {
      for (const { unit, sourceIndex } of orderRosterWithIndices(units, opts?.order)) {
        const { el } = buildUnitCard(unitCardFromTemplate(unit), {
          mode: 'full',
          skin: 'roster',
        });
        if (picking) {
          el.classList.add('unit-card--clickable');
          cardEls.set(sourceIndex, el);
          // The keyboard route (role=button, Enter and Space,
          // pressable.ts); a toggle, so `aria-pressed` tracks `is-selected`
          // (`toggleSelection` flips both).
          pressable(el, { pressed: false });
          el.addEventListener('click', () => {
            this.audio.play('click');
            this.toggleSelection(selection, selected, cardEls, sourceIndex);
          });
        }
        grid.appendChild(el);
      }
    }

    modal.appendChild(grid);

    // The picker's footer: the confirm enables at exactly `count` selected.
    // Confirming closes the modal first (the callback sees it closed), then
    // reports the source indices ascending, so the dispatch's order is
    // fixed, as `redrawCards`' is.
    if (picking) {
      const footer = document.createElement('div');
      footer.className = 'roster-modal-footer';
      this.confirmButton = document.createElement('button');
      this.confirmButton.type = 'button';
      this.confirmButton.className = 'roster-modal-confirm';
      this.confirmButton.textContent = selection.confirmText;
      this.confirmButton.disabled = true;
      this.confirmButton.addEventListener('click', () => {
        if (selected.size !== selection.count) return;
        this.audio.play('click');
        const indices = [...selected].sort((a, b) => a - b);
        this.close();
        selection.onConfirm(indices);
      });
      footer.appendChild(this.confirmButton);
      modal.appendChild(footer);
    }
  }

  /** Toggle a card in or out of the selection. In a one-card picker a
   *  click replaces the pick (deselecting first would be clumsy); a
   *  multi-card picker ignores clicks past its cap, as the pre-turn redraw
   *  does. The confirm button follows the exact count in place. */
  private toggleSelection(
    selection: CardListSelection,
    selected: Set<number>,
    cardEls: Map<number, HTMLDivElement>,
    sourceIndex: number,
  ): void {
    if (selected.has(sourceIndex)) {
      selected.delete(sourceIndex);
    } else if (selection.count === 1) {
      for (const prev of selected) {
        cardEls.get(prev)?.classList.remove('is-selected');
        cardEls.get(prev)?.setAttribute('aria-pressed', 'false');
      }
      selected.clear();
      selected.add(sourceIndex);
    } else if (selected.size < selection.count) {
      selected.add(sourceIndex);
    } else {
      return; // at the cap: ignored
    }
    cardEls.get(sourceIndex)?.classList.toggle('is-selected', selected.has(sourceIndex));
    cardEls.get(sourceIndex)?.setAttribute('aria-pressed', String(selected.has(sourceIndex)));
    if (this.confirmButton !== null) {
      this.confirmButton.disabled = selected.size !== selection.count;
    }
  }

  close(): void {
    // The shell's onClose nulls the handle + the confirm button.
    this.handle?.close();
  }

  /** Tear down for the host screen's `hide()`: close an open modal, which
   *  takes its Esc handler with it, so a dismissed screen leaves no live
   *  listener. */
  dispose(): void {
    this.close();
  }
}

/** Where a `CardListButton` goes. The piles are corner buttons, pinned by
 *  `.card-list-button--{position}`. Roster is a row of the control
 *  column (src/ui/chip.ts): it wears the chip's plate, and its screen puts
 *  it there with `mountControl`. */
type CardListButtonPosition = 'roster' | 'draw' | 'discard';

interface CardListButtonOptions {
  /** The button face text (e.g. "Roster", "Draw Pile"). */
  readonly text: string;
  /** The modal heading prefix (e.g. "Your Roster", "Draw Pile"). */
  readonly title: string;
  /** A pile's corner, or the control column's row (see the type). */
  readonly position: CardListButtonPosition;
  /** Read the units to show at click time: a thunk, so a pile shows its
   *  latest contents after a redraw (the host refreshes its stored copy). */
  readonly getUnits: () => readonly UnitTemplate[];
  readonly emptyText?: string;
  readonly order?: RosterOrder;
  /** The live count: the face reads "text · N", at mount and on every
   *  `refresh()` (a redraw moves cards between piles, and the host calls
   *  `refresh` where it refreshes its stored copies). */
  readonly getCount?: () => number;
}

/**
 * The reusable button wired to a `CardListModal`. The caller appends a
 * pile's `.el` into its panel, or mounts Roster's into the control column,
 * and calls `dispose()` on screen `hide()` (which also closes the overlay
 * if it's open).
 */
export class CardListButton {
  readonly el: HTMLButtonElement;
  private readonly modal: CardListModal;
  private readonly opts: CardListButtonOptions;

  constructor(mount: HTMLElement, audio: AudioPlayer, opts: CardListButtonOptions) {
    this.opts = opts;
    this.modal = new CardListModal(mount, audio);
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className =
      opts.position === 'roster' ? 'chip control-chip' : `card-list-button card-list-button--${opts.position}`;
    this.refresh();
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

  /** Read the count thunk again into the face ("Draw Pile · 12"); with no
   *  thunk, the plain text. */
  refresh(): void {
    const badge = this.opts.getCount !== undefined ? ` · ${this.opts.getCount()}` : '';
    this.el.textContent = `${this.opts.text}${badge}`;
  }

  dispose(): void {
    this.modal.dispose();
    this.el.remove();
  }
}
