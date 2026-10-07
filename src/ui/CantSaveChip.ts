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
 * A SECOND TAB'S RUN (116i-post, the user's call) shows it too. That tab's
 * store can save, but the saved run is the first tab's (the two-tab lock,
 * src/store/runLock.ts), so a run played there is lost with the tab all the
 * same. The chip is up there while a run is on screen, and its tooltip gives
 * that reason: the menu's notice said so once, before the run began.
 *
 * `Game` owns it and says why the page can't save (`cantSaveReason`,
 * src/ui/cantSave.ts), from `store.onStatus` and at every scene swap. A store sealed by an import
 * refuses writes without changing its status (src/store/store.ts), so the
 * chip stays as it was on a page that is about to reload.
 */

import { t } from '../i18n/ui';
import type { CantSaveReason } from './cantSave';
import { attachTooltip } from './tooltip';

export class CantSaveChip {
  private readonly el: HTMLDivElement;
  private reason: CantSaveReason | null = null;

  constructor(
    /** The chrome column (src/ui/chip.ts). */
    mount: HTMLElement,
    reason: CantSaveReason | null,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'chip cant-save-chip';
    // The glyph stays outside the locale value (DESIGN §UI idioms, Strings).
    this.el.textContent = `⚠ ${t('save.chip')}`;
    this.el.tabIndex = 0;
    this.el.setAttribute('role', 'status');
    // Read at every open, so the sentence is the reason's as it is then.
    attachTooltip(this.el, () => (this.reason === 'elsewhere' ? t('save.elsewhere') : t('save.unavailable')));
    mount.appendChild(this.el);
    this.set(reason);
  }

  /** Show the chip for as long as there is a reason the page can't save;
   *  null hides it. */
  set(reason: CantSaveReason | null): void {
    this.reason = reason;
    this.el.classList.toggle('is-hidden', reason === null);
  }
}
