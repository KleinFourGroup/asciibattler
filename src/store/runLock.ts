/**
 * THE TWO-TAB LOCK (Round 8 spec D1): the run slot has one writer.
 *
 * Two tabs of the game share one store, and each would autosave its own run
 * into the one slot, the last write winning. So the first tab to boot takes a
 * Web Lock (`navigator.locks`) and holds it until its page goes. A tab that
 * finds the lock taken is the second tab: it can't continue the saved run
 * and plays unsaved (runSlot.ts's `openRunSlot` is where that holds). It
 * stays the second tab for its life, even once the first has closed, since by
 * then it may be in a run of its own that the slot never held.
 *
 * NO LOCK IS NOT A SECOND TAB. A refusal alone proves nothing: a lock manager
 * that can't reach its storage refuses every request, a free name included (a
 * second instance of the Electron shell on one profile does). So a tab that
 * is refused the run lock asks the same manager for a CONTROL lock, under a
 * name no other tab can hold, and lets it go at once. A manager that grants
 * the control works, so its refusal of the run lock was a real one: the tab
 * asks for the run lock once more (the holder's tab may have closed in
 * between), and if it is refused again it is the second tab. Everything else
 * is no lock, and the tab saves as if it were alone:
 *  - the API is missing (a page that isn't a secure context);
 *  - a request throws or rejects (a frame refused its storage);
 *  - the control is refused too (the manager refuses everything);
 *  - no answer comes within `ANSWER_WAIT_MS`, since a boot never hangs on the
 *    lock.
 * A lone player left unable to save by a broken lock would be worse off than
 * two tabs writing over each other.
 *
 * THE LOCK NEVER ASKS `locks.query()` (gotcha #140). It used to confirm a
 * refusal by asking the manager who held the name. Firefox refuses that
 * question in a partitioned third-party frame, which is what itch's iframe
 * is, while it grants and refuses requests there as it should; so a second
 * tab on itch read as no lock and saved over the first tab's run. The control
 * asks only for what the lock itself needs, a request answered.
 *
 * The lock covers the run slot only: the lenient sections and the finished
 * journals are written from any tab. It is the browser's, so it holds between
 * the tabs and windows of one browser, not between two processes that each
 * run their own (two instances of the shell: shell/electron/main.mjs).
 *
 * Game-layer only, like the rest of `src/store/`. The store's boot module
 * doesn't import it: `main.ts` asks for the lock beside the font, before the
 * Game (the slot's writer) exists.
 */

import { storageKey } from './store';

/**
 * `held`: this tab took the lock and holds it for its life.
 * `elsewhere`: another tab holds it, so this one leaves the run slot alone.
 * `none`: there is no lock on this page, and the tab saves as if alone.
 */
export type RunLock = 'held' | 'elsewhere' | 'none';

/** The lock's name: the key it guards. Web Locks are scoped to the origin, as
 *  the storage is, so the namespace keeps it ours on a shared one. Permanent,
 *  as the key is: a tab still on an older build has to contend for the same
 *  name. */
export const RUN_LOCK_NAME = storageKey('run');

/** What every control lock's name begins with. */
export const CONTROL_PREFIX = `${RUN_LOCK_NAME}:control:`;

/** How long a boot waits for the lock manager before going on with no lock.
 *  An answer takes a few milliseconds where the API works. */
export const ANSWER_WAIT_MS = 1000;

/** What the lock uses of `navigator.locks`. */
export interface LockManagerLike {
  request(
    name: string,
    options: { readonly ifAvailable: true },
    callback: (lock: unknown) => unknown,
  ): Promise<unknown>;
}

/** A name for a control lock that no other tab is holding: the time and a
 *  random part, so two tabs that boot in the same millisecond still differ.
 *  A control that met a taken name would read as a manager that refuses
 *  everything, and the tab would save as if alone. */
export function controlName(): string {
  return `${CONTROL_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Ask for the run lock without waiting in line for it: it is free and now
 * this page's, or it is another tab's. `locks` is the page's
 * `navigator.locks`, undefined where there is none. Never rejects.
 */
export function acquireRunLock(
  locks: LockManagerLike | undefined,
  waitMs: number = ANSWER_WAIT_MS,
  control: () => string = controlName,
): Promise<RunLock> {
  if (locks === undefined || typeof locks.request !== 'function') return Promise.resolve('none');
  return new Promise((resolve) => {
    // Past the wait the boot goes on with no lock. A grant that comes later
    // is still held, which keeps later tabs out; a refusal that comes later
    // goes unheard.
    const timer = setTimeout(() => resolve('none'), waitMs);
    const settle = (lock: RunLock): void => {
      clearTimeout(timer);
      resolve(lock);
    };

    /** Ask for the run lock; `refused` runs when the manager says no. */
    const ask = (refused: () => void): void => {
      locks
        .request(RUN_LOCK_NAME, { ifAvailable: true }, (lock) => {
          if (lock === null) {
            refused();
            return undefined;
          }
          settle('held');
          // The lock is held until this promise settles, and it never does:
          // the page's end is what releases it.
          return new Promise<never>(() => {});
        })
        .catch(() => settle('none'));
    };

    /** The control: `works` runs when the manager grants a name nobody
     *  holds. Its callback returns at once, which lets the control go. */
    const prove = (works: () => void): void => {
      locks
        .request(control(), { ifAvailable: true }, (lock) => {
          if (lock === null) settle('none');
          else works();
          return undefined;
        })
        .catch(() => settle('none'));
    };

    try {
      ask(() => prove(() => ask(() => settle('elsewhere'))));
    } catch {
      settle('none');
    }
  });
}
