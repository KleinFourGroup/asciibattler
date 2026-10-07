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
 *
 * A REJECTED SAVE'S JOURNAL IS KEPT (116h). The slot is one, so the next
 * run's first save goes over a rejected one. Before it does, `openRunSlot`
 * moves that save's journal to the finished journals (journals.ts), where
 * "Export last run" finds it; until then the same row reads it out of the
 * slot (`lastRunJournal`). A save's copy of a journal ends `saved`
 * (src/journal/journal.ts), which is where that run stopped.
 *
 * This module imports the run model, so the store's boot module must never
 * import it (tests/store-boot.test.ts).
 */

import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { t } from '../i18n/ui';
import type { RunJournal } from '../journal/journal';
import { RUN_SCHEMA_VERSION, Run, type RunSnapshot } from '../run/Run';
import { parseRunConfig } from '../run/RunConfig';
import { finishedJournals, isJournal, keepJournal } from './journals';
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
  /** The journal of a save that is rejected; null when the slot holds no
   *  rejected save, when that save kept no journal, and in a second tab. */
  rejectedJournal(): RunJournal | null;
  /** Replace the save. False when it wasn't saved: the store refused it, or
   *  the run is open in another tab. A rejected save's journal is kept first. */
  write(wire: RunSlotWire): boolean;
  /** Empty the slot. False when it wasn't emptied, for the same two reasons.
   *  A rejected save's journal is kept first. */
  clear(): boolean;
}

/** The journal in a slot's stored text; null when the text isn't a save's or
 *  the save kept none. Read without the section's loader, which is what
 *  rejected the text. */
function journalIn(raw: string): RunJournal | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const journal = (parsed as { data?: { journal?: unknown } } | null)?.data?.journal;
  return isJournal(journal) ? journal : null;
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
  /** The slot as it reads now, with a run that loaded let go. */
  const look = (): StrictRead<SavedRun> => {
    const read = store.readStrict(runSlotSection(new EventBus<GameEvents>()));
    if (read.status === 'ok') read.value.run.dispose();
    return read;
  };
  const rejectedJournal = (): RunJournal | null => {
    if (!ours) return null;
    const read = look();
    return read.status === 'rejected' ? journalIn(read.raw) : null;
  };
  /** Whether the slot's text is this page's own: it loaded it, wrote it or
   *  emptied it. Until then the text may be a rejected save. */
  let own = false;
  /** Before the slot's text is replaced or removed: a rejected save's
   *  journal joins the finished journals, once. If it can't be stored there
   *  the new run is saved all the same. */
  const keepRejected = (): void => {
    if (own) return;
    const journal = rejectedJournal();
    if (journal === null) return;
    const text = JSON.stringify(journal);
    // Kept already, by a page whose own save then failed.
    if (finishedJournals(store).some((kept) => JSON.stringify(kept) === text)) return;
    keepJournal(store, journal);
  };
  return {
    lock,
    peek() {
      if (!ours) return 'elsewhere';
      const read = look();
      return read.status === 'ok' ? 'saved' : read.status;
    },
    read() {
      if (!ours) return { status: 'elsewhere' };
      const read = store.readStrict(section);
      if (read.status === 'ok') own = true;
      return read;
    },
    rejectedJournal,
    write(wire) {
      if (!ours) return false;
      keepRejected();
      const saved = store.writeStrict(section, wire);
      own ||= saved;
      return saved;
    },
    clear() {
      if (!ours) return false;
      keepRejected();
      const emptied = store.clear(section);
      own ||= emptied;
      return emptied;
    },
  };
}

/**
 * The journal "Export last run" hands over (Round 8 spec D2, D5): the
 * newest finished run's, or, while the slot holds a rejected save, that
 * save's, since it is the later run and its journal stays exportable. Once a
 * new run has taken the slot, the rejected save's journal is the newest
 * finished one, so the answer is the same either side of it.
 */
export function lastRunJournal(store: Store, slot: RunSlot): RunJournal | null {
  return slot.rejectedJournal() ?? finishedJournals(store).at(-1) ?? null;
}

/** What the player is told when their saved run is rejected. */
export function runRejectedMessage(): string {
  return t('save.rejected');
}
