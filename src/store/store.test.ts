import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { memoryAdapter, type StorageAdapter } from './adapter';
import {
  SECTION_NAMES,
  STORE_VERSION,
  createStore,
  storageKey,
  type LenientSection,
  type StoreStatus,
  type StrictSection,
} from './store';

// 113b — the store's core, over the memory adapter. The sections here are
// fixtures: the real ones arrive with their consumers. Stored text is planted
// and read back through `adapter.entries`, not through the store, so a pin
// never compares the store with itself.

interface Prefs {
  volume: number;
  speed: 1 | 2 | 3;
  locale: string;
}
const PREFS: LenientSection<Prefs> = {
  policy: 'lenient',
  name: 'settings',
  version: 3,
  fields: {
    volume: { schema: z.number().min(0).max(1), fallback: 1 },
    speed: { schema: z.union([z.literal(1), z.literal(2), z.literal(3)]), fallback: 1 },
    locale: { schema: z.string().min(1), fallback: 'en' },
  },
};

interface SlotWire {
  seed: number;
}
const SLOT: StrictSection<SlotWire, { seed: number; loaded: true }> = {
  policy: 'strict',
  name: 'run',
  version: 46,
  load: (wire) => {
    if (typeof wire.seed !== 'number') throw new Error('no seed');
    return { seed: wire.seed, loaded: true };
  },
};

const SETTINGS_KEY = 'asciibattler:settings';
const RUN_KEY = 'asciibattler:run';
const META_KEY = 'asciibattler:meta';

const envelope = (v: number, data: unknown, build = '0.0.0+aaaaaaa'): string => JSON.stringify({ v, build, data });
const stored = (adapter: { entries: Map<string, string> }, key: string): unknown =>
  JSON.parse(adapter.entries.get(key) ?? 'null');

/** An adapter over a memory one whose named operations throw or reject. */
function failing(
  inner: StorageAdapter,
  faults: { read?: Error; write?: Error; writeRejects?: Error },
): StorageAdapter & { writes: number } {
  const wrapped = {
    kind: inner.kind,
    writes: 0,
    read(key: string): string | null {
      if (faults.read) throw faults.read;
      return inner.read(key);
    },
    write(key: string, text: string): void | Promise<void> {
      wrapped.writes++;
      if (faults.write) throw faults.write;
      if (faults.writeRejects) return Promise.reject(faults.writeRejects);
      return inner.write(key, text);
    },
    remove(key: string): void | Promise<void> {
      wrapped.writes++;
      if (faults.write) throw faults.write;
      return inner.remove(key);
    },
  };
  return wrapped;
}
const quota = (): Error => Object.assign(new Error('the quota has been exceeded'), { name: 'QuotaExceededError' });
const denied = (): Error => Object.assign(new Error('the operation is insecure'), { name: 'SecurityError' });

describe('113b — the store: keys and the stamp', () => {
  it('keeps one namespaced key per section, by these exact names', () => {
    // Permanent: each is a key in players' browsers.
    expect(SECTION_NAMES.map(storageKey)).toEqual([
      'asciibattler:meta',
      'asciibattler:settings',
      'asciibattler:progress',
      'asciibattler:run',
      'asciibattler:journals',
    ]);
  });

  it('reads an empty store as a new player and stamps it with the build', () => {
    const adapter = memoryAdapter();
    const store = createStore({ adapter, build: '0.1.0+abc1234' });
    expect(store.previousBuild).toBeNull();
    expect(store.build).toBe('0.1.0+abc1234');
    expect(stored(adapter, META_KEY)).toEqual({ v: STORE_VERSION, build: '0.1.0+abc1234', data: {} });
    expect(store.status()).toEqual({ adapter: 'memory', canSave: true, error: null });
  });

  it('writes nothing at a boot on the same build, and re-stamps on another', () => {
    const adapter = memoryAdapter();
    createStore({ adapter, build: '0.1.0+abc1234' });
    const counting = failing(adapter, {});
    const again = createStore({ adapter: counting, build: '0.1.0+abc1234' });
    expect(again.previousBuild).toBe('0.1.0+abc1234');
    expect(counting.writes).toBe(0);

    const next = createStore({ adapter: counting, build: '0.1.1+def5678' });
    expect(next.previousBuild).toBe('0.1.0+abc1234');
    expect(counting.writes).toBe(1);
    expect(stored(adapter, META_KEY)).toEqual({ v: STORE_VERSION, build: '0.1.1+def5678', data: {} });
  });
});

describe('113b — the lenient policy', () => {
  it('gives every field its fallback on an empty store', () => {
    const store = createStore({ adapter: memoryAdapter(), build: 'b' });
    expect(store.read(PREFS)).toEqual({ volume: 1, speed: 1, locale: 'en' });
  });

  it('keeps good values, drops an unknown key, defaults a missing one, and resets a bad value alone', () => {
    const adapter = memoryAdapter({
      // volume good · speed refused by its schema · locale missing · `camera` unknown
      [SETTINGS_KEY]: envelope(3, { volume: 0.25, speed: 9, camera: 'orbit' }),
    });
    const store = createStore({ adapter, build: 'b' });
    expect(store.read(PREFS)).toEqual({ volume: 0.25, speed: 1, locale: 'en' });
    // The read alone rewrites nothing.
    expect(stored(adapter, SETTINGS_KEY)).toEqual({ v: 3, build: '0.0.0+aaaaaaa', data: { volume: 0.25, speed: 9, camera: 'orbit' } });
    // The next write stores the declared fields only.
    expect(store.patch(PREFS, { locale: 'fr' })).toBe(true);
    expect(stored(adapter, SETTINGS_KEY)).toEqual({ v: 3, build: 'b', data: { volume: 0.25, speed: 1, locale: 'fr' } });
  });

  it('never judges the version: another version reads the same', () => {
    const data = { volume: 0.5, speed: 2, locale: 'de' };
    for (const v of [1, 3, 99]) {
      const store = createStore({ adapter: memoryAdapter({ [SETTINGS_KEY]: envelope(v, data) }), build: 'b' });
      expect(store.read(PREFS)).toEqual(data);
    }
  });

  it('reads text that is not an envelope as an empty section', () => {
    for (const text of ['{not json', '"a string"', '[1,2]', '{"data":{"volume":0.5}}', envelope(3, 'not an object'), envelope(3, null)]) {
      const store = createStore({ adapter: memoryAdapter({ [SETTINGS_KEY]: text }), build: 'b' });
      expect(store.read(PREFS), text).toEqual({ volume: 1, speed: 1, locale: 'en' });
    }
  });

  it('round-trips a patch into a second store over the same storage', () => {
    const adapter = memoryAdapter();
    const first = createStore({ adapter, build: 'b1' });
    expect(first.patch(PREFS, { volume: 0.4, speed: 3 })).toBe(true);
    expect(first.read(PREFS)).toEqual({ volume: 0.4, speed: 3, locale: 'en' });
    const second = createStore({ adapter, build: 'b2' });
    expect(second.read(PREFS)).toEqual({ volume: 0.4, speed: 3, locale: 'en' });
    // The section keeps the build that wrote it; only the stamp moved to b2.
    expect(stored(adapter, SETTINGS_KEY)).toMatchObject({ v: 3, build: 'b1' });
    expect(stored(adapter, META_KEY)).toMatchObject({ build: 'b2' });
  });

  it('hands out a fresh object, so a caller cannot change what the store holds', () => {
    const store = createStore({ adapter: memoryAdapter(), build: 'b' });
    const prefs = store.read(PREFS);
    prefs.volume = 0;
    expect(store.read(PREFS).volume).toBe(1);
  });

  it('never stores a key the section does not declare', () => {
    const adapter = memoryAdapter();
    const store = createStore({ adapter, build: 'b' });
    store.patch(PREFS, { volume: 0.5, stray: true } as Partial<Prefs>);
    expect(stored(adapter, SETTINGS_KEY)).toEqual({ v: 3, build: 'b', data: { volume: 0.5, speed: 1, locale: 'en' } });
  });

  it('clears a section back to its fallbacks', () => {
    const adapter = memoryAdapter();
    const store = createStore({ adapter, build: 'b' });
    store.patch(PREFS, { volume: 0.5 });
    expect(store.clear(PREFS)).toBe(true);
    expect(adapter.entries.has(SETTINGS_KEY)).toBe(false);
    expect(store.read(PREFS)).toEqual({ volume: 1, speed: 1, locale: 'en' });
  });
});

describe('113b — the strict policy', () => {
  it('reads an absent section as empty and a current one through its loader', () => {
    const adapter = memoryAdapter();
    const store = createStore({ adapter, build: 'b' });
    expect(store.readStrict(SLOT)).toEqual({ status: 'empty' });
    expect(store.writeStrict(SLOT, { seed: 7 })).toBe(true);
    expect(stored(adapter, RUN_KEY)).toEqual({ v: 46, build: 'b', data: { seed: 7 } });
    expect(store.readStrict(SLOT)).toEqual({ status: 'ok', value: { seed: 7, loaded: true }, build: 'b' });
  });

  it('rejects a stale version, keeps the text, and leaves the lenient sections alone', () => {
    const stale = envelope(45, { seed: 7 });
    const settings = envelope(3, { volume: 0.25, speed: 2, locale: 'fr' });
    const adapter = memoryAdapter({ [RUN_KEY]: stale, [SETTINGS_KEY]: settings });
    const store = createStore({ adapter, build: 'b' });
    expect(store.readStrict(SLOT)).toEqual({
      status: 'rejected',
      reason: 'stale',
      found: 45,
      detail: 'stored at version 45, this build reads 46',
      raw: stale,
    });
    expect(adapter.entries.get(RUN_KEY)).toBe(stale);
    expect(adapter.entries.get(SETTINGS_KEY)).toBe(settings);
    expect(store.read(PREFS)).toEqual({ volume: 0.25, speed: 2, locale: 'fr' });
  });

  it('rejects text that is not an envelope, and data its loader refuses, as unreadable', () => {
    const broken = createStore({ adapter: memoryAdapter({ [RUN_KEY]: '{not json' }), build: 'b' });
    expect(broken.readStrict(SLOT)).toEqual({
      status: 'rejected',
      reason: 'unreadable',
      found: null,
      detail: 'not a store envelope',
      raw: '{not json',
    });
    const refused = envelope(46, { seed: 'seven' });
    const store = createStore({ adapter: memoryAdapter({ [RUN_KEY]: refused }), build: 'b' });
    expect(store.readStrict(SLOT)).toEqual({
      status: 'rejected',
      reason: 'unreadable',
      found: 46,
      detail: 'Error: no seed',
      raw: refused,
    });
  });

  it('clears a rejected section only when asked', () => {
    const adapter = memoryAdapter({ [RUN_KEY]: envelope(45, { seed: 7 }) });
    const store = createStore({ adapter, build: 'b' });
    store.readStrict(SLOT);
    expect(adapter.entries.has(RUN_KEY)).toBe(true);
    expect(store.clear(SLOT)).toBe(true);
    expect(store.readStrict(SLOT)).toEqual({ status: 'empty' });
  });
});

describe('113b — a store that fails', () => {
  it('survives an adapter that throws on read, and then writes nothing', () => {
    const inner = memoryAdapter({ [SETTINGS_KEY]: envelope(3, { volume: 0.25, speed: 2, locale: 'fr' }) });
    const adapter = failing(inner, { read: denied() });
    const store = createStore({ adapter, build: 'b' });
    expect(store.status()).toEqual({ adapter: 'memory', canSave: false, error: 'SecurityError: the operation is insecure' });
    expect(store.previousBuild).toBeNull();
    expect(store.read(PREFS)).toEqual({ volume: 1, speed: 1, locale: 'en' });
    expect(store.readStrict(SLOT)).toEqual({ status: 'empty' });
    // A store that couldn't read what is there must not write over it.
    expect(store.patch(PREFS, { volume: 0.9 })).toBe(false);
    // The value still holds for the page's life.
    expect(store.read(PREFS).volume).toBe(0.9);
    expect(store.writeStrict(SLOT, { seed: 1 })).toBe(false);
    expect(store.clear(PREFS)).toBe(false);
    expect(store.read(PREFS).volume).toBe(1);
    expect(adapter.writes).toBe(0);
    expect(inner.entries.get(SETTINGS_KEY)).toBe(envelope(3, { volume: 0.25, speed: 2, locale: 'fr' }));
  });

  it('turns a write that throws into "can\'t save", tells its listeners, and recovers on the next good write', () => {
    const inner = memoryAdapter();
    createStore({ adapter: inner, build: 'b' }); // the stamp, so the next boot writes nothing
    const faults: { write?: Error } = { write: quota() };
    const store = createStore({ adapter: failing(inner, faults), build: 'b' });
    const seen: StoreStatus[] = [];
    const off = store.onStatus((s) => seen.push(s));
    expect(store.status().canSave).toBe(true);

    expect(store.patch(PREFS, { volume: 0.5 })).toBe(false);
    expect(store.status()).toEqual({ adapter: 'memory', canSave: false, error: 'QuotaExceededError: the quota has been exceeded' });
    expect(seen).toEqual([store.status()]);
    expect(store.read(PREFS).volume).toBe(0.5);
    expect(inner.entries.has(SETTINGS_KEY)).toBe(false);

    delete faults.write;
    expect(store.patch(PREFS, { speed: 2 })).toBe(true);
    expect(store.status()).toEqual({ adapter: 'memory', canSave: true, error: null });
    expect(seen).toHaveLength(2);
    expect(stored(inner, SETTINGS_KEY)).toEqual({ v: 3, build: 'b', data: { volume: 0.5, speed: 2, locale: 'en' } });

    off();
    faults.write = quota();
    store.patch(PREFS, { speed: 3 });
    expect(seen).toHaveLength(2);
  });

  it('learns at boot that it cannot save when the stamp itself fails', () => {
    const store = createStore({ adapter: failing(memoryAdapter(), { write: denied() }), build: 'b' });
    expect(store.status().canSave).toBe(false);
    expect(store.read(PREFS)).toEqual({ volume: 1, speed: 1, locale: 'en' });
  });

  it('reports a write that fails later (an asynchronous adapter) through the status', async () => {
    const inner = memoryAdapter();
    createStore({ adapter: inner, build: 'b' });
    const store = createStore({ adapter: failing(inner, { writeRejects: quota() }), build: 'b' });
    const seen: StoreStatus[] = [];
    store.onStatus((s) => seen.push(s));
    expect(store.patch(PREFS, { volume: 0.5 })).toBe(true);
    expect(store.status().canSave).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(store.status()).toEqual({ adapter: 'memory', canSave: false, error: 'QuotaExceededError: the quota has been exceeded' });
    expect(seen).toHaveLength(1);
  });
});
