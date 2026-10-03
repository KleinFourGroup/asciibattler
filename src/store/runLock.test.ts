import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANSWER_WAIT_MS, RUN_LOCK_NAME, acquireRunLock, type LockManagerLike } from './runLock';

// 115f — the two-tab lock, over a stand-in for the browser's lock manager.
//
// The stand-in keeps the rules of the real one that the lock rests on: a name
// has one holder, held until the promise its callback returned settles or its
// page goes; a request made with `ifAvailable` is answered with null when the
// name is taken, in a later task, never inside `request`; and `query` lists
// what is held across every page of the origin. What it can't say is whether
// a real browser keeps them (the pane and Electron are measured in the
// WORKLOG, §115f).

interface Page {
  readonly locks: LockManagerLike;
  /** The tab closes: everything it held is free. */
  close(): void;
}

interface Origin {
  page(): Page;
  holders(): number;
  /** How many requests the pages have made. */
  requests(): number;
  /** Runs once, after the next refusal and before its `query` is answered. */
  afterRefusal: (() => void) | null;
}

/** The pages of one origin, sharing its locks. `answerAfterMs` delays every answer. */
function origin(answerAfterMs = 0): Origin {
  const held = new Map<string, object>();
  let requests = 0;
  const tabs: Origin = {
    holders: () => held.size,
    requests: () => requests,
    afterRefusal: null,
    page() {
      const self = {};
      return {
        locks: {
          async request(name, _options, callback) {
            requests++;
            await new Promise((r) => setTimeout(r, answerAfterMs));
            if (held.has(name)) {
              const answer = callback(null);
              tabs.afterRefusal?.();
              tabs.afterRefusal = null;
              return answer;
            }
            held.set(name, self);
            try {
              return await callback({ name });
            } finally {
              if (held.get(name) === self) held.delete(name);
            }
          },
          async query() {
            await Promise.resolve();
            return { held: [...held.keys()].map((name) => ({ name })) };
          },
        },
        close() {
          for (const [name, page] of held) if (page === self) held.delete(name);
        },
      };
    },
  };
  return tabs;
}

/** A lock manager that refuses every request and lists nothing held: what a
 *  second instance of the Electron shell on one profile was measured to have. */
function refusesEverything(): LockManagerLike & { requests(): number } {
  let requests = 0;
  return {
    requests: () => requests,
    async request(_name, _options, callback) {
      requests++;
      await Promise.resolve();
      return callback(null);
    },
    query: () => Promise.resolve({ held: [] }),
  };
}

/** Let every pending answer arrive (fake timers). */
const settle = (): Promise<unknown> => vi.advanceTimersByTimeAsync(1);

describe('115f — the two-tab lock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is named for the key it guards', () => {
    // Permanent: a tab on an older build contends for the same name.
    expect(RUN_LOCK_NAME).toBe('asciibattler:run');
  });

  it('the first tab to boot holds the lock, and a second finds it elsewhere', async () => {
    vi.useFakeTimers();
    const tabs = origin();
    const first = acquireRunLock(tabs.page().locks);
    await settle();
    expect(await first).toBe('held');
    const second = acquireRunLock(tabs.page().locks);
    await settle();
    expect(await second).toBe('elsewhere');
    // One request each, and an answered request leaves no timer behind.
    expect(tabs.requests()).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('two tabs booting at once: one holds it, the other is elsewhere', async () => {
    vi.useFakeTimers();
    const tabs = origin();
    const both = Promise.all([acquireRunLock(tabs.page().locks), acquireRunLock(tabs.page().locks)]);
    await settle();
    expect(await both).toEqual(['held', 'elsewhere']);
  });

  it('is held for the life of the page: free once the page goes, and not before', async () => {
    vi.useFakeTimers();
    const tabs = origin();
    const firstPage = tabs.page();
    const first = acquireRunLock(firstPage.locks);
    await settle();
    expect(await first).toBe('held');
    // An hour on, the first tab still holds it.
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(tabs.holders()).toBe(1);
    const during = acquireRunLock(tabs.page().locks);
    await settle();
    expect(await during).toBe('elsewhere');
    // The tab closes (or reloads): the next boot is the first tab again.
    firstPage.close();
    expect(tabs.holders()).toBe(0);
    const after = acquireRunLock(tabs.page().locks);
    await settle();
    expect(await after).toBe('held');
  });

  it('no lock where the API is missing or fails: the tab saves as if alone', async () => {
    const query = (): Promise<{ held: [] }> => Promise.resolve({ held: [] });
    expect(await acquireRunLock(undefined)).toBe('none');
    expect(await acquireRunLock({} as LockManagerLike)).toBe('none');
    expect(await acquireRunLock({ request: origin().page().locks.request } as LockManagerLike)).toBe('none');
    const throws: LockManagerLike = {
      request() {
        throw new DOMException('refused', 'SecurityError');
      },
      query,
    };
    expect(await acquireRunLock(throws)).toBe('none');
    const rejects: LockManagerLike = { request: () => Promise.reject(new DOMException('refused', 'SecurityError')), query };
    expect(await acquireRunLock(rejects)).toBe('none');
  });

  it('a refusal that names no holder is not a second tab', async () => {
    // Asked twice (the holder may have gone between the refusal and the
    // query), then no lock.
    const broken = refusesEverything();
    expect(await acquireRunLock(broken)).toBe('none');
    expect(broken.requests()).toBe(2);
    // The same refusals with a `query` that fails: no lock either.
    const blind: LockManagerLike = { request: refusesEverything().request, query: () => Promise.reject(new Error('no storage')) };
    expect(await acquireRunLock(blind)).toBe('none');
  });

  it('the holder goes between the refusal and the query: the tab takes the free lock', async () => {
    vi.useFakeTimers();
    const tabs = origin();
    const firstPage = tabs.page();
    const first = acquireRunLock(firstPage.locks);
    await settle();
    expect(await first).toBe('held');
    tabs.afterRefusal = () => firstPage.close();
    const second = acquireRunLock(tabs.page().locks);
    await settle();
    await settle();
    expect(await second).toBe('held');
    expect(tabs.holders()).toBe(1);
    // A third tab is now the second.
    const third = acquireRunLock(tabs.page().locks);
    await settle();
    expect(await third).toBe('elsewhere');
  });

  it('a boot never hangs on the lock: no answer within the wait is no lock', async () => {
    vi.useFakeTimers();
    const silent: LockManagerLike = { request: () => new Promise(() => {}), query: () => new Promise(() => {}) };
    let answer: string | null = null;
    void acquireRunLock(silent).then((lock) => {
      answer = lock;
    });
    await vi.advanceTimersByTimeAsync(ANSWER_WAIT_MS - 1);
    expect(answer).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(answer).toBe('none');
  });

  it('a grant that comes after the wait is still held, so later tabs are kept out', async () => {
    vi.useFakeTimers();
    const tabs = origin(ANSWER_WAIT_MS * 3);
    const slow = acquireRunLock(tabs.page().locks);
    await vi.advanceTimersByTimeAsync(ANSWER_WAIT_MS);
    expect(await slow).toBe('none');
    expect(tabs.holders()).toBe(0);
    await vi.advanceTimersByTimeAsync(ANSWER_WAIT_MS * 2);
    expect(tabs.holders()).toBe(1);
    const later = acquireRunLock(tabs.page().locks, ANSWER_WAIT_MS * 4);
    await vi.advanceTimersByTimeAsync(ANSWER_WAIT_MS * 3);
    expect(await later).toBe('elsewhere');
  });

  it('the stand-in itself: a request without the never-settling hold would free the lock at once', async () => {
    // The control for "held for the life of the page": a callback that
    // returns leaves the name free, which is what the lock's own callback
    // must not do.
    vi.useFakeTimers();
    const tabs = origin();
    void tabs.page().locks.request(RUN_LOCK_NAME, { ifAvailable: true }, () => undefined);
    await settle();
    expect(tabs.holders()).toBe(0);
  });
});
