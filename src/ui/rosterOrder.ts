/**
 * The card-list modal's display order, a keyed resolver. No caller passes
 * an order, so every view shows `recruited`; `archetype` and `level` are
 * kept, by the user's call when the roster view's order was settled, so
 * that offering another order is a data change rather than a rewrite.
 *
 * Pure (no DOM), so it is tested under the project's node environment;
 * `CardListModal` reads it.
 */

import type { UnitTemplate } from '../sim/Unit';
import { ALL_ARCHETYPES } from '../sim/archetypes';

export type RosterOrder = 'recruited' | 'archetype' | 'level';

/** The default: recruitment order, the roster's own, which holds each
 *  card's place. */
export const DEFAULT_ROSTER_ORDER: RosterOrder = 'recruited';

/** Each archetype's rank for the `archetype` order: `ALL_ARCHETYPES`'
 *  order, the combatants in `config/units.json`'s key order, so a new
 *  archetype takes its place with no hand-kept list. */
const ARCHETYPE_RANK = new Map<UnitTemplate['archetype'], number>(
  ALL_ARCHETYPES.map((a, i) => [a, i] as const),
);

/** One displayed card with its position in the source array. The
 *  selectable view confirms in source indices (`payToRemoveUnit` takes a
 *  `rosterIndex`, not a display position), so the order carries the
 *  mapping rather than each caller deriving it again. */
interface OrderedRosterEntry {
  readonly unit: UnitTemplate;
  readonly sourceIndex: number;
}

/**
 * Reorder a roster for display, carrying each unit's source index for the
 * selection. Returns a new array and never mutates the input; `recruited`
 * keeps the roster's order exactly. The sorts are stable on recruitment
 * order (the source index breaks every tie), so units that compare equal
 * never swap places between renders.
 */
export function orderRosterWithIndices(
  roster: readonly UnitTemplate[],
  order: RosterOrder = DEFAULT_ROSTER_ORDER,
): readonly OrderedRosterEntry[] {
  const decorated = roster.map((unit, sourceIndex) => ({ unit, sourceIndex }));
  if (order === 'recruited') return decorated;
  return decorated.sort((a, b) => compare(order, a, b));
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
