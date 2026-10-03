/**
 * THE RUN SLOT: the store's strict section for the one saved run, and the
 * rule for when a save is refused (Round 8 spec D2, D3).
 *
 * A save is rejected when its format changed or when loading it fails, not
 * on every build, so a hotfix upload keeps the runs in progress. The format
 * is `RUN_SCHEMA_VERSION`, and the slot is stamped with it: a slot at any
 * other version is `rejected: stale` before `Run.fromJSON` sees it, and one
 * `fromJSON` throws on (an unknown daemon, character or boss id; damaged
 * data) is `rejected: unreadable`. Either way the stored text stays in
 * place, since a rejected run's journal stays exportable, and the lenient
 * sections beside it are untouched: the player keeps their settings and
 * unlocks.
 *
 * `Game` writes the slot at every gate and empties it at a run's end (115e),
 * through `openRunSlot`, which is where the two-tab lock holds (115f): in a
 * second tab the slot is neither read, written nor emptied.
 * This module imports the run model, so the store's boot module must never
 * import it (tests/store-boot.test.ts).
 */

import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { t } from '../i18n/ui';
import type { RunJournal } from '../journal/journal';
import { RUN_SCHEMA_VERSION, Run, type RunSnapshot } from '../run/Run';
import { parseRunConfig } from '../run/RunConfig';
import type { RunLock } from './runLock';
import type { Store, StrictRead, StrictSection } from './store';

/** What the slot stores (Round 8 spec D1, D3). */
export interface RunSlotWire {
  readonly snapshot: RunSnapshot;
  /** The run's dials as URL query text, as its journal's seed start holds
   *  them: the snapshot doesn't carry them, and `Run.fromJSON` takes them. */
  readonly dials: string;
  /** The run's journal as the save keeps it (`JournalRecorder.saved`); null
   *  when the page wasn't recording one. */
  readonly journal: RunJournal | null;
}

/** A read of the slot: the loaded Run and what it was loaded from. */
export interface SavedRun {
  readonly run: Run;
  readonly wire: RunSlotWire;
}

/**
 * The slot's section. A loaded run subscribes to `bus`, as `Run.fromJSON`
 * does, so the caller owns it from the read on: a read made only to ask
 * whether a run is saved disposes it, or reads on a bus of its own.
 */
export function runSlotSection(bus: EventBus<GameEvents>): StrictSection<RunSlotWire, SavedRun> {
  return {
    policy: 'strict',
    name: 'run',
    version: RUN_SCHEMA_VERSION,
    load: (wire) => {
      if (typeof wire.dials !== 'string') throw new Error('the saved run has no dials');
      const run = Run.fromJSON(wire.snapshot, bus, parseRunConfig(new URLSearchParams(wire.dials)));
      return { run, wire: { snapshot: wire.snapshot, dials: wire.dials, journal: wire.journal ?? null } };
    },
  };
}

/** A read of the slot through the lock. `elsewhere`: the run is open in
 *  another tab, and the slot was not read. */
export type RunSlotRead = StrictRead<SavedRun> | { readonly status: 'elsewhere' };

/** What a tab can say of the save before continuing it: nothing saved, a
 *  run that loads, one that is rejected, or a slot that is another tab's. */
export type RunSlotState = 'empty' | 'saved' | 'rejected' | 'elsewhere';

/** The run slot as one tab may use it. */
export interface RunSlot {
  /** This tab's side of the two-tab lock (runLock.ts). */
  readonly lock: RunLock;
  /** Whether there is a run to continue, asked without taking it: the save
   *  is loaded on a bus of its own and let go, so nothing is left listening
   *  on the game's. `saved` means `read()` would load it now. */
  peek(): RunSlotState;
  /** The saved run, loaded on the slot's bus; the caller owns it. */
  read(): RunSlotRead;
  /** Replace the save. False when it wasn't saved: the store refused it, or
   *  the run is open in another tab. */
  write(wire: RunSlotWire): boolean;
  /** Empty the slot. False when it wasn't emptied, for the same two reasons. */
  clear(): boolean;
}

/**
 * THE SLOT'S ONE DOOR. Every read, write and clear of the run slot goes
 * through here, so the two-tab lock holds in one place: when the lock is
 * another tab's (`elsewhere`), the slot is that tab's, and this one neither
 * loads the save, writes over it, nor empties it. With the lock held, or
 * with no lock on the page, the slot is the store's strict section.
 */
export function openRunSlot(store: Store, bus: EventBus<GameEvents>, lock: RunLock): RunSlot {
  const section = runSlotSection(bus);
  const ours = lock !== 'elsewhere';
  return {
    lock,
    peek() {
      if (!ours) return 'elsewhere';
      const read = store.readStrict(runSlotSection(new EventBus<GameEvents>()));
      if (read.status !== 'ok') return read.status;
      read.value.run.dispose();
      return 'saved';
    },
    read: () => (ours ? store.readStrict(section) : { status: 'elsewhere' }),
    write: (wire) => ours && store.writeStrict(section, wire),
    clear: () => ours && store.clear(section),
  };
}

/** What the player is told when their saved run is rejected. */
export function runRejectedMessage(): string {
  return t('save.rejected');
}
