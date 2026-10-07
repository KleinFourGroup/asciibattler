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

// 116h — the whole store as text. Two stores over two adapters stand for two
// browsers; what a restore wrote is read from the adapter's map.
describe('116h — the whole store as text', () => {
  const JOURNALS_KEY = 'asciibattler:journals';
  const PROGRESS_KEY = 'asciibattler:progress';
  const KEYS = SECTION_NAMES.map(storageKey);
  const planted = (): Record<string, string> => ({
    [SETTINGS_KEY]: envelope(3, { volume: 0.25, speed: 2, locale: 'fr' }),
    [RUN_KEY]: envelope(46, { seed: 7 }),
    [JOURNALS_KEY]: 'not an envelope, and kept as it is',
  });
  const textsOf = (adapter: { entries: Map<string, string> }): (string | null)[] =>
    KEYS.map((key) => adapter.entries.get(key) ?? null);

  /** A memory adapter whose writes and removes wait to be let through. */
  function gated(initial: Record<string, string> = {}) {
    const inner = memoryAdapter(initial);
    const waiting: (() => void)[] = [];
    const later = (act: () => void): Promise<void> =>
      new Promise((resolve) => {
        waiting.push(() => {
          act();
          resolve();
        });
      });
    const adapter: StorageAdapter = {
      kind: 'electron',
      read: (key) => inner.read(key),
      write: (key, text) => later(() => inner.write(key, text)),
      remove: (key) => later(() => inner.remove(key)),
    };
    return { adapter, inner, waiting };
  }
  const tick = async (): Promise<void> => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  it('dumps every section by name: the stored text, and null where nothing is stored', () => {
    const adapter = memoryAdapter(planted());
    const dump = createStore({ adapter, build: 'b' }).dump();
    expect(dump).toEqual({
      meta: adapter.entries.get(META_KEY),
      settings: planted()[SETTINGS_KEY],
      progress: null,
      run: planted()[RUN_KEY],
      journals: planted()[JOURNALS_KEY],
    });
    expect(Object.keys(dump!)).toEqual([...SECTION_NAMES]);
  });

  it('restored into an empty store, every section reads back equal', async () => {
    const from = memoryAdapter(planted());
    const dump = createStore({ adapter: from, build: '0.1.0+abc1234' }).dump()!;

    const to = memoryAdapter();
    expect(await createStore({ adapter: to, build: '0.1.0+abc1234' }).restore(dump)).toEqual({ ok: true });
    expect(textsOf(to)).toEqual(textsOf(from));
    expect(to.entries.has(PROGRESS_KEY)).toBe(false);

    // The next boot reads it as its own, each section by its policy.
    const next = createStore({ adapter: to, build: '0.1.0+abc1234' });
    expect(next.read(PREFS)).toEqual({ volume: 0.25, speed: 2, locale: 'fr' });
    expect(next.readStrict(SLOT)).toEqual({ status: 'ok', value: { seed: 7, loaded: true }, build: '0.0.0+aaaaaaa' });
    expect(next.previousBuild).toBe('0.1.0+abc1234');
  });

  it('removes a section the dump holds no text for', async () => {
    const adapter = memoryAdapter(planted());
    const store = createStore({ adapter, build: 'b' });
    const dump = { ...store.dump()!, run: null, journals: null };
    expect(await store.restore(dump)).toEqual({ ok: true });
    expect(adapter.entries.has(RUN_KEY)).toBe(false);
    expect(adapter.entries.has(JOURNALS_KEY)).toBe(false);
    expect(adapter.entries.get(SETTINGS_KEY)).toBe(planted()[SETTINGS_KEY]);
  });

  it('writes only the sections that differ', async () => {
    const inner = memoryAdapter(planted());
    createStore({ adapter: inner, build: 'b' });
    const adapter = failing(inner, {});
    const store = createStore({ adapter, build: 'b' });
    expect(await store.restore(store.dump()!)).toEqual({ ok: true });
    expect(adapter.writes).toBe(0);
  });

  it('after a restore the page saves nothing more, and is not told it cannot save', async () => {
    const inner = memoryAdapter(planted());
    createStore({ adapter: inner, build: 'b' });
    const adapter = failing(inner, {});
    const store = createStore({ adapter, build: 'b' });
    const seen: StoreStatus[] = [];
    store.onStatus((s) => seen.push(s));
    const dump = { ...store.dump()!, settings: envelope(3, { volume: 0.75, speed: 3, locale: 'de' }) };
    expect(await store.restore(dump)).toEqual({ ok: true });
    const after = textsOf(inner);
    const writes = adapter.writes;
    expect(writes).toBe(1);

    // The page as it was: its autosave, a settings change, a run's end.
    expect(store.writeStrict(SLOT, { seed: 99 })).toBe(false);
    expect(store.patch(PREFS, { volume: 0.1 })).toBe(false);
    expect(store.clear(SLOT)).toBe(false);
    expect((await store.restore(dump)).ok).toBe(false);
    expect(textsOf(inner)).toEqual(after);
    expect(adapter.writes).toBe(writes);
    expect(store.status()).toEqual({ adapter: 'memory', canSave: true, error: null });
    expect(seen).toEqual([]);
    // The control: the same call on a store that restored nothing does write.
    const control = createStore({ adapter: inner, build: 'b' });
    expect(control.writeStrict(SLOT, { seed: 99 })).toBe(true);
    expect(textsOf(inner)).not.toEqual(after);
  });

  it('a write that fails puts back what was there, and the store saves again', async () => {
    const inner = memoryAdapter(planted());
    createStore({ adapter: inner, build: 'b' });
    const before = textsOf(inner);
    // The third section written is refused; two have landed by then.
    let writes = 0;
    let refusing = true;
    let most = 0;
    const differing = (): number => textsOf(inner).filter((text, i) => text !== before[i]).length;
    const adapter: StorageAdapter = {
      kind: 'memory',
      read: (key) => inner.read(key),
      write: (key, text) => {
        if (refusing && ++writes === 3) throw quota();
        inner.write(key, text);
        most = Math.max(most, differing());
      },
      remove: (key) => inner.remove(key),
    };
    const store = createStore({ adapter, build: 'b' });
    const dump = {
      meta: before[0]!,
      settings: envelope(3, { volume: 0.75, speed: 3, locale: 'de' }),
      progress: envelope(1, { seen: true }),
      run: envelope(46, { seed: 8 }),
      journals: envelope(1, []),
    };
    expect(await store.restore(dump)).toEqual({ ok: false, error: 'QuotaExceededError: the quota has been exceeded', putBack: true });
    // The control: two sections had been replaced when the third was refused.
    expect(most).toBe(2);
    expect(textsOf(inner)).toEqual(before);
    expect(inner.entries.has(PROGRESS_KEY)).toBe(false);
    expect(store.status()).toEqual({ adapter: 'memory', canSave: true, error: null });

    refusing = false;
    expect(store.patch(PREFS, { volume: 0.5 })).toBe(true);
    expect(await store.restore(dump)).toEqual({ ok: true });
    expect(textsOf(inner)).toEqual([dump.meta, dump.settings, dump.progress, dump.run, dump.journals]);
  });

  it('says it cannot save when what was there could not be put back', async () => {
    const inner = memoryAdapter(planted());
    createStore({ adapter: inner, build: 'b' });
    // The first write lands, and every one after it is refused.
    let writes = 0;
    const adapter: StorageAdapter = {
      kind: 'memory',
      read: (key) => inner.read(key),
      write: (key, text) => {
        if (++writes >= 2) throw quota();
        inner.write(key, text);
      },
      remove: (key) => inner.remove(key),
    };
    const store = createStore({ adapter, build: 'b' });
    const dump = { ...store.dump()!, settings: envelope(3, { volume: 0.75 }), run: envelope(46, { seed: 8 }) };
    expect(await store.restore(dump)).toEqual({ ok: false, error: 'QuotaExceededError: the quota has been exceeded', putBack: false });
    expect(store.status()).toEqual({ adapter: 'memory', canSave: false, error: 'QuotaExceededError: the quota has been exceeded' });
  });

  it('over an asynchronous adapter, writes one section at a time and lets nothing in between', async () => {
    const { adapter, inner, waiting } = gated(planted());
    const store = createStore({ adapter, build: 'b' });
    waiting.splice(0).forEach((go) => go()); // the stamp
    await tick();
    const dump = {
      ...store.dump()!,
      settings: envelope(3, { volume: 0.75, speed: 3, locale: 'de' }),
      run: envelope(46, { seed: 8 }),
    };
    let result: unknown = null;
    void store.restore(dump).then((r) => {
      result = r;
    });
    await tick();
    expect(waiting).toHaveLength(1);
    // The page's own autosave, between the restore's first write and its second.
    expect(store.writeStrict(SLOT, { seed: 99 })).toBe(false);
    expect(waiting).toHaveLength(1);
    waiting.shift()!();
    await tick();
    expect(inner.entries.get(SETTINGS_KEY)).toBe(dump.settings);
    expect(result).toBeNull();
    expect(waiting).toHaveLength(1);
    waiting.shift()!();
    await tick();
    expect(result).toEqual({ ok: true });
    expect(inner.entries.get(RUN_KEY)).toBe(dump.run);
  });

  it('a store that cannot read has no dump and restores nothing', async () => {
    const inner = memoryAdapter(planted());
    const adapter = failing(inner, {});
    const store = createStore({ adapter, build: 'b', unsaved: 'SecurityError: planted' });
    expect(store.dump()).toBeNull();
    const dump = { meta: null, settings: null, progress: null, run: null, journals: null };
    expect(await store.restore(dump)).toEqual({ ok: false, error: 'SecurityError: planted', putBack: true });
    expect(adapter.writes).toBe(0);
    expect(inner.entries.get(SETTINGS_KEY)).toBe(planted()[SETTINGS_KEY]);

    const throwing = createStore({ adapter: failing(memoryAdapter(planted()), { read: denied() }), build: 'b' });
    expect(throwing.dump()).toBeNull();
  });
});
