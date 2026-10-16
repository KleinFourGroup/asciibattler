/**
 * The wave-list grammar, and the sequencer that walks it one wave a turn.
 *
 * An encounter's `waves` is a tree of entries, not a flat list. The
 * encounter's health pool decides when the fight ends, not the list, so the
 * sequencer yields a wave for every turn, from a `forever` loop or by
 * repeating the last wave (below).
 *
 * The grammar (`WaveEntry`), each entry one of:
 * - `wave` — field this `WaveSpec` this turn.
 * - `pick` — weighted options; one is rolled when the pick is first reached
 *   and played to its end. The choice is kept in the cursor, so a resumed
 *   save never rolls it again.
 * - `loop` — repeat a body `repeat` times, or `forever`.
 * - `stages` — the boss-phase block: condition-gated segments in order. The
 *   current stage's body runs turn by turn, and the block moves to the next
 *   stage when the current one's `until` holds at a turn boundary, so a boss
 *   changes phase on the turn after its pool crosses the threshold.
 *
 * Bodies are `WaveList`s themselves, so the grammar nests to any depth. The
 * walk recurses over a cursor that mirrors the active path down the tree,
 * never over a pre-expanded list, which a `forever` loop would make endless.
 *
 * When a list runs out, the last wave repeats: at the top level, once the
 * pool outlasts a list with no `forever`, and in a non-final stage whose
 * condition has not yet held. A nested list that runs out hands on to the
 * next entry of its parent, and a final stage's body to whatever follows its
 * block.
 *
 * The cursor is plain JSON (the `EXHAUSTED` sentinel never leaves this file),
 * so the run's snapshot holds it as it is. It records every list index, loop
 * iteration, chosen option and active stage, so a save taken mid-encounter
 * resumes the same sequence.
 *
 * Pure: the only draw is a pick's roll, off the stream the caller passes
 * (`Run.rollTurnWave` passes the turn's keyed battle stream).
 */

import type { RNG } from '../../core/RNG';
import type { WaveSpec } from './wave';

// ---------------------------------------------------------------------------
// Grammar
// ---------------------------------------------------------------------------

/** A sequence of entries — the top level, and every loop/stage body. */
export type WaveList = readonly WaveEntry[];

/** One node in the wave grammar. */
export type WaveEntry =
  | { readonly kind: 'wave'; readonly spec: WaveSpec }
  | { readonly kind: 'pick'; readonly options: readonly PickOption[] }
  | { readonly kind: 'loop'; readonly body: WaveList; readonly repeat: number | 'forever' }
  | { readonly kind: 'stages'; readonly stages: readonly Stage[] };

/** A weighted option in a `pick`. */
export interface PickOption {
  readonly entry: WaveEntry;
  readonly weight: number;
}

/** One segment of a `stages` block. A non-final stage moves on when its
 *  `until` holds, and without one it never does; the final stage's `until`
 *  is ignored. */
export interface Stage {
  readonly until?: Condition;
  readonly body: WaveList;
}

// ---------------------------------------------------------------------------
// Stage conditions
// ---------------------------------------------------------------------------

/** The live encounter state a stage condition reads, at the turn boundary. */
export interface EncounterState {
  /** Enemy pool remaining as a fraction of the encounter's max pool, in [0, 1]. */
  readonly poolFraction: number;
}

/** A stage-advance predicate: the enemy pool at or below a fraction of its
 *  max. */
export type Condition = { readonly kind: 'enemyPoolAtOrBelow'; readonly fraction: number };

/** True when a stage's `until` condition is satisfied by the live state. */
export function conditionMet(cond: Condition, state: EncounterState): boolean {
  return state.poolFraction <= cond.fraction;
}

// ---------------------------------------------------------------------------
// Cursor — mirrors the active path down the grammar tree.
// ---------------------------------------------------------------------------

/** Position within a `WaveList`: which entry, plus that entry's cursor. */
interface ListCursor {
  readonly index: number;
  readonly child: EntryCursor;
}

/** Position within a single entry (recurses into composite entries). */
type EntryCursor =
  | { readonly kind: 'wave' }
  | { readonly kind: 'pick'; readonly chosen: number; readonly child: EntryCursor }
  | { readonly kind: 'loop'; readonly iteration: number; readonly child: ListCursor }
  | { readonly kind: 'stages'; readonly stage: number; readonly child: ListCursor };

/** The top-level cursor the sequencer persists between turns. */
export type WaveCursor = ListCursor;

// ---------------------------------------------------------------------------
// Sequencer
// ---------------------------------------------------------------------------

/**
 * Resolve the wave for one turn. Pass `cursor = null` on the encounter's first
 * turn (positions at the first leaf); thereafter pass back the returned cursor.
 * `state` carries the live pool for stage conditions; `rng` rolls picks.
 *
 * Returns the `WaveSpec` to resolve (`resolveWave`) and the cursor to keep for
 * the next turn.
 */
export function waveForTurn(
  list: WaveList,
  cursor: WaveCursor | null,
  state: EncounterState,
  rng: RNG,
): { readonly spec: WaveSpec; readonly cursor: WaveCursor } {
  let next: WaveCursor;
  if (cursor === null) {
    next = enterList(list, rng);
  } else {
    const advanced = advanceList(list, cursor, state, rng);
    // The top level ran out: keep the cursor where it is and field its last
    // wave again.
    next = advanced === EXHAUSTED ? cursor : advanced;
  }
  return { spec: specAtList(list, next), cursor: next };
}

/** Internal "this subtree has no more leaves after the current one" sentinel.
 *  Never appears in a returned cursor (so cursors stay plain JSON). */
const EXHAUSTED = Symbol('exhausted');
type Advance<C> = C | typeof EXHAUSTED;

// --- list ------------------------------------------------------------------

function enterList(list: WaveList, rng: RNG): ListCursor {
  if (list.length === 0) throw new Error('waveForTurn: empty wave list');
  return { index: 0, child: enterEntry(list[0]!, rng) };
}

function specAtList(list: WaveList, cursor: ListCursor): WaveSpec {
  return specAtEntry(list[cursor.index]!, cursor.child);
}

function advanceList(
  list: WaveList,
  cursor: ListCursor,
  state: EncounterState,
  rng: RNG,
): Advance<ListCursor> {
  const advanced = advanceEntry(list[cursor.index]!, cursor.child, state, rng);
  if (advanced !== EXHAUSTED) return { index: cursor.index, child: advanced };
  if (cursor.index + 1 < list.length) {
    return { index: cursor.index + 1, child: enterEntry(list[cursor.index + 1]!, rng) };
  }
  return EXHAUSTED;
}

// --- entry -----------------------------------------------------------------

function enterEntry(entry: WaveEntry, rng: RNG): EntryCursor {
  switch (entry.kind) {
    case 'wave':
      return { kind: 'wave' };
    case 'pick': {
      const chosen = rollPick(entry.options, rng);
      return { kind: 'pick', chosen, child: enterEntry(entry.options[chosen]!.entry, rng) };
    }
    case 'loop':
      return { kind: 'loop', iteration: 0, child: enterList(entry.body, rng) };
    case 'stages':
      return { kind: 'stages', stage: 0, child: enterList(entry.stages[0]!.body, rng) };
  }
}

function specAtEntry(entry: WaveEntry, cursor: EntryCursor): WaveSpec {
  switch (entry.kind) {
    case 'wave':
      assertCursor(cursor, 'wave');
      return entry.spec;
    case 'pick':
      assertCursor(cursor, 'pick');
      return specAtEntry(entry.options[cursor.chosen]!.entry, cursor.child);
    case 'loop':
      assertCursor(cursor, 'loop');
      return specAtList(entry.body, cursor.child);
    case 'stages':
      assertCursor(cursor, 'stages');
      return specAtList(entry.stages[cursor.stage]!.body, cursor.child);
  }
}

function advanceEntry(
  entry: WaveEntry,
  cursor: EntryCursor,
  state: EncounterState,
  rng: RNG,
): Advance<EntryCursor> {
  switch (entry.kind) {
    case 'wave':
      return EXHAUSTED; // a leaf yields exactly once

    case 'pick': {
      assertCursor(cursor, 'pick');
      // The pick streams its chosen option to exhaustion (no re-roll); the parent
      // moves past it once that option is done.
      const advanced = advanceEntry(entry.options[cursor.chosen]!.entry, cursor.child, state, rng);
      return advanced === EXHAUSTED
        ? EXHAUSTED
        : { kind: 'pick', chosen: cursor.chosen, child: advanced };
    }

    case 'loop': {
      assertCursor(cursor, 'loop');
      const advanced = advanceList(entry.body, cursor.child, state, rng);
      if (advanced !== EXHAUSTED) return { kind: 'loop', iteration: cursor.iteration, child: advanced };
      const nextIteration = cursor.iteration + 1;
      if (entry.repeat === 'forever' || nextIteration < entry.repeat) {
        return { kind: 'loop', iteration: nextIteration, child: enterList(entry.body, rng) };
      }
      return EXHAUSTED;
    }

    case 'stages': {
      assertCursor(cursor, 'stages');
      const stage = entry.stages[cursor.stage]!;
      const isFinal = cursor.stage + 1 >= entry.stages.length;
      // The condition comes before the body: a non-final stage whose `until`
      // holds moves to the next stage this turn.
      if (!isFinal && stage.until && conditionMet(stage.until, state)) {
        return {
          kind: 'stages',
          stage: cursor.stage + 1,
          child: enterList(entry.stages[cursor.stage + 1]!.body, rng),
        };
      }
      const advanced = advanceList(stage.body, cursor.child, state, rng);
      if (advanced !== EXHAUSTED) return { kind: 'stages', stage: cursor.stage, child: advanced };
      // The body ran out. A final stage hands on to its parent; a non-final
      // stage still waiting on its condition keeps the cursor on its last
      // leaf, repeating that wave until the condition holds.
      if (isFinal) return EXHAUSTED;
      return { kind: 'stages', stage: cursor.stage, child: cursor.child };
    }
  }
}

// --- helpers ---------------------------------------------------------------

/** Weighted choice of an option index: one `rng.next()` draw, even for a
 *  single option. A total weight of 0 (the loader allows weights of 0) picks
 *  the first option with no draw. */
function rollPick(options: readonly PickOption[], rng: RNG): number {
  const total = options.reduce((sum, o) => sum + Math.max(0, o.weight), 0);
  if (total <= 0) return 0;
  let roll = rng.next() * total;
  for (let i = 0; i < options.length; i++) {
    roll -= Math.max(0, options[i]!.weight);
    if (roll < 0) return i;
  }
  return options.length - 1; // floating-point guard
}

/** Narrow an `EntryCursor` to a kind, throwing on a grammar/cursor mismatch
 *  (only possible if a persisted cursor is paired with a different grammar). */
function assertCursor<K extends EntryCursor['kind']>(
  cursor: EntryCursor,
  kind: K,
): asserts cursor is Extract<EntryCursor, { kind: K }> {
  if (cursor.kind !== kind) {
    throw new Error(`wave cursor mismatch: expected ${kind}, got ${cursor.kind}`);
  }
}
