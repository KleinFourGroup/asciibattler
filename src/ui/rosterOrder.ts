/**
 * R1 — the roster-view ordering seam. A keyed resolver (the O3 `focusTile`
 * pattern) so the roster view can present its cards in different orders without
 * a refactor: only `recruited` is wired to the UI today, but `archetype` /
 * `level` ship switchable so a future order-toggle control (or a difficulty /
 * preference flag) is a data change, not a rewrite — the user's call when R1's
 * order question was locked.
 *
 * Pure (no DOM) so it's unit-testable under the project's node test env; the
 * DOM-side `RosterView` consumes it.
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

/**
 * Reorder a roster for display. Returns a NEW array (never mutates the input);
 * `recruited` preserves the roster's natural order exactly. The sorts are
 * STABLE on recruitment order (the original array index breaks every tie), so
 * cards never churn position between renders for units that compare equal.
 */
export function orderRoster(
  roster: readonly UnitTemplate[],
  order: RosterOrder = DEFAULT_ROSTER_ORDER,
): readonly UnitTemplate[] {
  if (order === 'recruited') return roster.slice();
  // Decorate-sort-undecorate: carry the original index so the comparator can
  // fall back to it for a stable tie-break, independent of the JS engine's
  // Array.sort stability guarantees.
  return roster
    .map((unit, index) => ({ unit, index }))
    .sort((a, b) => compare(order, a, b))
    .map((d) => d.unit);
}

function compare(
  order: Exclude<RosterOrder, 'recruited'>,
  a: { unit: UnitTemplate; index: number },
  b: { unit: UnitTemplate; index: number },
): number {
  if (order === 'archetype') {
    const byArchetype = rankOf(a.unit) - rankOf(b.unit);
    if (byArchetype !== 0) return byArchetype;
  } else {
    // `level`: strongest first.
    const byLevel = b.unit.level - a.unit.level;
    if (byLevel !== 0) return byLevel;
  }
  return a.index - b.index; // stable tie-break: recruitment order
}

function rankOf(unit: UnitTemplate): number {
  return ARCHETYPE_RANK.get(unit.archetype) ?? Number.MAX_SAFE_INTEGER;
}
