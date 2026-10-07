/**
 * 116i — WHY A PAGE CAN'T SAVE, if it can't: the rule behind the can't-save
 * chip (src/ui/CantSaveChip.ts), pure, so it is pinned without a page.
 *
 *  - `storage`: the store's last write failed, or its storage is refused.
 *    Nothing the player does is kept, a setting included, so it holds on
 *    every screen.
 *  - `elsewhere` (116i-post): the store saves, but the saved run is another
 *    tab's (the two-tab lock), so a run played in this tab is not kept. It
 *    holds while a run is on screen. On the menu the tab's notice says it,
 *    and a setting changed there is saved.
 */

import type { RunLock } from '../store/runLock';

export type CantSaveReason = 'storage' | 'elsewhere';

export function cantSaveReason(canSave: boolean, lock: RunLock, runOnScreen: boolean): CantSaveReason | null {
  if (!canSave) return 'storage';
  return lock === 'elsewhere' && runOnScreen ? 'elsewhere' : null;
}
