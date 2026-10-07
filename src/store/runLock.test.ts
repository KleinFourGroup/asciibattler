import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANSWER_WAIT_MS,
  CONTROL_PREFIX,
  RUN_LOCK_NAME,
  acquireRunLock,
  controlName,
  type LockManagerLike,
} from './runLock';

// 115f — the two-tab lock, over a stand-in for the browser's lock manager.
//
// The stand-in keeps the rules of the real one that the lock rests on: a name
// has one holder, held until the promise its callback returned settles or its
// page goes, and a request made with `ifAvailable` is answered with null when
// the name is taken, in a later task, never inside `request`. What it can't
// say is whether a real browser keeps them (the pane and Electron are
// measured in the WORKLOG, §115f; itch's frame in Firefox at §116l).
//
// Every page also has a `query()` that is refused with a SecurityError and
// counted. Firefox refuses it so in a partitioned third-party frame, and the
// lock must never ask (116l; gotcha #140).

interface Page {
  readonly locks: LockManagerLike;
  /** The tab closes: everything it held is free. */
  close(): void;
}

interface Origin {
  page(): Page;
  holders(): number;
  /** Every name the pages have asked for, in order. */
  asked(): readonly string[];
  /** How many times any page asked `query()`. */
  queries(): number;
  /** Runs once, after the next refusal of the run lock and before the tab's
   *  next request. */
  afterRefusal: (() => void) | null;
}

/** The pages of one origin, sharing its locks. `answerAfterMs` delays every answer. */
function origin(answerAfterMs = 0): Origin {
  const held = new Map<string, object>();
  const asked: string[] = [];
  let queries = 0;
  const tabs: Origin = {
    holders: () => held.size,
    asked: () => asked,
    queries: () => queries,
    afterRefusal: null,
    page() {
      const self = {};
      const locks: LockManagerLike & { query(): Promise<never> } = {
        async request(name, _options, callback) {
          asked.push(name);
          await new Promise((r) => setTimeout(r, answerAfterMs));
          if (held.has(name)) {
            const answer = callback(null);
            if (name === RUN_LOCK_NAME) {
              tabs.afterRefusal?.();
              tabs.afterRefusal = null;
            }
            return answer;
          }
          held.set(name, self);
          try {
            return await callback({ name });
          } finally {
            if (held.get(name) === self) held.delete(name);
          }
        },
        query() {
          queries++;
          return Promise.reject(new DOMException('query() is not allowed in this context', 'SecurityError'));
        },
      };
      return {
        locks,
        close() {
          for (const [name, page] of held) if (page === self) held.delete(name);
        },
      };
    },
  };
  return tabs;
}

/** A lock manager that refuses every request, a free name included: what a
 *  second instance of the Electron shell on one profile was measured to have. */
function refusesEverything(): LockManagerLike & { asked(): readonly string[] } {
  const asked: string[] = [];
  return {
    asked: () => asked,
    async request(name, _options, callback) {
      asked.push(name);
      await Promise.resolve();
      return callback(null);
    },
  };
}

/** Let every pending answer arrive (fake timers): a second tab's verdict is
 *  three requests, one after another. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) await vi.advanceTimersByTimeAsync(1);
};

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
    // The first tab asks once. The second asks for the run lock, for a
    // control, and for the run lock again; an answered request leaves no
    // timer behind.
    const names = tabs.asked();
    expect(names).toHaveLength(4);
    expect([names[0], names[1], names[3]]).toEqual([RUN_LOCK_NAME, RUN_LOCK_NAME, RUN_LOCK_NAME]);
    expect(names[2]!.startsWith(CONTROL_PREFIX)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    // The control was let go at once: only the run lock is held.
    expect(tabs.holders()).toBe(1);
  });

  it('116l — never asks query(), which Firefox refuses in a partitioned frame (itch)', async () => {
    // The failure at the itch sitting: the second tab's refusal was real, the
    // lock asked query() who held the name, the frame refused the question,
    // and the tab read `none` and saved over the first tab's run.
    vi.useFakeTimers();
    const tabs = origin();
    const first = acquireRunLock(tabs.page().locks);
    await settle();
    const second = acquireRunLock(tabs.page().locks);
    await settle();
    expect([await first, await second]).toEqual(['held', 'elsewhere']);
    expect(tabs.queries()).toBe(0);
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
    expect(await acquireRunLock(undefined)).toBe('none');
    expect(await acquireRunLock({} as LockManagerLike)).toBe('none');
    const throws: LockManagerLike = {
      request() {
        throw new DOMException('refused', 'SecurityError');
      },
    };
    expect(await acquireRunLock(throws)).toBe('none');
    const rejects: LockManagerLike = { request: () => Promise.reject(new DOMException('refused', 'SecurityError')) };
    expect(await acquireRunLock(rejects)).toBe('none');
  });

  it('a manager that refuses the control too is not a second tab', async () => {
    const broken = refusesEverything();
    expect(await acquireRunLock(broken)).toBe('none');
    // The run lock, then the control; nothing after a refused control.
    expect(broken.asked()).toHaveLength(2);
    expect(broken.asked()[0]).toBe(RUN_LOCK_NAME);
    expect(broken.asked()[1]!.startsWith(CONTROL_PREFIX)).toBe(true);
  });

  it('a control that throws or rejects is no lock either', async () => {
    const afterRefusal = (second: LockManagerLike['request']): LockManagerLike => {
      let calls = 0;
      return {
        request(name, options, callback) {
          if (calls++ === 0) return Promise.resolve().then(() => callback(null));
          return second(name, options, callback);
        },
      };
    };
    const rejecting = afterRefusal(() => Promise.reject(new DOMException('refused', 'SecurityError')));
    expect(await acquireRunLock(rejecting)).toBe('none');
    const throwing = afterRefusal(() => {
      throw new DOMException('refused', 'SecurityError');
    });
    expect(await acquireRunLock(throwing)).toBe('none');
  });

  it('a control whose name is taken reads as a broken manager, which is why the name is its own', async () => {
    // The plant: a control asked under the run lock's own name is refused by
    // a manager that works, and the second tab would save as if alone.
    vi.useFakeTimers();
    const tabs = origin();
    const first = acquireRunLock(tabs.page().locks);
    await settle();
    expect(await first).toBe('held');
    const second = acquireRunLock(tabs.page().locks, ANSWER_WAIT_MS, () => RUN_LOCK_NAME);
    await settle();
    expect(await second).toBe('none');
    // The names the lock makes for itself differ from the run lock's and
    // from each other.
    const a = controlName();
    const b = controlName();
    expect(a.startsWith(CONTROL_PREFIX)).toBe(true);
    expect(a).not.toBe(RUN_LOCK_NAME);
    expect(a).not.toBe(b);
  });

  it('the holder goes between the refusal and the second ask: the tab takes the free lock', async () => {
    vi.useFakeTimers();
    const tabs = origin();
    const firstPage = tabs.page();
    const first = acquireRunLock(firstPage.locks);
    await settle();
    expect(await first).toBe('held');
    tabs.afterRefusal = () => firstPage.close();
    const second = acquireRunLock(tabs.page().locks);
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
    const silent: LockManagerLike = { request: () => new Promise(() => {}) };
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
    // The later tab's three answers take three waits each.
    const later = acquireRunLock(tabs.page().locks, ANSWER_WAIT_MS * 10);
    await vi.advanceTimersByTimeAsync(ANSWER_WAIT_MS * 9);
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
