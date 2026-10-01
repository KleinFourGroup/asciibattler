import { describe, expect, it } from 'vitest';
import { DENY_QUERY, chooseAdapter, deniedChoice } from './choose';
import { electronAdapter, type ShellStore } from './electron';
import { createStore } from './store';
import { WEB_PROBE_KEY, readableStorage, webAdapter } from './web';

// 113c — the adapters and the choice between them, over fakes of the two
// hosts: a `Storage` (a Map behind the three methods) and the preload's
// `shellStore`. The real hosts are read in the pane and under Electron
// (WORKLOG §113c).

function fakeStorage(initial: Record<string, string> = {}): Storage & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return {
    items,
    get length() {
      return items.size;
    },
    key: (i: number) => [...items.keys()][i] ?? null,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => {
      items.set(k, v);
    },
    removeItem: (k: string) => {
      items.delete(k);
    },
    clear: () => items.clear(),
  };
}

function fakeShell(initial: string | null): ShellStore & { written: string[]; fail?: Error } {
  const shell: ShellStore & { written: string[]; fail?: Error } = {
    shell: 'electron',
    initial,
    written: [],
    write(text: string) {
      if (shell.fail) return Promise.reject(shell.fail);
      shell.written.push(text);
      return Promise.resolve(true);
    },
  };
  return shell;
}

const securityError = (): Error => Object.assign(new Error('The operation is insecure.'), { name: 'SecurityError' });
const quotaError = (): Error => Object.assign(new Error('the quota has been exceeded'), { name: 'QuotaExceededError' });

describe('113c — the web adapter', () => {
  it('keeps each key as one item', () => {
    const storage = fakeStorage({ 'asciibattler:settings': 'kept' });
    const adapter = webAdapter(storage);
    expect(adapter.kind).toBe('web');
    expect(adapter.read('asciibattler:settings')).toBe('kept');
    expect(adapter.read('asciibattler:run')).toBeNull();
    void adapter.write('asciibattler:run', 'text');
    expect(storage.items.get('asciibattler:run')).toBe('text');
    void adapter.remove('asciibattler:run');
    expect(storage.items.has('asciibattler:run')).toBe(false);
  });

  it('proves a storage by a write, a read and a remove, and leaves nothing behind', () => {
    const storage = fakeStorage();
    webAdapter(storage).prove?.();
    expect(storage.items.has(WEB_PROBE_KEY)).toBe(false);

    const deaf = fakeStorage();
    deaf.setItem = () => {};
    expect(() => webAdapter(deaf).prove?.()).toThrow('did not return what was written');

    const full = fakeStorage();
    full.setItem = () => {
      throw quotaError();
    };
    expect(() => webAdapter(full).prove?.()).toThrow('quota');
  });

  it('takes a storage as readable by its three methods and a read, never by its existence', () => {
    expect(readableStorage(fakeStorage())).toBe(true);
    expect(readableStorage(undefined)).toBe(false);
    expect(readableStorage(null)).toBe(false);
    // Node 25's global: an object with no `setItem`.
    expect(readableStorage({})).toBe(false);
    expect(readableStorage({ getItem: () => null })).toBe(false);
    // A storage that reads and can't write is still the player's data.
    const full = fakeStorage({ 'asciibattler:settings': 'kept' });
    full.setItem = () => {
      throw quotaError();
    };
    expect(readableStorage(full)).toBe(true);
    const blocked = fakeStorage();
    blocked.getItem = () => {
      throw securityError();
    };
    expect(() => readableStorage(blocked)).toThrow('insecure');
  });
});

describe('113c — the Electron adapter', () => {
  it('reads the file as the keys to their text', () => {
    const adapter = electronAdapter(fakeShell(JSON.stringify({ 'asciibattler:settings': 'kept', other: 7 })));
    expect(adapter.kind).toBe('electron');
    expect(adapter.read('asciibattler:settings')).toBe('kept');
    expect(adapter.read('other')).toBeNull();
    expect(adapter.read('asciibattler:run')).toBeNull();
  });

  it('reads no file, and text that is not the store file, as empty', () => {
    for (const initial of [null, '', '{not json', '"text"', '[1]', 'null', '110a round trip ✓']) {
      expect(electronAdapter(fakeShell(initial)).read('asciibattler:settings'), String(initial)).toBeNull();
    }
  });

  it('sends the whole file on every write, so the last write holds every key', async () => {
    const shell = fakeShell(JSON.stringify({ 'asciibattler:settings': 'kept' }));
    const adapter = electronAdapter(shell);
    await adapter.write('asciibattler:run', 'slot');
    await adapter.write('asciibattler:progress', 'unlocks');
    await adapter.remove('asciibattler:run');
    expect(shell.written.map((t) => JSON.parse(t) as unknown)).toEqual([
      { 'asciibattler:settings': 'kept', 'asciibattler:run': 'slot' },
      { 'asciibattler:settings': 'kept', 'asciibattler:run': 'slot', 'asciibattler:progress': 'unlocks' },
      { 'asciibattler:settings': 'kept', 'asciibattler:progress': 'unlocks' },
    ]);
    expect(adapter.read('asciibattler:progress')).toBe('unlocks');
  });

  it('round-trips a store through the file text across two launches', async () => {
    const first = fakeShell(null);
    createStore({ adapter: electronAdapter(first), build: 'b1' });
    await Promise.resolve();
    const file = first.written.at(-1) ?? null;
    expect(file).not.toBeNull();
    const second = createStore({ adapter: electronAdapter(fakeShell(file)), build: 'b2' });
    expect(second.previousBuild).toBe('b1');
  });

  it('reports a write main refuses through the store status', async () => {
    const shell = fakeShell(null);
    shell.fail = new Error('EACCES: permission denied');
    const store = createStore({ adapter: electronAdapter(shell), build: 'b' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.status()).toEqual({ adapter: 'electron', canSave: false, error: 'Error: EACCES: permission denied' });
  });
});

describe('113c — the choice', () => {
  it('takes the Electron bridge when the preload put one on the window, over localStorage', () => {
    const choice = chooseAdapter({ shellStore: fakeShell(null), localStorage: fakeStorage() });
    expect(choice.adapter.kind).toBe('electron');
    expect(choice.unsaved).toBeNull();
  });

  it('takes a localStorage that reads', () => {
    const choice = chooseAdapter({ localStorage: fakeStorage() });
    expect(choice.adapter.kind).toBe('web');
    expect(choice.unsaved).toBeNull();
  });

  it('still takes a localStorage that reads but cannot write, and the store says it cannot save', () => {
    const full = fakeStorage({
      'asciibattler:meta': JSON.stringify({ v: 1, build: 'b', data: {} }),
    });
    full.setItem = () => {
      throw quotaError();
    };
    const choice = chooseAdapter({ localStorage: full });
    expect(choice.adapter.kind).toBe('web');
    const store = createStore({ ...choice, build: 'b' });
    // The same build wrote nothing, so the proof is what found it out.
    expect(store.previousBuild).toBe('b');
    expect(store.status()).toEqual({ adapter: 'web', canSave: false, error: 'QuotaExceededError: the quota has been exceeded' });
  });

  it('falls back to memory, with the reason, where there is nothing to store in', () => {
    expect(chooseAdapter(undefined)).toMatchObject({ unsaved: 'no window: nothing to store in' });
    expect(chooseAdapter({}).unsaved).toBe('no usable localStorage on this page');
    // Node 25's shape: a global that is an object and stores nothing.
    expect(chooseAdapter({ localStorage: {} }).unsaved).toBe('no usable localStorage on this page');
    expect(chooseAdapter(undefined).adapter.kind).toBe('memory');
  });

  it('falls back when touching localStorage throws, as a browser with site data blocked does', () => {
    const host = Object.defineProperty({}, 'localStorage', {
      get() {
        throw securityError();
      },
    });
    expect(chooseAdapter(host).unsaved).toBe('SecurityError: The operation is insecure.');
    const blocked = fakeStorage();
    blocked.getItem = () => {
      throw securityError();
    };
    expect(chooseAdapter({ localStorage: blocked }).unsaved).toBe('SecurityError: The operation is insecure.');
  });

  it('gets a memory store under Node, where index.ts finds no window', () => {
    // What index.ts passes. Node's own `localStorage` global is never
    // consulted (touching it here would print Node's warning on every run;
    // its shape, an object with no `setItem`, is the `{}` case above).
    const host: unknown = typeof window === 'undefined' ? undefined : window;
    expect(host).toBeUndefined();
    expect(chooseAdapter(host).adapter.kind).toBe('memory');
  });

  it('plants a refused store on ?store=deny, and the store starts and stays at cannot save', () => {
    expect(DENY_QUERY).toBe('store=deny');
    const choice = deniedChoice();
    expect(choice.unsaved).toBe('SecurityError: planted by ?store=deny');
    const store = createStore({ ...choice, build: 'b' });
    expect(store.status()).toEqual({ adapter: 'memory', canSave: false, error: 'SecurityError: planted by ?store=deny' });
    expect(store.writeStrict({ policy: 'strict', name: 'run', version: 1, load: (w: unknown) => w }, { seed: 1 })).toBe(false);
    expect(store.readStrict({ policy: 'strict', name: 'run', version: 1, load: (w: unknown) => w })).toEqual({ status: 'empty' });
  });
});
