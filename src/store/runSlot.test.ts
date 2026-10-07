import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { RunJournal } from '../journal/journal';
import { RUN_SCHEMA_VERSION, Run } from '../run/Run';
import { memoryAdapter, type StorageAdapter } from './adapter';
import type { RunLock } from './runLock';
import { lastRunJournal, openRunSlot, runRejectedMessage, runSlotSection, type RunSlotWire } from './runSlot';
import { createStore, type LenientSection } from './store';

// 113e — the save-rejection rule, on a real snapshot. The slot has no writer
// until save/load, so each case plants its text in the adapter's map.

const RUN_KEY = 'asciibattler:run';
const SETTINGS_KEY = 'asciibattler:settings';
const bus = (): EventBus<GameEvents> => new EventBus<GameEvents>();
const snapshotOf = (seed: number): RunSlotWire['snapshot'] => new Run(seed, bus()).toJSON();
const slotText = (v: number, data: unknown): string => JSON.stringify({ v, build: '0.0.0+aaaaaaa', data });

const SETTINGS: LenientSection<{ volume: number }> = {
  policy: 'lenient',
  name: 'settings',
  version: 1,
  fields: { volume: { schema: z.number(), fallback: 1 } },
};
const settingsText = JSON.stringify({ v: 1, build: '0.0.0+aaaaaaa', data: { volume: 0.25 } });

describe('113e — the run slot', () => {
  it('is stamped with RUN_SCHEMA_VERSION, the save format', () => {
    expect(runSlotSection(bus()).version).toBe(RUN_SCHEMA_VERSION);
    expect(snapshotOf(1).schemaVersion).toBe(RUN_SCHEMA_VERSION);
  });

  it('round-trips a run through the store', () => {
    const adapter = memoryAdapter();
    const store = createStore({ adapter, build: '0.1.0+abc1234' });
    const section = runSlotSection(bus());
    const snapshot = snapshotOf(7);
    expect(store.writeStrict(section, { snapshot, dials: 'hops=3', journal: null })).toBe(true);
    const read = store.readStrict(section);
    expect(read.status).toBe('ok');
    if (read.status !== 'ok') return;
    expect(read.value.run).toBeInstanceOf(Run);
    expect(read.build).toBe('0.1.0+abc1234');
    // The loaded run saves to the same snapshot it was loaded from.
    expect(read.value.run.toJSON()).toEqual(snapshot);
    expect(read.value.wire).toEqual({ snapshot, dials: 'hops=3', journal: null });
    // 115e — the dials reach the loaded run (`hops` makes it a one-sector run).
    expect((read.value.run as unknown as { singleSectorRun: boolean }).singleSectorRun).toBe(true);
  });

  it('rejects a slot saved at the previous format as stale, before fromJSON, and keeps everything else', () => {
    const stale = slotText(RUN_SCHEMA_VERSION - 1, { snapshot: { ...snapshotOf(7), schemaVersion: RUN_SCHEMA_VERSION - 1 } });
    const adapter = memoryAdapter({ [RUN_KEY]: stale, [SETTINGS_KEY]: settingsText });
    const store = createStore({ adapter, build: 'b' });
    let loads = 0;
    const section = { ...runSlotSection(bus()), load: () => (loads++, null as never) };
    const read = store.readStrict(section);
    expect(read).toMatchObject({ status: 'rejected', reason: 'stale', found: RUN_SCHEMA_VERSION - 1, raw: stale });
    expect(loads).toBe(0);
    // The stored text stays (its journal is still exportable), and the settings are untouched.
    expect(adapter.entries.get(RUN_KEY)).toBe(stale);
    expect(adapter.entries.get(SETTINGS_KEY)).toBe(settingsText);
    expect(store.read(SETTINGS)).toEqual({ volume: 0.25 });
  });

  it('rejects a current slot that fromJSON refuses as unreadable', () => {
    const cases: [string, unknown, string][] = [
      ['an unknown character', { snapshot: { ...snapshotOf(7), characterId: 'retired-character' }, dials: '' }, "unknown character id 'retired-character'"],
      ['an unknown daemon', { snapshot: { ...snapshotOf(7), daemonIds: ['retired-daemon'] }, dials: '' }, "unknown daemon id 'retired-daemon'"],
      // A current envelope around an older snapshot: fromJSON's own version check.
      ['an older snapshot inside', { snapshot: { ...snapshotOf(7), schemaVersion: RUN_SCHEMA_VERSION - 1 }, dials: '' }, `unsupported schema version ${RUN_SCHEMA_VERSION - 1}`],
      ['no snapshot at all', { dials: '' }, 'TypeError'],
      ['no dials', { snapshot: snapshotOf(7) }, 'the saved run has no dials'],
    ];
    for (const [name, data, detail] of cases) {
      const text = slotText(RUN_SCHEMA_VERSION, data);
      const adapter = memoryAdapter({ [RUN_KEY]: text, [SETTINGS_KEY]: settingsText });
      const store = createStore({ adapter, build: 'b' });
      const read = store.readStrict(runSlotSection(bus()));
      expect(read, name).toMatchObject({ status: 'rejected', reason: 'unreadable', found: RUN_SCHEMA_VERSION, raw: text });
      if (read.status === 'rejected') expect(read.detail, name).toContain(detail);
      expect(adapter.entries.get(RUN_KEY), name).toBe(text);
      expect(store.read(SETTINGS), name).toEqual({ volume: 0.25 });
    }
  });

  it('has its message for the player', () => {
    expect(runRejectedMessage()).toBe(
      "This run was saved by an older version of the game and can't be continued. Your settings and unlocks are kept.",
    );
  });
});

// 115f — the slot through the two-tab lock. Two stores over one adapter stand
// for two tabs over one `localStorage`.
describe('115f — the run slot through the two-tab lock', () => {
  /** The adapter, counting the reads of the run slot's key. */
  const counting = (inner: StorageAdapter): StorageAdapter & { slotReads(): number } => {
    let reads = 0;
    return {
      kind: inner.kind,
      read: (key) => {
        if (key === RUN_KEY) reads++;
        return inner.read(key);
      },
      write: (key, text) => inner.write(key, text),
      remove: (key) => inner.remove(key),
      slotReads: () => reads,
    };
  };
  const wireOf = (seed: number): RunSlotWire => ({ snapshot: snapshotOf(seed), dials: '', journal: null });

  it('with the lock held, or with no lock on the page, the slot is read, written and emptied', () => {
    for (const lock of ['held', 'none'] satisfies RunLock[]) {
      const adapter = memoryAdapter();
      const slot = openRunSlot(createStore({ adapter, build: 'b' }), bus(), lock);
      expect(slot.lock).toBe(lock);
      expect(slot.read(), lock).toEqual({ status: 'empty' });
      const wire = wireOf(7);
      expect(slot.write(wire), lock).toBe(true);
      expect(JSON.parse(adapter.entries.get(RUN_KEY)!).data, lock).toEqual(wire);
      const read = slot.read();
      expect(read.status, lock).toBe('ok');
      if (read.status === 'ok') expect(read.value.run.toJSON(), lock).toEqual(wire.snapshot);
      expect(slot.clear(), lock).toBe(true);
      expect(adapter.entries.has(RUN_KEY), lock).toBe(false);
    }
  });

  it("a second tab leaves the first tab's save alone: not read, not written over, not emptied", () => {
    const shared = memoryAdapter();
    const first = openRunSlot(createStore({ adapter: shared, build: 'b' }), bus(), 'held');
    expect(first.write(wireOf(7))).toBe(true);
    const saved = shared.entries.get(RUN_KEY)!;

    const adapter = counting(shared);
    const store = createStore({ adapter, build: 'b' });
    const second = openRunSlot(store, bus(), 'elsewhere');
    expect(second.read()).toEqual({ status: 'elsewhere' });
    expect(adapter.slotReads()).toBe(0);
    // The second tab's own run, at a gate and at its end.
    expect(second.write(wireOf(8))).toBe(false);
    expect(shared.entries.get(RUN_KEY)).toBe(saved);
    expect(second.clear()).toBe(false);
    expect(shared.entries.get(RUN_KEY)).toBe(saved);
    // Not a storage failure: the store can still save its other sections.
    expect(store.status()).toMatchObject({ canSave: true, error: null });
    expect(store.patch(SETTINGS, { volume: 0.5 })).toBe(true);

    // The first tab continues its own run, untouched.
    const read = first.read();
    expect(read.status).toBe('ok');
    if (read.status === 'ok') expect(read.value.run.toJSON()).toEqual(snapshotOf(7));
  });

  it('the control: the same calls with the lock held do read, replace and empty the save', () => {
    const shared = memoryAdapter();
    openRunSlot(createStore({ adapter: shared, build: 'b' }), bus(), 'held').write(wireOf(7));
    const saved = shared.entries.get(RUN_KEY)!;
    const adapter = counting(shared);
    const slot = openRunSlot(createStore({ adapter, build: 'b' }), bus(), 'held');
    expect(slot.read().status).toBe('ok');
    expect(adapter.slotReads()).toBe(1);
    expect(slot.write(wireOf(8))).toBe(true);
    expect(shared.entries.get(RUN_KEY)).not.toBe(saved);
    expect(slot.clear()).toBe(true);
    expect(shared.entries.has(RUN_KEY)).toBe(false);
  });

  // 115g — `peek`, what the boot screen asks before it offers Continue.
  /** A bus that counts what subscribes to it. */
  const counted = (): { bus: EventBus<GameEvents>; subscriptions(): number } => {
    const b = bus();
    let n = 0;
    const on = b.on.bind(b);
    b.on = ((event, handler) => {
      n++;
      return on(event, handler);
    }) as typeof b.on;
    return { bus: b, subscriptions: () => n };
  };

  it('peek says whether a run is saved without taking it: nothing is left on the game bus', () => {
    const adapter = memoryAdapter();
    const game = counted();
    const slot = openRunSlot(createStore({ adapter, build: 'b' }), game.bus, 'held');
    expect(slot.peek()).toBe('empty');
    slot.write(wireOf(7));
    const saved = adapter.entries.get(RUN_KEY)!;
    expect(slot.peek()).toBe('saved');
    expect(slot.peek()).toBe('saved');
    expect(game.subscriptions()).toBe(0);
    expect(adapter.entries.get(RUN_KEY)).toBe(saved);
    // The control: a read does load the run onto the game's bus.
    expect(slot.read().status).toBe('ok');
    expect(game.subscriptions()).toBeGreaterThan(0);
  });

  it('peek names a rejected save and leaves its text, and never reads another tab\'s', () => {
    const stale = slotText(RUN_SCHEMA_VERSION - 1, { snapshot: snapshotOf(7), dials: '' });
    const unreadable = slotText(RUN_SCHEMA_VERSION, { snapshot: { ...snapshotOf(7), characterId: 'retired-character' }, dials: '' });
    for (const text of [stale, unreadable]) {
      const adapter = memoryAdapter({ [RUN_KEY]: text });
      const slot = openRunSlot(createStore({ adapter, build: 'b' }), bus(), 'held');
      expect(slot.peek()).toBe('rejected');
      expect(adapter.entries.get(RUN_KEY)).toBe(text);
    }
    const adapter = counting(memoryAdapter({ [RUN_KEY]: stale }));
    expect(openRunSlot(createStore({ adapter, build: 'b' }), bus(), 'elsewhere').peek()).toBe('elsewhere');
    expect(adapter.slotReads()).toBe(0);
  });
});

// 116h — a rejected save's journal is kept when the slot is reused. What the
// finished journals hold is read from the adapter's map.
describe("116h — a rejected save's journal", () => {
  const JOURNALS_KEY = 'asciibattler:journals';
  /** A journal as a save keeps it: its open segment ended `saved`. */
  const journalOf = (seed: number): RunJournal => ({
    format: 2,
    segments: [
      {
        build: '0.0.0+aaaaaaa',
        configHash: 'deadbeef',
        openedAt: seed,
        start: { kind: 'seed', seed, dials: '' },
        entries: [],
        end: { reason: 'saved', ms: 1, hash: '00000000' },
      },
    ],
  });
  const keptIn = (adapter: { entries: Map<string, string> }): unknown =>
    (JSON.parse(adapter.entries.get(JOURNALS_KEY) ?? 'null') as { data: unknown } | null)?.data ?? null;
  const journalsText = (journals: RunJournal[]): string => JSON.stringify({ v: 1, build: 'b', data: journals });
  const wireOf = (seed: number): RunSlotWire => ({ snapshot: snapshotOf(seed), dials: '', journal: journalOf(seed) });

  const stale = (journal: RunJournal | null): string =>
    slotText(RUN_SCHEMA_VERSION - 1, { snapshot: { schemaVersion: RUN_SCHEMA_VERSION - 1 }, dials: '', journal });
  const unreadable = (journal: RunJournal | null): string =>
    slotText(RUN_SCHEMA_VERSION, { snapshot: { ...snapshotOf(7), characterId: 'retired-character' }, dials: '', journal });

  it('is what Export last run hands over while the save sits in the slot, ahead of an older finished run', () => {
    for (const text of [stale(journalOf(7)), unreadable(journalOf(7))]) {
      const adapter = memoryAdapter({ [RUN_KEY]: text, [JOURNALS_KEY]: journalsText([journalOf(1)]) });
      const store = createStore({ adapter, build: 'b' });
      const slot = openRunSlot(store, bus(), 'held');
      expect(slot.rejectedJournal()).toEqual(journalOf(7));
      expect(lastRunJournal(store, slot)).toEqual(journalOf(7));
      // Asking moves nothing.
      expect(adapter.entries.get(RUN_KEY)).toBe(text);
      expect(keptIn(adapter)).toEqual([journalOf(1)]);
    }
  });

  it("joins the finished journals, newest, before a new run's first save replaces the slot", () => {
    for (const text of [stale(journalOf(7)), unreadable(journalOf(7))]) {
      const adapter = memoryAdapter({ [RUN_KEY]: text, [JOURNALS_KEY]: journalsText([journalOf(1)]) });
      const store = createStore({ adapter, build: 'b' });
      const slot = openRunSlot(store, bus(), 'held');
      expect(slot.write(wireOf(8))).toBe(true);
      expect(keptIn(adapter)).toEqual([journalOf(1), journalOf(7)]);
      expect(JSON.parse(adapter.entries.get(RUN_KEY)!).data).toEqual(wireOf(8));
      // The same answer as before the new run took the slot.
      expect(slot.rejectedJournal()).toBeNull();
      expect(lastRunJournal(store, slot)).toEqual(journalOf(7));
      // The new run's later saves keep nothing more.
      expect(slot.write(wireOf(8))).toBe(true);
      expect(keptIn(adapter)).toEqual([journalOf(1), journalOf(7)]);
    }
  });

  it('is kept when the slot is emptied, too', () => {
    const adapter = memoryAdapter({ [RUN_KEY]: stale(journalOf(7)) });
    const slot = openRunSlot(createStore({ adapter, build: 'b' }), bus(), 'held');
    expect(slot.clear()).toBe(true);
    expect(adapter.entries.has(RUN_KEY)).toBe(false);
    expect(keptIn(adapter)).toEqual([journalOf(7)]);
  });

  it('keeps nothing from a rejected slot that holds no journal', () => {
    const texts = [stale(null), unreadable(null), 'not a store envelope', slotText(RUN_SCHEMA_VERSION - 1, 'not a save'), slotText(RUN_SCHEMA_VERSION - 1, { journal: { format: 'x' } })];
    for (const text of texts) {
      const adapter = memoryAdapter({ [RUN_KEY]: text });
      const store = createStore({ adapter, build: 'b' });
      const slot = openRunSlot(store, bus(), 'held');
      expect(slot.peek(), text).toBe('rejected');
      expect(slot.rejectedJournal(), text).toBeNull();
      expect(lastRunJournal(store, slot), text).toBeNull();
      expect(slot.write(wireOf(8)), text).toBe(true);
      expect(adapter.entries.has(JOURNALS_KEY), text).toBe(false);
    }
  });

  it('the control: a save that loads is a run abandoned, and its journal is not kept', () => {
    const adapter = memoryAdapter();
    openRunSlot(createStore({ adapter, build: 'b' }), bus(), 'held').write(wireOf(7));
    expect(JSON.parse(adapter.entries.get(RUN_KEY)!).data.journal).toEqual(journalOf(7));

    const store = createStore({ adapter, build: 'b' });
    const slot = openRunSlot(store, bus(), 'held');
    expect(slot.peek()).toBe('saved');
    expect(slot.rejectedJournal()).toBeNull();
    expect(slot.write(wireOf(8))).toBe(true);
    expect(slot.clear()).toBe(true);
    expect(adapter.entries.has(JOURNALS_KEY)).toBe(false);
    expect(lastRunJournal(store, slot)).toBeNull();
  });

  it('is kept once when the new run could not be saved over it', () => {
    const inner = memoryAdapter({ [RUN_KEY]: stale(journalOf(7)) });
    const refusing = { slot: true };
    const adapter: StorageAdapter = {
      kind: 'memory',
      read: (key) => inner.read(key),
      write: (key, text) => {
        if (refusing.slot && key === RUN_KEY) throw new Error('planted: the slot is refused');
        inner.write(key, text);
      },
      remove: (key) => inner.remove(key),
    };
    // Two gates on one page, then the next page.
    const first = openRunSlot(createStore({ adapter, build: 'b' }), bus(), 'held');
    expect(first.write(wireOf(8))).toBe(false);
    expect(first.write(wireOf(8))).toBe(false);
    expect(inner.entries.get(RUN_KEY)).toBe(stale(journalOf(7)));
    expect(keptIn(inner)).toEqual([journalOf(7)]);

    refusing.slot = false;
    const second = openRunSlot(createStore({ adapter, build: 'b' }), bus(), 'held');
    expect(second.write(wireOf(9))).toBe(true);
    expect(keptIn(inner)).toEqual([journalOf(7)]);
  });

  it("a second tab keeps nothing and never reads the slot; a page that loaded its run doesn't read it again", () => {
    let reads = 0;
    const counted = (inner: StorageAdapter): StorageAdapter => ({
      kind: inner.kind,
      read: (key) => {
        if (key === RUN_KEY) reads++;
        return inner.read(key);
      },
      write: (key, text) => inner.write(key, text),
      remove: (key) => inner.remove(key),
    });
    const shared = memoryAdapter({ [RUN_KEY]: stale(journalOf(7)) });
    const store = createStore({ adapter: counted(shared), build: 'b' });
    const second = openRunSlot(store, bus(), 'elsewhere');
    expect(second.rejectedJournal()).toBeNull();
    expect(lastRunJournal(store, second)).toBeNull();
    expect(second.write(wireOf(8))).toBe(false);
    expect(second.clear()).toBe(false);
    expect(reads).toBe(0);
    expect(shared.entries.has(JOURNALS_KEY)).toBe(false);

    const own = memoryAdapter();
    openRunSlot(createStore({ adapter: own, build: 'b' }), bus(), 'held').write(wireOf(7));
    reads = 0;
    const slot = openRunSlot(createStore({ adapter: counted(own), build: 'b' }), bus(), 'held');
    expect(slot.read().status).toBe('ok');
    expect(reads).toBe(1);
    expect(slot.write(wireOf(7))).toBe(true);
    expect(slot.clear()).toBe(true);
    expect(reads).toBe(1);
  });
});
