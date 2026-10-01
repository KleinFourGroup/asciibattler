/**
 * The storage adapter: where the store's text is kept (Round 8 spec D1).
 * Three cases share this shape: `localStorage` on the web, the same inside
 * itch's iframe, and Electron's file under `userData`, handed over by the
 * preload. The store (store.ts) is the only caller; it catches whatever an
 * adapter throws, so an adapter is free to fail.
 */

export type AdapterKind = 'web' | 'electron' | 'memory';

export interface StorageAdapter {
  readonly kind: AdapterKind;
  /** One key's text, or null when nothing is stored under it. Synchronous,
   *  because the store is read before the game's first module loads. */
  read(key: string): string | null;
  /** Replace one key's text. A failure is thrown, or a rejected promise where
   *  the write itself is asynchronous (Electron). */
  write(key: string, text: string): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}

/**
 * Keeps the text in memory for the page's life. It is the store's fallback
 * when no real storage works (the player is told it can't save), and the
 * tests' storage. `entries` is the live map, for a test to plant text in or
 * read text back from without going through the store.
 */
export function memoryAdapter(initial: Readonly<Record<string, string>> = {}): StorageAdapter & {
  readonly entries: Map<string, string>;
} {
  const entries = new Map(Object.entries(initial));
  return {
    kind: 'memory',
    entries,
    read: (key) => entries.get(key) ?? null,
    write: (key, text) => {
      entries.set(key, text);
    },
    remove: (key) => {
      entries.delete(key);
    },
  };
}
