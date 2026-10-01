import { describe, expect, it } from 'vitest';
import type { RunJournal } from '../journal/journal';
import { memoryAdapter } from './adapter';
import { JOURNALS_BUDGET, JOURNALS_SECTION, finishedJournals, keepJournal, withinBudget } from './journals';
import { createStore } from './store';

// The finished-journals section over the memory adapter. Stored text is
// planted and read back through `adapter.entries`, never through the module
// under test.

const KEY = 'asciibattler:journals';
const BUILD = '0.1.0+abc1234';

/** A journal whose JSON text is exactly `chars` long, told apart by `seed`. */
function journalOf(seed: number, chars: number): RunJournal {
  const make = (pad: string): RunJournal => ({
    format: 1,
    segments: [
      {
        build: BUILD,
        configHash: 'deadbeef',
        openedAt: 0,
        start: { kind: 'seed', seed, dials: pad },
        entries: [],
        end: { reason: 'defeat', ms: 1, hash: '00000000' },
      },
    ],
  });
  const base = JSON.stringify(make('')).length;
  if (chars < base) throw new Error(`a journal is at least ${base} characters`);
  const journal = make('x'.repeat(chars - base));
  expect(JSON.stringify(journal)).toHaveLength(chars);
  return journal;
}
const seedsOf = (journals: readonly RunJournal[]): number[] =>
  journals.map((j) => (j.segments[0]!.start.kind === 'seed' ? j.segments[0]!.start.seed : -1));

function setup(initial: Record<string, string> = {}) {
  const adapter = memoryAdapter(initial);
  const store = createStore({ adapter, build: BUILD });
  const storedData = (): unknown => (JSON.parse(adapter.entries.get(KEY) ?? 'null') as { data: unknown } | null)?.data;
  return { adapter, store, storedData };
}

describe('withinBudget', () => {
  const list = [journalOf(1, 300), journalOf(2, 300), journalOf(3, 300), journalOf(4, 300)];

  it('keeps everything that fits, in order', () => {
    expect(seedsOf(withinBudget(list, 5000))).toEqual([1, 2, 3, 4]);
  });

  it('drops the oldest first, and what it keeps fits the budget as stored text', () => {
    // Three journals are 2 + 300 × 3 + 2 commas = 904 characters.
    expect(seedsOf(withinBudget(list, 904))).toEqual([2, 3, 4]);
    expect(JSON.stringify(withinBudget(list, 904))).toHaveLength(904);
    expect(seedsOf(withinBudget(list, 903))).toEqual([3, 4]);
  });

  it('does not keep a journal that alone exceeds the budget, nor anything older', () => {
    expect(withinBudget(list, 301)).toEqual([]);
    expect(seedsOf(withinBudget([journalOf(1, 300), journalOf(2, 900), journalOf(3, 300)], 700))).toEqual([3]);
  });

  it('defaults to the section’s budget', () => {
    expect(JOURNALS_BUDGET).toBe(1_000_000);
    expect(withinBudget([journalOf(1, 999_998)])).toHaveLength(1);
    expect(withinBudget([journalOf(1, 999_999)])).toHaveLength(0);
  });
});

describe('keepJournal', () => {
  it('stores a finished journal in the section’s envelope, newest last', () => {
    const { store, adapter, storedData } = setup();
    expect(finishedJournals(store)).toEqual([]);
    expect(keepJournal(store, journalOf(1, 300))).toBe(true);
    expect(keepJournal(store, journalOf(2, 300))).toBe(true);

    const envelope = JSON.parse(adapter.entries.get(KEY)!) as { v: number; build: string };
    expect(envelope.v).toBe(JOURNALS_SECTION.version);
    expect(envelope.build).toBe(BUILD);
    expect(seedsOf(storedData() as RunJournal[])).toEqual([1, 2]);
    expect(seedsOf(finishedJournals(store))).toEqual([1, 2]);
  });

  it('a planted section over the cap loses its oldest when the next run ends', () => {
    const planted = [journalOf(1, 400), journalOf(2, 400), journalOf(3, 400)];
    const { store, storedData } = setup({ [KEY]: JSON.stringify({ v: 1, build: BUILD, data: planted }) });
    expect(seedsOf(finishedJournals(store))).toEqual([1, 2, 3]);
    // Room for three of these and no more: 2 + 400 × 3 + 2 = 1204.
    expect(keepJournal(store, journalOf(4, 400), 1204)).toBe(true);
    expect(seedsOf(storedData() as RunJournal[])).toEqual([2, 3, 4]);
    expect(JSON.stringify(storedData()).length).toBeLessThanOrEqual(1204);
  });

  it('starts the list over when the stored section is another version or not a list of journals', () => {
    for (const text of [
      JSON.stringify({ v: 2, build: BUILD, data: [journalOf(1, 300)] }),
      JSON.stringify({ v: 1, build: BUILD, data: { not: 'a list' } }),
      JSON.stringify({ v: 1, build: BUILD, data: [{ format: 1 }] }),
      'not json',
    ]) {
      const { store, storedData } = setup({ [KEY]: text });
      expect(finishedJournals(store)).toEqual([]);
      expect(keepJournal(store, journalOf(9, 300))).toBe(true);
      expect(seedsOf(storedData() as RunJournal[])).toEqual([9]);
    }
  });

  it('on a store that can’t save it returns false, writes nothing and doesn’t throw', () => {
    const adapter = memoryAdapter();
    const store = createStore({ adapter, build: BUILD, unsaved: 'SecurityError: planted' });
    expect(keepJournal(store, journalOf(1, 300))).toBe(false);
    expect(adapter.entries.has(KEY)).toBe(false);
    expect(finishedJournals(store)).toEqual([]);
  });
});
