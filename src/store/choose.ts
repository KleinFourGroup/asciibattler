/**
 * Which adapter this page gets (Round 8 spec D1's three cases, and the
 * fallback). The order is explicit: Electron's bridge when the preload put
 * one on the window, else the window's `localStorage` when it reads, else
 * memory, with the reason, and the store then says it can't save.
 */

import { memoryAdapter, type StorageAdapter } from './adapter';
import { electronAdapter, isShellStore } from './electron';
import { readableStorage, webAdapter } from './web';

export interface AdapterChoice {
  readonly adapter: StorageAdapter;
  /** Why nothing can be saved, when the adapter is the memory fallback. */
  readonly unsaved: string | null;
}

/** The plant: `?store=deny` on a DEV page gives a store whose storage is
 *  refused, the way a browser with site data blocked refuses it. */
export const DENY_QUERY = 'store=deny';

function fallback(reason: string): AdapterChoice {
  return { adapter: memoryAdapter(), unsaved: reason };
}

/** The planted refusal. index.ts reaches it only under DEV, so a production
 *  build carries neither this nor the query. */
export function deniedChoice(): AdapterChoice {
  return fallback(`SecurityError: planted by ?${DENY_QUERY}`);
}

/** The second plant: `?store=full` on a DEV page gives the page's own
 *  storage with every write refused once the store has booted, the way a
 *  browser whose quota is used up refuses one. What is stored still reads. */
export const FULL_QUERY = 'store=full';

/**
 * `choice` with its adapter's writes and removes refused from `arm()` on.
 * index.ts arms it after the store is made, so the boot's own stamp lands
 * and the store starts at can-save: the failure arrives in mid-game, which
 * is the case the plant is for. Reached only under DEV, as `deniedChoice` is.
 */
export function fullChoice(choice: AdapterChoice): AdapterChoice & { arm(): void } {
  const inner = choice.adapter;
  let armed = false;
  const refuse = (): void => {
    if (armed) throw Object.assign(new Error(`planted by ?${FULL_QUERY}`), { name: 'QuotaExceededError' });
  };
  return {
    unsaved: choice.unsaved,
    adapter: {
      kind: inner.kind,
      read: (key) => inner.read(key),
      write: (key, text) => {
        refuse();
        return inner.write(key, text);
      },
      remove: (key) => {
        refuse();
        return inner.remove(key);
      },
    },
    arm: () => {
      armed = true;
    },
  };
}

/**
 * `host` is the page's `window`, or undefined where there is none (Node).
 * Never throws.
 */
export function chooseAdapter(host: unknown): AdapterChoice {
  if (typeof host !== 'object' || host === null) return fallback('no window: nothing to store in');
  try {
    const { shellStore } = host as { shellStore?: unknown };
    if (isShellStore(shellStore)) return { adapter: electronAdapter(shellStore), unsaved: null };
    // The property read itself throws where site data is blocked.
    const { localStorage } = host as { localStorage?: unknown };
    if (readableStorage(localStorage)) return { adapter: webAdapter(localStorage), unsaved: null };
    return fallback('no usable localStorage on this page');
  } catch (err) {
    return fallback(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  }
}
