/**
 * The Electron adapter: one file, `store.json` under `userData`. The preload
 * (shell/electron/preload.cjs) reads the file's text with a synchronous
 * message before any page script runs and exposes it as
 * `window.shellStore.initial`; `write` replaces the whole text, and main
 * writes it to a temporary file and renames it into place.
 *
 * The file is a JSON object, the store's keys to their text. Every write
 * sends the whole object, so the last write holds every key.
 */

import type { StorageAdapter } from './adapter';

/** What the preload exposes on `window.shellStore`. */
export interface ShellStore {
  readonly shell: 'electron';
  /** The file's text when the page loaded; null when there is no file. */
  readonly initial: string | null;
  write(text: string): Promise<unknown>;
}

export function isShellStore(candidate: unknown): candidate is ShellStore {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const shell = candidate as Partial<ShellStore>;
  return shell.shell === 'electron' && typeof shell.write === 'function';
}

/** The file's keys. Text that isn't the store's file (not a JSON object) reads
 *  as an empty store, and the first write replaces it. */
function entriesOf(text: string | null): Map<string, string> {
  const entries = new Map<string, string>();
  if (text === null) return entries;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return entries;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return entries;
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') entries.set(key, value);
  }
  return entries;
}

export function electronAdapter(shell: ShellStore): StorageAdapter {
  const entries = entriesOf(shell.initial);
  const flush = async (): Promise<void> => {
    await shell.write(JSON.stringify(Object.fromEntries(entries)));
  };
  return {
    kind: 'electron',
    read: (key) => entries.get(key) ?? null,
    write: (key, text) => {
      entries.set(key, text);
      return flush();
    },
    remove: (key) => {
      entries.delete(key);
      return flush();
    },
  };
}
