import { describe, expect, it } from 'vitest';
import {
  TALLY_EDGES_MS,
  WriteTally,
  censusOf,
  findLimit,
  textFrom,
  timeWrites,
  timerResolution,
  type StorageLike,
} from './measure';

// 116l — the diagnostics' measurements, each held to an answer planted here:
// a storage with a quota this file sets, a clock that steps as this file says.

/** A storage that refuses a write once keys and values together would pass
 *  `quota` characters, as a browser's does. */
function plantedStorage(quota: number, initial: Record<string, string> = {}): StorageLike & { writes: string[] } {
  const items = new Map<string, string>(Object.entries(initial));
  const used = (): number => [...items].reduce((sum, [k, v]) => sum + k.length + v.length, 0);
  const writes: string[] = [];
  return {
    writes,
    get length() {
      return items.size;
    },
    key: (i) => [...items.keys()][i] ?? null,
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => {
      const after = used() - (items.has(k) ? k.length + items.get(k)!.length : 0) + k.length + v.length;
      if (after > quota) throw Object.assign(new Error('planted quota'), { name: 'QuotaExceededError' });
      items.set(k, v);
      writes.push(v);
    },
    removeItem: (k) => {
      items.delete(k);
    },
  };
}

const FILL = 'asciibattler:diag-fill';

describe('findLimit', () => {
  it('brackets a planted quota within its step, and leaves the storage as it was', () => {
    const initial = { 'asciibattler:run': 'r'.repeat(40_000), 'another-game': 'g'.repeat(123_456) };
    const inUse = 'asciibattler:run'.length + 40_000 + 'another-game'.length + 123_456;
    for (const quota of [5_242_880, 5_000_000, 1_048_577]) {
      const storage = plantedStorage(quota, initial);
      const result = findLimit(storage, FILL, { ceiling: 64 * 1024 * 1024, step: 1024 });
      // The room one more key has: the quota less what is stored and the key's own name.
      const room = quota - inUse - FILL.length;
      expect(result.inUse).toBe(inUse);
      expect(result.lastOk).toBeLessThanOrEqual(room);
      expect(result.firstFail).not.toBeNull();
      expect(result.firstFail!).toBeGreaterThan(room);
      expect(result.firstFail! - result.lastOk).toBeLessThanOrEqual(1024);
      expect(result.hitCeiling).toBe(false);
      expect(result.error).toBe('QuotaExceededError: planted quota');
      expect(result.cleaned).toBe(true);
      expect(storage.getItem(FILL)).toBeNull();
      expect(storage.getItem('asciibattler:run')).toBe(initial['asciibattler:run']);
      expect(storage.getItem('another-game')).toBe(initial['another-game']);
    }
  });

  it('reports the ceiling, not a limit, when nothing is refused', () => {
    const storage = plantedStorage(Number.MAX_SAFE_INTEGER);
    const result = findLimit(storage, FILL, { ceiling: 100_000, step: 1024 });
    expect(result.hitCeiling).toBe(true);
    expect(result.firstFail).toBeNull();
    expect(result.error).toBeNull();
    // 1024 doubled while it stays at or under the ceiling: 65,536.
    expect(result.lastOk).toBe(65_536);
    expect(result.cleaned).toBe(true);
  });

  it('reads a storage with no room as no room', () => {
    const storage = plantedStorage(500, { other: 'x'.repeat(400) });
    const result = findLimit(storage, FILL, { ceiling: 1_000_000, step: 1024 });
    expect(result.lastOk).toBe(0);
    expect(result.firstFail).toBe(1024);
    expect(result.hitCeiling).toBe(false);
    expect(storage.getItem('other')).toHaveLength(400);
  });

  it('removes a fill key left by a run that was cut off, and does not count it', () => {
    const storage = plantedStorage(10_000, { [FILL]: 'x'.repeat(9_000), other: 'abc' });
    const result = findLimit(storage, FILL, { ceiling: 1_000_000, step: 64 });
    expect(result.inUse).toBe('other'.length + 3);
    expect(result.lastOk).toBeGreaterThan(9_000);
    expect(result.cleaned).toBe(true);
  });

  it('throws, and reports no limit, when the fill key cannot be removed first', () => {
    const inner = plantedStorage(10_000);
    const stuck: StorageLike = {
      get length() {
        return inner.length;
      },
      key: (i) => inner.key(i),
      getItem: (k) => inner.getItem(k),
      setItem: (k, v) => inner.setItem(k, v),
      removeItem: () => {
        throw new Error('planted');
      },
    };
    // The first removal throws before any write, so nothing was measured,
    // and the answer must not read as a limit.
    expect(() => findLimit(stuck, FILL, { ceiling: 1_000, step: 64 })).toThrow('planted');
  });

  it('fills with the unit it is given', () => {
    const storage = plantedStorage(4_096);
    const unit = String.fromCharCode(0x44f);
    findLimit(storage, FILL, { ceiling: 100_000, step: 64, unit });
    expect(storage.writes.every((text) => text === unit.repeat(text.length))).toBe(true);
  });
});

describe('censusOf', () => {
  it('counts the game’s keys apart from the rest, keys and values both', () => {
    const storage = plantedStorage(1_000_000, {
      'asciibattler:settings': '12345',
      'asciibattler:meta': '12',
      unityGraphicsQuality: '3',
      [`a-very-long-key-${'k'.repeat(80)}`]: 'v',
    });
    const census = censusOf(storage, 'asciibattler:');
    expect(census.ours).toEqual([
      { key: 'asciibattler:meta', chars: 'asciibattler:meta'.length + 2 },
      { key: 'asciibattler:settings', chars: 'asciibattler:settings'.length + 5 },
    ]);
    expect(census.oursChars).toBe('asciibattler:meta'.length + 2 + 'asciibattler:settings'.length + 5);
    expect(census.others).toBe(2);
    expect(census.othersChars).toBe('unityGraphicsQuality'.length + 1 + 16 + 80 + 1);
    expect(census.othersSample[0]).toBe('unityGraphicsQuality');
    expect(census.othersSample[1]).toHaveLength(48);
  });

  it('reads an empty storage as empty', () => {
    expect(censusOf(plantedStorage(10), 'asciibattler:')).toEqual({
      ours: [],
      oursChars: 0,
      others: 0,
      othersChars: 0,
      othersSample: [],
    });
  });
});

describe('timeWrites', () => {
  /** A clock that moves one unit at every reading. */
  const counter = (): (() => number) => {
    let n = 0;
    return () => n++;
  };

  it('times each row by the clock it is given, and removes its key', () => {
    const storage = plantedStorage(1_000_000);
    const rows = timeWrites(
      storage,
      'asciibattler:diag-bench',
      [
        { chars: 100, reps: 4 },
        { chars: 1_000, reps: 10 },
      ],
      (chars, variant) => textFrom('{"a":1}', chars, variant),
      counter(),
    );
    // One reading opens the row, two bracket each write, one closes it:
    // 2 × reps + 1 units in all, and 1 unit a write.
    expect(rows).toEqual([
      { chars: 100, reps: 4, done: 4, totalMs: 9, meanMs: 9 / 4, maxMs: 1, error: null },
      { chars: 1_000, reps: 10, done: 10, totalMs: 21, meanMs: 21 / 10, maxMs: 1, error: null },
    ]);
    expect(storage.getItem('asciibattler:diag-bench')).toBeNull();
    // No write repeats the one before it.
    for (let i = 1; i < storage.writes.length; i++) expect(storage.writes[i]).not.toBe(storage.writes[i - 1]);
    expect(storage.writes.slice(0, 4).every((text) => text.length === 100)).toBe(true);
  });

  it('stops a row at the write that is refused, says why, and goes on', () => {
    const storage = plantedStorage(600);
    const rows = timeWrites(
      storage,
      'k',
      [
        { chars: 100, reps: 3 },
        { chars: 5_000, reps: 3 },
        { chars: 200, reps: 2 },
      ],
      (chars, variant) => textFrom('ab', chars, variant),
      counter(),
    );
    expect(rows.map((r) => [r.chars, r.done, r.error])).toEqual([
      [100, 3, null],
      [5_000, 0, 'QuotaExceededError: planted quota'],
      [200, 2, null],
    ]);
    expect(rows[1]!.meanMs).toBe(0);
    expect(storage.getItem('k')).toBeNull();
  });
});

describe('textFrom', () => {
  it('gives exactly the length asked for, and two variants that differ', () => {
    for (const chars of [1, 7, 4_096, 65_537]) {
      const a = textFrom('{"snapshot":{"v":47}}', chars, 0);
      const b = textFrom('{"snapshot":{"v":47}}', chars, 1);
      expect(a).toHaveLength(chars);
      expect(b).toHaveLength(chars);
      expect(a).not.toBe(b);
    }
    expect(textFrom('abc', 0, 0)).toBe('');
    expect(textFrom('', 5, 1)).toHaveLength(5);
  });
});

describe('timerResolution', () => {
  it('finds a planted step', () => {
    // The clock moves 5 at every third reading.
    let reads = 0;
    expect(timerResolution(() => Math.floor(reads++ / 3) * 5)).toBe(5);
  });

  it('takes the smallest step it sees', () => {
    const steps = [0, 4, 4, 5, 9, 9, 9, 10];
    let i = 0;
    expect(timerResolution(() => steps[Math.min(i++, steps.length - 1)]!, 3, 50)).toBe(1);
  });

  it('reads a clock that never moves as 0', () => {
    expect(timerResolution(() => 7, 3, 100)).toBe(0);
  });
});

describe('WriteTally', () => {
  it('counts each write under its section and its duration', () => {
    const tally = WriteTally.from(null, '2026-10-07T00:00:00.000Z');
    tally.countLoad();
    tally.record('run', 0.5, true, 30_000);
    tally.record('run', 1, true, 31_000);
    tally.record('run', 16, true, 29_000);
    tally.record('run', 40, false, 50_000);
    tally.record('settings', 0, true, 200);
    const json = tally.toJSON();
    expect(json.since).toBe('2026-10-07T00:00:00.000Z');
    expect(json.loads).toBe(1);
    expect(Object.keys(json.sections)).toEqual(['run', 'settings']);
    const run = json.sections['run']!;
    expect(run).toMatchObject({ n: 4, refused: 1, totalMs: 57.5, maxMs: 40, lastChars: 50_000, maxChars: 50_000 });
    // Under 1, under 2, ..., under 33, then the rest.
    expect(TALLY_EDGES_MS).toEqual([1, 2, 4, 8, 16, 33]);
    expect(run.buckets).toEqual([1, 1, 0, 0, 0, 1, 1]);
    expect(run.buckets.reduce((a, b) => a + b, 0)).toBe(run.n);
  });

  it('carries on from its own text across a page load', () => {
    const first = WriteTally.from(null, 'then');
    first.countLoad();
    first.record('run', 3, true, 10);
    const second = WriteTally.from(JSON.stringify(first), 'now');
    second.countLoad();
    second.record('run', 5, true, 20);
    const json = second.toJSON();
    expect(json.since).toBe('then');
    expect(json.loads).toBe(2);
    expect(json.sections['run']).toMatchObject({ n: 2, totalMs: 8, maxMs: 5, lastChars: 20, maxChars: 20 });
  });

  it('begins again from text that is not a tally, and drops a section that is not one', () => {
    for (const text of ['', 'null', '[]', '{"since":1}', 'not json']) {
      expect(WriteTally.from(text, 'now').toJSON()).toEqual({ since: 'now', loads: 0, sections: {} });
    }
    const odd = JSON.stringify({
      since: 'then',
      loads: 3,
      sections: {
        run: { n: 1, refused: 0, totalMs: 1, maxMs: 1, lastChars: 1, maxChars: 1, buckets: [1] },
        settings: { n: 1, refused: 0, totalMs: 2, maxMs: 2, lastChars: 9, maxChars: 9, buckets: [0, 0, 1, 0, 0, 0, 0] },
      },
    });
    const json = WriteTally.from(odd, 'now').toJSON();
    expect(json.loads).toBe(3);
    expect(Object.keys(json.sections)).toEqual(['settings']);
  });
});
