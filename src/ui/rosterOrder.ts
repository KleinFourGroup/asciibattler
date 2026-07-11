/**
 * R1 — the roster-view ordering seam. A keyed resolver (the O3 `focusTile`
 * pattern) so the roster view can present its cards in different orders without
 * a refactor: only `recruited` is wired to the UI today, but `archetype` /
 * `level` ship switchable so a future order-toggle control (or a difficulty /
 * preference flag) is a data change, not a rewrite — the user's call when R1's
 * order question was locked.
 *
 * Pure (no DOM) so it's unit-testable under the project's node test env; the
 * DOM-side `CardListModal` consumes it.
 */

import type { UnitTemplate } from '../sim/Unit';
import { ALL_ARCHETYPES } from '../sim/archetypes';

export type RosterOrder = 'recruited' | 'archetype' | 'level';

/** The UI default — recruitment order (the roster's natural, positionally
 *  stable order). The other strategies exist for the future toggle. */
export const DEFAULT_ROSTER_ORDER: RosterOrder = 'recruited';

/** Canonical archetype rank for the `archetype` grouping — the `Archetype`
 *  union order, surfaced via `ALL_ARCHETYPES` (config key order) so a newly
 *  added archetype slots in automatically rather than needing a hand-kept list. */
const ARCHETYPE_RANK = new Map<UnitTemplate['archetype'], number>(
  ALL_ARCHETYPES.map((a, i) => [a, i] as const),
);

/** 51c — one displayed card with its position in the SOURCE array. The
 *  selectable roster view confirms in source indices (a `payToRemoveUnit`
 *  takes a rosterIndex, not a display position), so the ordering seam
 *  surfaces the mapping rather than each consumer re-deriving it. */
export interface OrderedRosterEntry {
  readonly unit: UnitTemplate;
  readonly sourceIndex: number;
}

/**
 * Reorder a roster for display, carrying each unit's SOURCE index (51c — the
 * selection mapping). Returns a NEW array (never mutates the input);
 * `recruited` preserves the roster's natural order exactly. The sorts are
 * STABLE on recruitment order (the original array index breaks every tie), so
 * cards never churn position between renders for units that compare equal.
 */
export function orderRosterWithIndices(
  roster: readonly UnitTemplate[],
  order: RosterOrder = DEFAULT_ROSTER_ORDER,
): readonly OrderedRosterEntry[] {
  const decorated = roster.map((unit, sourceIndex) => ({ unit, sourceIndex }));
  if (order === 'recruited') return decorated;
  return decorated.sort((a, b) => compare(order, a, b));
}

/** The undecorated view (the R1 shape — display order only). */
export function orderRoster(
  roster: readonly UnitTemplate[],
  order: RosterOrder = DEFAULT_ROSTER_ORDER,
): readonly UnitTemplate[] {
  return orderRosterWithIndices(roster, order).map((d) => d.unit);
}

function compare(
  order: Exclude<RosterOrder, 'recruited'>,
  a: OrderedRosterEntry,
  b: OrderedRosterEntry,
): number {
  if (order === 'archetype') {
    const byArchetype = rankOf(a.unit) - rankOf(b.unit);
    if (byArchetype !== 0) return byArchetype;
  } else {
    // `level`: strongest first.
    const byLevel = b.unit.level - a.unit.level;
    if (byLevel !== 0) return byLevel;
  }
  return a.sourceIndex - b.sourceIndex; // stable tie-break: recruitment order
}

function rankOf(unit: UnitTemplate): number {
  return ARCHETYPE_RANK.get(unit.archetype) ?? Number.MAX_SAFE_INTEGER;
}
