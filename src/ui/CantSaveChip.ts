/**
 * 116i — THE CAN'T-SAVE CHIP (Round 8 spec D1: a failed write is "can't
 * save", told to the player, never a crash). Page-lifetime chrome, last in
 * the chrome column, shown for as long as the store says it can't save and
 * on every screen: at a boot with storage blocked, and from the moment a
 * write fails in mid-run or in the settings. A later write that lands hides
 * it again, since the store's status is the last write's.
 *
 * It says the fact in words (`⚠ can't save`) and carries the consequence as
 * its tooltip, so it is a text site: a tab stop, hover, and a tap. It is
 * last so that its coming and going moves no other chip, and it is a read,
 * not a control, so its own move when a chip above it hides shifts no click
 * target (DESIGN §UI idioms, "Chips").
 *
 * `Game` owns it and feeds it from `store.onStatus`. A store sealed by an
 * import refuses writes without changing its status (src/store/store.ts),
 * so the chip stays as it was on a page that is about to reload.
 */

import { t } from '../i18n/ui';
import { attachTooltip } from './tooltip';

export class CantSaveChip {
  private readonly el: HTMLDivElement;

  constructor(
    /** The chrome column (src/ui/chip.ts). */
    mount: HTMLElement,
    canSave: boolean,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'chip cant-save-chip';
    // The glyph stays outside the locale value (DESIGN §UI idioms, Strings).
    this.el.textContent = `⚠ ${t('save.chip')}`;
    this.el.tabIndex = 0;
    this.el.setAttribute('role', 'status');
    attachTooltip(this.el, t('save.unavailable'));
    mount.appendChild(this.el);
    this.set(canSave);
  }

  /** Show the chip while the store can't save (`StoreStatus.canSave`). */
  set(canSave: boolean): void {
    this.el.classList.toggle('is-hidden', canSave);
  }
}
