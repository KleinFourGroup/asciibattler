/**
 * FINISHED JOURNALS: the store's section for the journals of runs that have
 * ended (Round 8 spec D3, D4), oldest first. A run whose save was rejected
 * ended there, and its journal joins these when the slot is reused
 * (runSlot.ts, 116h).
 *
 * KEPT BY SIZE, not by count, since runs differ severalfold in length: the
 * newest journals whose JSON text together fits `JOURNALS_BUDGET` are kept,
 * and the oldest are dropped first. A journal that alone exceeds the budget
 * is not kept. The budget is characters of JSON, which is what
 * `localStorage` counts.
 *
 * Strict, like the run slot: a section written at another version, or one
 * that doesn't hold a list of journals, is rejected by the read. The next
 * finished run then starts the list over, since these are records to send
 * in, not progress to protect.
 *
 * Game-layer only, and never imported by the store's boot module
 * (tests/store-boot.test.ts): this one knows the journal's shape.
 */

import type { RunJournal } from '../journal/journal';
import type { Store, StrictSection } from './store';

/** About 1 MB of text: some sixty runs at the 15 KB a run of the shipped
 *  length was measured at. The number is soft until a played run's size and
 *  Firefox's storage limit are measured. */
export const JOURNALS_BUDGET = 1_000_000;

export function isJournal(value: unknown): value is RunJournal {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RunJournal).format === 'number' &&
    Array.isArray((value as RunJournal).segments)
  );
}

export const JOURNALS_SECTION: StrictSection<readonly RunJournal[], readonly RunJournal[]> = {
  policy: 'strict',
  name: 'journals',
  version: 1,
  load: (wire) => {
    if (!Array.isArray(wire) || !wire.every(isJournal)) throw new Error('not a list of run journals');
    return wire;
  },
};

/** The newest of `journals` (oldest first) whose JSON text fits `budget`. */
export function withinBudget(journals: readonly RunJournal[], budget: number = JOURNALS_BUDGET): RunJournal[] {
  const kept: RunJournal[] = [];
  // `[` and `]`, then each journal's text and the comma before it.
  let size = 2;
  for (let i = journals.length - 1; i >= 0; i--) {
    const cost = JSON.stringify(journals[i]).length + (kept.length > 0 ? 1 : 0);
    if (size + cost > budget) break;
    size += cost;
    kept.unshift(journals[i]!);
  }
  return kept;
}

/** The finished journals the store holds, oldest first; none when the
 *  section is empty, rejected, or can't be read. */
export function finishedJournals(store: Store): readonly RunJournal[] {
  const read = store.readStrict(JOURNALS_SECTION);
  return read.status === 'ok' ? read.value : [];
}

/** Add a finished run's journal as the newest and drop the oldest past the
 *  budget. False when it couldn't be saved; it never throws. */
export function keepJournal(store: Store, journal: RunJournal, budget: number = JOURNALS_BUDGET): boolean {
  return store.writeStrict(JOURNALS_SECTION, withinBudget([...finishedJournals(store), journal], budget));
}
