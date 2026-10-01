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
