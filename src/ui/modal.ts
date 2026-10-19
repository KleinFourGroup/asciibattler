/**
 * The modal shell: one overlay, one dismissal and one focus discipline for
 * every modal surface (the card list, the cache, the sector map, the
 * settings, the credits, the failure plate).
 *
 * Two variants:
 * - `panel` — `.roster-overlay` (the dimmed backdrop) › `.roster-modal` (the
 *   bordered, capped panel) › a `.roster-modal-header` with the title and
 *   the ✕; the consumer appends its body after the header (or
 *   `replaceBody`s it on a re-render).
 * - `viewport` — `.sector-map-overlay` (an opaque full-viewport host) with
 *   the pinned `✕ close`; the consumer renders into it.
 *
 * Dismissal: Esc, a click on the backdrop itself, and the ✕, all three gated
 * by one `dismissable` flag (`setDismissable(false)` hides the ✕ and ignores
 * the other two: the cache's forced-keep shrink, the failure plate), so a
 * shell can never be half-dismissable. `onClose` fires exactly once per
 * open, from any route including `handle.close()`, so a consumer puts all
 * its teardown there and nowhere else.
 *
 * Focus: on open the container takes focus (`tabindex=-1`, no scroll), Tab
 * and Shift+Tab cycle among the focusables inside (with none, the key is
 * eaten and focus stays on the container), and on close focus returns to
 * whatever had it before (the chip or corner button that opened the modal)
 * when that is still in the document. `role="dialog"`, `aria-modal` and, on
 * a panel, `aria-labelledby` ride along; they change nothing visible.
 *
 * Sounds stay the consumer's: `onCloseClick` fires on the ✕ only (the
 * panels play `click` there; the sector map plays nothing), and Esc and the
 * backdrop are silent.
 */

import { t } from '../i18n/ui';

interface ModalOptions {
  readonly variant?: 'panel' | 'viewport';
  /** The header's title (panel variant). Absent, the title starts empty and
   *  `setTitle` fills it (the cache modal); the header and its ✕ stay. */
  readonly title?: string;
  /** Extra class(es) on the panel (e.g. `cache-modal`). */
  readonly panelClass?: string;
  /** The ✕ face text; default `✕`. */
  readonly closeText?: string;
  /** Fires on the ✕ click only (the consumer's sound cue). */
  readonly onCloseClick?: () => void;
  /** Fires exactly once when the shell closes, from any route. */
  readonly onClose: () => void;
}

export interface ModalHandle {
  /** The backdrop (panel) / the full-viewport host (viewport). */
  readonly overlay: HTMLDivElement;
  /** Where the consumer's content goes: the panel, or the overlay itself
   *  for the viewport variant. */
  readonly content: HTMLDivElement;
  setTitle(text: string): void;
  /** Gate Esc + backdrop + ✕ together (the ✕ hides while false). */
  setDismissable(on: boolean): void;
  /** Panel variant: drop everything after the header, append `nodes`. */
  replaceBody(...nodes: Node[]): void;
  close(): void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'; // i18n-ok: a CSS selector

let titleSeq = 0;

export function openModal(mount: HTMLElement, opts: ModalOptions): ModalHandle {
  const variant = opts.variant ?? 'panel';
  const overlay = document.createElement('div');
  overlay.className = variant === 'panel' ? 'roster-overlay' : 'sector-map-overlay';

  let dismissable = true;
  let open = true;
  const restoreTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  // ── the close button (both variants) ─────────────────────────────────
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = variant === 'panel' ? 'roster-modal-close' : 'sector-map-overlay__close';
  closeButton.textContent = opts.closeText ?? '✕';
  closeButton.setAttribute('aria-label', t('common.close'));
  closeButton.addEventListener('click', () => {
    if (!dismissable) return;
    opts.onCloseClick?.();
    close();
  });

  // ── the container the consumer fills ─────────────────────────────────
  let content: HTMLDivElement;
  let header: HTMLDivElement | null = null;
  let titleEl: HTMLDivElement | null = null;
  if (variant === 'panel') {
    const panel = document.createElement('div');
    panel.className = opts.panelClass !== undefined ? `roster-modal ${opts.panelClass}` : 'roster-modal';
    header = document.createElement('div');
    header.className = 'roster-modal-header';
    titleEl = document.createElement('div');
    titleEl.className = 'roster-modal-title';
    titleEl.id = `modal-title-${++titleSeq}`;
    titleEl.textContent = opts.title ?? '';
    header.append(titleEl, closeButton);
    panel.appendChild(header);
    overlay.appendChild(panel);
    content = panel;
  } else {
    overlay.appendChild(closeButton);
    content = overlay;
  }

  // Only a click on the backdrop itself (not one bubbling up from the
  // content) dismisses, so clicks inside never close.
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && dismissable) close();
  });

  // ── the dialog semantics + the focus discipline ───────────────────────
  content.setAttribute('role', 'dialog');
  content.setAttribute('aria-modal', 'true');
  if (titleEl !== null) content.setAttribute('aria-labelledby', titleEl.id);
  content.tabIndex = -1;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (dismissable) close();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = [...overlay.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      // A reserved slot (`.is-reserved`, visibility: hidden) still has a
      // box, so `offsetParent` alone would hand the trap an element that
      // silently refuses focus and strand the Tab wrap on it.
      (el) => !el.hidden && el.offsetParent !== null && el.closest('.is-reserved') === null,
    );
    if (focusables.length === 0) {
      e.preventDefault();
      content.focus({ preventScroll: true });
      return;
    }
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;
    const inside = active instanceof HTMLElement && overlay.contains(active);
    if (e.shiftKey && (active === first || !inside || active === content)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside || active === content)) {
      e.preventDefault();
      first.focus();
    }
  };

  function close(): void {
    if (!open) return;
    open = false;
    window.removeEventListener('keydown', onKeyDown);
    overlay.remove();
    if (restoreTo !== null && restoreTo.isConnected && restoreTo !== document.body) {
      restoreTo.focus({ preventScroll: true });
    }
    opts.onClose();
  }

  mount.appendChild(overlay);
  window.addEventListener('keydown', onKeyDown);
  content.focus({ preventScroll: true });

  return {
    overlay,
    content,
    setTitle(text) {
      if (titleEl !== null) titleEl.textContent = text;
    },
    setDismissable(on) {
      dismissable = on;
      // The ✕ keeps its slot, so the header's height, and every row under
      // it, holds across the flip: reserveSlot's two halves, toggled, since
      // this one comes back.
      closeButton.classList.toggle('is-reserved', !on);
      if (on) closeButton.removeAttribute('aria-hidden');
      else closeButton.setAttribute('aria-hidden', 'true');
    },
    replaceBody(...nodes) {
      if (header === null) {
        content.replaceChildren(...(variant === 'viewport' ? [closeButton] : []), ...nodes);
        return;
      }
      while (content.lastChild !== null && content.lastChild !== header) content.lastChild.remove();
      content.append(...nodes);
    },
    close,
  };
}
