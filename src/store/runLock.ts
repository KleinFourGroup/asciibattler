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
 * NO LOCK IS NOT A SECOND TAB. A tab is the second tab only when the lock
 * manager refuses it the lock AND names a holder. Everything else is no lock,
 * and the tab saves as if it were alone:
 *  - the API is missing (a page that isn't a secure context);
 *  - the request throws or rejects (a frame refused its storage);
 *  - the refusal names no holder. A lock manager that can't reach its storage
 *    refuses every request, a free name included, and lists nothing held (a
 *    second instance of the Electron shell on one profile does);
 *  - no answer comes within `ANSWER_WAIT_MS`, since a boot never hangs on the
 *    lock.
 * A lone player left unable to save by a broken lock would be worse off than
 * two tabs writing over each other.
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
  /** The origin's locks, whichever tab holds them. */
  query(): Promise<{ readonly held?: readonly { readonly name?: string }[] }>;
}

/**
 * Ask for the run lock without waiting in line for it: it is free and now
 * this page's, or it is another tab's. `locks` is the page's
 * `navigator.locks`, undefined where there is none. Never rejects.
 */
export function acquireRunLock(locks: LockManagerLike | undefined, waitMs: number = ANSWER_WAIT_MS): Promise<RunLock> {
  if (locks === undefined || typeof locks.request !== 'function' || typeof locks.query !== 'function') {
    return Promise.resolve('none');
  }
  return new Promise((resolve) => {
    // Past the wait the boot goes on with no lock. A grant that comes later
    // is still held, which keeps later tabs out; a refusal that comes later
    // goes unheard.
    const timer = setTimeout(() => resolve('none'), waitMs);
    const settle = (lock: RunLock): void => {
      clearTimeout(timer);
      resolve(lock);
    };

    const ask = (again: boolean): void => {
      locks
        .request(RUN_LOCK_NAME, { ifAvailable: true }, (lock) => {
          if (lock !== null) {
            settle('held');
            // The lock is held until this promise settles, and it never does:
            // the page's end is what releases it.
            return new Promise<never>(() => {});
          }
          // Refused. Another tab holds the lock only if the manager says so.
          locks
            .query()
            .then((state) => {
              if (state.held?.some((l) => l.name === RUN_LOCK_NAME) === true) settle('elsewhere');
              // No holder: it went between the two answers (its tab closed),
              // so the lock is free to take, or the manager refuses everything.
              else if (again) ask(false);
              else settle('none');
            })
            .catch(() => settle('none'));
          return undefined;
        })
        .catch(() => settle('none'));
    };
    try {
      ask(true);
    } catch {
      settle('none');
    }
  });
}
