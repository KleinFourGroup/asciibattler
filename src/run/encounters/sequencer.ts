/**
 * U2 — the wave-list grammar + the per-turn sequencer.
 *
 * An encounter's `waves` is a small GRAMMAR (not a flat list): a recursive tree
 * of entries that the sequencer walks one wave per turn. The encounter's health
 * pool — NOT the list — decides when the fight ends, so the sequencer must always
 * yield a wave for any turn (a `forever` loop / an open-ended final stage are the
 * idioms for "keep fighting").
 *
 * **The grammar** (`WaveEntry`), each entry one of:
 *  - **wave** — emit this `WaveSpec` (U1) this turn.
 *  - **pick** — a weighted set of options; roll ONE when first reached (consumes
 *    `rng`), then stream that option to exhaustion. The choice is frozen in the
 *    cursor, so a resume never re-rolls.
 *  - **loop** — repeat a body `N` times or `forever`.
 *  - **stages** — the boss-phase construct: an ordered list of condition-gated
 *    segments. Run the current stage's body turn-by-turn; advance to the next
 *    stage the moment that stage's `until` condition trips (checked at the turn
 *    boundary, so a boss flips on the turn AFTER its pool crosses the threshold).
 *    The final stage omits `until` and runs open-ended to encounter end.
 *
 * **Bodies are themselves `WaveList`s**, so the grammar NESTS arbitrarily (a loop
 * of loops, a stage whose body is a loop of picks, any depth). The resolver is
 * recursive over a cursor that structurally mirrors the active path down the tree
 * — never a pre-expanded list (a `forever` loop can't be expanded).
 *
 * **Terminal policy** (user-locked): when a finite list with no `forever` is
 * outlasted by the encounter pool, **the last wave repeats**. Applied uniformly
 * at every list level on exhaustion; a non-final stage waiting on its condition
 * likewise repeats its last wave until the condition trips.
 *
 * **The cursor** is plain JSON (no symbols/functions in a RETURNED cursor — the
 * `EXHAUSTED` sentinel is internal only), so U3 snapshots it directly. It fully
 * captures position (list indices, loop iterations, the chosen pick option, the
 * active stage), so a mid-encounter save resumes the exact same sequence.
 *
 * Pure + headless: the only `rng` draw is a pick roll, threaded exactly where
 * `rollEnemyWave`'s per-turn draw sits today. Deterministic from the seed + the
 * persisted cursor.
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

/** One segment of a `stages` block. A non-final stage carries an `until`
 *  condition (advance when it trips); the final stage omits it (open-ended). */
export interface Stage {
  readonly until?: Condition;
  readonly body: WaveList;
}

// ---------------------------------------------------------------------------
// Stage conditions — a keyed predicate vocabulary, extensible like focusTile.ts
// (add a union variant + a registry entry; NOT a hard-coded `if`).
// ---------------------------------------------------------------------------

/** The live encounter state a stage condition reads, at the turn boundary. */
export interface EncounterState {
  /** Enemy pool remaining as a fraction of the encounter's max pool, in [0, 1]. */
  readonly poolFraction: number;
  /** 1-based turn index (reserved for a future `turnAtOrAbove` condition). */
  readonly turn: number;
}

/** A stage-advance predicate. Ships ONE variant; the union + registry are the
 *  seam for `turnAtOrAbove` / `enemyUnitsAtOrBelow` / … later. */
export type Condition = { readonly kind: 'enemyPoolAtOrBelow'; readonly fraction: number };

type ConditionEvaluator = (cond: Condition, state: EncounterState) => boolean;

const CONDITIONS: Record<Condition['kind'], ConditionEvaluator> = {
  enemyPoolAtOrBelow: (cond, state) => state.poolFraction <= cond.fraction,
};

/** True when a stage's `until` condition is satisfied by the live state. */
export function conditionMet(cond: Condition, state: EncounterState): boolean {
  const evaluate = CONDITIONS[cond.kind];
  if (!evaluate) throw new Error(`unknown wave-stage condition: ${(cond as { kind: string }).kind}`);
  return evaluate(cond, state);
}

// ---------------------------------------------------------------------------
// Cursor — mirrors the active path down the grammar tree.
// ---------------------------------------------------------------------------

/** Position within a `WaveList`: which entry, plus that entry's cursor. */
export interface ListCursor {
  readonly index: number;
  readonly child: EntryCursor;
}

/** Position within a single entry (recurses into composite entries). */
export type EntryCursor =
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
 * `state` carries the live pool/turn for stage conditions; `rng` rolls picks.
 *
 * Returns the `WaveSpec` to resolve (via `resolveWave`, U1) plus the cursor to
 * persist for the next turn.
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
    // Top-level exhaustion → repeat the last wave (the terminal policy): keep the
    // cursor where it is and re-emit its leaf.
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
      // Condition jump (priority over continuing the body): a non-final stage
      // whose `until` trips advances to the next stage immediately.
      if (!isFinal && stage.until && conditionMet(stage.until, state)) {
        return {
          kind: 'stages',
          stage: cursor.stage + 1,
          child: enterList(entry.stages[cursor.stage + 1]!.body, rng),
        };
      }
      const advanced = advanceList(stage.body, cursor.child, state, rng);
      if (advanced !== EXHAUSTED) return { kind: 'stages', stage: cursor.stage, child: advanced };
      // Body exhausted. Final stage → bubble up (top-level repeats its last wave).
      // Non-final stage still waiting on its condition → repeat ITS last wave
      // (keep the cursor on the last leaf) until the condition trips.
      if (isFinal) return EXHAUSTED;
      return { kind: 'stages', stage: cursor.stage, child: cursor.child };
    }
  }
}

// --- helpers ---------------------------------------------------------------

/** Weighted choice of an option index. One `rng.next()` draw; non-positive total
 *  weight → the first option (a degenerate but defined fallback). */
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
