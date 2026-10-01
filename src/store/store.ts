/**
 * THE PERSISTENT STORE (Round 8 spec D1): what the game keeps between
 * visits, in sections that each have their own key, version and read policy.
 *
 *   asciibattler:meta       the store's own stamp: its layout version and the
 *                           build that last wrote it
 *   asciibattler:settings   lenient
 *   asciibattler:progress   lenient (unlocks; later achievements, seen-flags)
 *   asciibattler:run        strict (the save and its journal)
 *   asciibattler:journals   finished journals
 *
 * One key per section, so a write touches only its own section and a quota
 * failure on a large one can't cost the settings. Every key holds an envelope,
 * `{ v, build, data }`: the section's version, the build that wrote it, and
 * the section's data.
 *
 * THE TWO READ POLICIES.
 *  - Lenient (`store.read` / `store.patch`): the section is a table of fields,
 *    each with a schema and a fallback. An unknown key is dropped, a missing
 *    key takes its fallback, and a value its schema refuses takes its fallback
 *    alone, so no upload wipes a player's settings or unlocks. The version is
 *    written and never judged; a field whose meaning changes gets a new name.
 *  - Strict (`store.readStrict` / `store.writeStrict`): the stored version
 *    must equal the section's, and the section's own `load` must accept the
 *    data. Otherwise the read is `rejected`, and the stored text is left in
 *    place and handed back as `raw`, since a rejected run's journal stays
 *    exportable.
 *
 * THE STORE NEVER THROWS. An adapter that throws on a read leaves every
 * section at its fallbacks and the store read-only for the page's life: a
 * store that couldn't read what is there must not write over it. A page with
 * no storage at all (choose.ts's fallback) starts the same way. A failed
 * write (a quota or a security error) returns false and sets the status to
 * "can't save", for the UI to tell the player; the value still holds in
 * memory for the page's life.
 *
 * Game-layer only. The simulation, the run model, the bots and the fuzz
 * harness never import this module, so a headless run can't write a store.
 * This file imports no config and no run code: it is evaluated before the
 * game's first module, ahead of the catalogs that resolve their prose at load.
 */

import type { z } from 'zod';
import type { AdapterKind, StorageAdapter } from './adapter';

export const NAMESPACE = 'asciibattler:';

/** The section names. Each is a storage key in every player's browser, so a
 *  name is permanent: renaming one orphans what players have stored under it. */
export const SECTION_NAMES = ['meta', 'settings', 'progress', 'run', 'journals'] as const;
export type SectionName = (typeof SECTION_NAMES)[number];

export function storageKey(name: SectionName): string {
  return `${NAMESPACE}${name}`;
}

/** The version of the store's own layout (the keys and the envelope), written
 *  in `asciibattler:meta`. */
export const STORE_VERSION = 1;

/** What every key holds. */
export interface Envelope {
  readonly v: number;
  readonly build: string;
  readonly data: unknown;
}

export interface Field<V> {
  readonly schema: z.ZodType<V>;
  readonly fallback: V;
}

export interface LenientSection<T extends object> {
  readonly policy: 'lenient';
  readonly name: SectionName;
  readonly version: number;
  readonly fields: { readonly [K in keyof T]-?: Field<T[K]> };
}

/** `Wire` is what is stored (plain JSON); `Loaded` is what `load` makes of it. */
export interface StrictSection<Wire, Loaded> {
  readonly policy: 'strict';
  readonly name: SectionName;
  readonly version: number;
  /** The consumer's own loader. It throws when the data can't be loaded. */
  readonly load: (wire: Wire) => Loaded;
}

export type StrictRead<Loaded> =
  | { readonly status: 'empty' }
  | { readonly status: 'ok'; readonly value: Loaded; readonly build: string }
  | {
      readonly status: 'rejected';
      /** `stale`: written at another version. `unreadable`: not an envelope,
       *  or the section's `load` threw. */
      readonly reason: 'stale' | 'unreadable';
      /** The version found, when the text was an envelope. */
      readonly found: number | null;
      readonly detail: string;
      /** The stored text, untouched. */
      readonly raw: string;
    };

export interface StoreStatus {
  readonly adapter: AdapterKind;
  /** False once a read or the last write failed. */
  readonly canSave: boolean;
  /** The failure, as `Name: message`; null while `canSave`. */
  readonly error: string | null;
}

export interface Store {
  /** This build's ID, written into every envelope. */
  readonly build: string;
  /** The build that last stamped the store; null for an empty store, which
   *  is a new player. */
  readonly previousBuild: string | null;
  status(): StoreStatus;
  /** Called on every change of status. Returns the unsubscribe. */
  onStatus(listener: (status: StoreStatus) => void): () => void;
  /** A lenient section, complete: every field present. A fresh object. */
  read<T extends object>(section: LenientSection<T>): T;
  /** Change some of a lenient section's fields. False when it couldn't be saved. */
  patch<T extends object>(section: LenientSection<T>, changes: Partial<T>): boolean;
  readStrict<Wire, Loaded>(section: StrictSection<Wire, Loaded>): StrictRead<Loaded>;
  /** Replace a strict section. False when it couldn't be saved. */
  writeStrict<Wire, Loaded>(section: StrictSection<Wire, Loaded>, wire: Wire): boolean;
  /** Remove a section's key. False when it couldn't be removed. */
  clear(section: { readonly name: SectionName }): boolean;
}

function describe(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The envelope in `text`, or null when it isn't one. */
function parseEnvelope(text: string): Envelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.v !== 'number' || !('data' in parsed)) return null;
  return { v: parsed.v, build: typeof parsed.build === 'string' ? parsed.build : '', data: parsed.data };
}

export function createStore(options: {
  readonly adapter: StorageAdapter;
  readonly build: string;
  /** Why nothing can be saved on this page (choose.ts's fallback). The store
   *  then starts, and stays, at can't-save. */
  readonly unsaved?: string | null;
}): Store {
  const { adapter, build } = options;
  const unsaved = options.unsaved ?? null;
  let status: StoreStatus = { adapter: adapter.kind, canSave: unsaved === null, error: unsaved };
  /** Set by `unsaved` or by a failed read: the store then reads and writes
   *  nothing for the page's life. */
  let locked = unsaved !== null;
  const listeners = new Set<(status: StoreStatus) => void>();
  const lenientCache = new Map<SectionName, Record<string, unknown>>();

  const setStatus = (canSave: boolean, error: string | null): void => {
    if (status.canSave === canSave && status.error === error) return;
    status = { adapter: adapter.kind, canSave, error };
    for (const listener of [...listeners]) listener(status);
  };

  /** One key's text; null when nothing is stored or the read failed. */
  const readText = (name: SectionName): string | null => {
    if (locked) return null;
    try {
      return adapter.read(storageKey(name));
    } catch (err) {
      locked = true;
      setStatus(false, describe(err));
      return null;
    }
  };

  /** Run one adapter write. A write that fails later (Electron's are
   *  asynchronous) has already returned true, and reports through the status. */
  const attempt = (write: () => void | Promise<void>): boolean => {
    if (locked) return false;
    try {
      const pending = write();
      if (pending instanceof Promise) {
        pending.then(
          () => setStatus(true, null),
          (err: unknown) => setStatus(false, describe(err)),
        );
        return true;
      }
    } catch (err) {
      setStatus(false, describe(err));
      return false;
    }
    setStatus(true, null);
    return true;
  };

  const writeEnvelope = (name: SectionName, v: number, data: unknown): boolean => {
    const envelope: Envelope = { v, build, data };
    return attempt(() => adapter.write(storageKey(name), JSON.stringify(envelope)));
  };

  // The store's own stamp. Written only when it is missing or another build's,
  // so a boot on the same build stores nothing; that boot proves the storage
  // instead, where the adapter can.
  const metaText = readText('meta');
  const meta = metaText === null ? null : parseEnvelope(metaText);
  const previousBuild = meta === null || meta.build === '' ? null : meta.build;
  if (meta === null || meta.v !== STORE_VERSION || meta.build !== build) {
    writeEnvelope('meta', STORE_VERSION, {});
  } else if (adapter.prove !== undefined) {
    const prove = adapter.prove.bind(adapter);
    attempt(prove);
  }

  /** The section's live value: the store's own copy, never handed out. */
  const readLenient = <T extends object>(section: LenientSection<T>): Record<string, unknown> => {
    const cached = lenientCache.get(section.name);
    if (cached !== undefined) return cached;
    const text = readText(section.name);
    const envelope = text === null ? null : parseEnvelope(text);
    const stored = envelope !== null && isRecord(envelope.data) ? envelope.data : {};
    const value: Record<string, unknown> = {};
    for (const key of Object.keys(section.fields) as (keyof T & string)[]) {
      const field = section.fields[key];
      const parsed = key in stored ? field.schema.safeParse(stored[key]) : null;
      value[key] = parsed !== null && parsed.success ? parsed.data : field.fallback;
    }
    lenientCache.set(section.name, value);
    return value;
  };

  return {
    build,
    previousBuild,
    status: () => status,
    onStatus(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    read<T extends object>(section: LenientSection<T>): T {
      // Every declared field was filled from its schema or its fallback.
      return { ...readLenient(section) } as T;
    },
    patch<T extends object>(section: LenientSection<T>, changes: Partial<T>): boolean {
      const next = { ...readLenient(section) };
      // Declared fields only, so a stray key in `changes` is never stored.
      for (const key of Object.keys(section.fields) as (keyof T & string)[]) {
        if (key in changes && changes[key] !== undefined) next[key] = changes[key];
      }
      lenientCache.set(section.name, next);
      return writeEnvelope(section.name, section.version, next);
    },
    readStrict<Wire, Loaded>(section: StrictSection<Wire, Loaded>): StrictRead<Loaded> {
      const text = readText(section.name);
      if (text === null) return { status: 'empty' };
      const envelope = parseEnvelope(text);
      if (envelope === null) {
        return { status: 'rejected', reason: 'unreadable', found: null, detail: 'not a store envelope', raw: text };
      }
      if (envelope.v !== section.version) {
        return {
          status: 'rejected',
          reason: 'stale',
          found: envelope.v,
          detail: `stored at version ${envelope.v}, this build reads ${section.version}`,
          raw: text,
        };
      }
      try {
        // The version matched, so the data is taken as the section's wire
        // shape; `load` is what checks it.
        return { status: 'ok', value: section.load(envelope.data as Wire), build: envelope.build };
      } catch (err) {
        return { status: 'rejected', reason: 'unreadable', found: envelope.v, detail: describe(err), raw: text };
      }
    },
    writeStrict(section, wire) {
      return writeEnvelope(section.name, section.version, wire);
    },
    clear(section) {
      lenientCache.delete(section.name);
      return attempt(() => adapter.remove(storageKey(section.name)));
    },
  };
}
