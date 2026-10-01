/**
 * The web adapter: `localStorage`, on the Pages site and inside itch's iframe
 * alike. Each of the store's keys is one `localStorage` item.
 */

import type { StorageAdapter } from './adapter';
import { NAMESPACE } from './store';

/** Written and removed by `prove`; never a section. */
export const WEB_PROBE_KEY = `${NAMESPACE}probe`;

export function webAdapter(storage: Storage): StorageAdapter {
  return {
    kind: 'web',
    read: (key) => storage.getItem(key),
    write: (key, text) => {
      storage.setItem(key, text);
    },
    remove: (key) => {
      storage.removeItem(key);
    },
    prove: () => {
      storage.setItem(WEB_PROBE_KEY, '1');
      const back = storage.getItem(WEB_PROBE_KEY);
      storage.removeItem(WEB_PROBE_KEY);
      if (back !== '1') throw new Error('localStorage did not return what was written');
    },
  };
}

/**
 * Whether `candidate` is a storage the game can read: it has the three
 * methods and a read doesn't throw. The existence of a `localStorage` global
 * proves nothing (Node 25 defines one with no `setItem`), and a browser with
 * storage blocked throws on the first touch.
 *
 * Reading is the whole test on purpose. A storage that reads but can't write
 * (a full quota) still holds the player's settings, so it is chosen, and the
 * failed writes show as "can't save".
 */
export function readableStorage(candidate: unknown): candidate is Storage {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const storage = candidate as Partial<Storage>;
  if (
    typeof storage.getItem !== 'function' ||
    typeof storage.setItem !== 'function' ||
    typeof storage.removeItem !== 'function'
  ) {
    return false;
  }
  storage.getItem(WEB_PROBE_KEY);
  return true;
}
