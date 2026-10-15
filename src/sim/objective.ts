import type { GridCoord } from '../core/types';

/**
 * The objectives: each team has one, always, which separates the mode (what
 * the team is doing) from the target (where, or whom).
 *
 * `ObjectiveTarget`:
 *
 * - `enemy` — an enemy unit to converge on and kill.
 * - `neutral` — a neutral to converge on and break or fight: a destructible
 *   (rubble, a destructible wall or cover) or a camp member
 *   (`validNeutralObjectiveTarget`). Apart from `enemy`, so the targeting
 *   keeps "attack a hostile" and "break an obstacle" distinct: a neutral is
 *   never an `enemy`. Set by a player's click or the enemy's camp pull
 *   (`battleSetup.ts`); auto-targeting a destructible sets `targetId`
 *   directly, never through an objective.
 * - `tile` — a rally cell the team paths toward, as close as it can.
 *
 * `TeamObjective`, the modes:
 *
 * - `atWill` — the default, with no target: nearest-enemy targeting and
 *   ordinary pathing. A team reverts here when the target of its `engage`
 *   or `focus` is gone (`World.clearResolvedObjectives`).
 * - `engage` — the attack-move: converge on the target, within a leashed
 *   engage radius, and fight back when struck
 *   (`Targeting.updateObjectiveTarget`).
 * - `hold` — no target. Units stop moving (`MovementBehavior` proposes no
 *   move, no pursuit, no dash) but act in place, on any enemy already in
 *   attack range (`Targeting.updateTarget`'s hold branch): a held ranged
 *   unit fires at anything in reach, a held melee unit strikes only what is
 *   adjacent.
 * - `focus` — like `engage`, but it preempts targeting and pathing whole: a
 *   unit leaves its fight, and takes hits from the rest without breaking
 *   off, to converge on the focus. A unit focus goes straight for that unit
 *   and ignores everything else; a tile focus goes straight for the tile,
 *   then engages around it (`Targeting.updateFocusTarget`). A gone target
 *   reverts as `engage`'s does; a tile holds.
 *
 * Stored per team on `World` (`objectiveFor(team)`), and the behaviours
 * read the acting unit's team's, so the enemy's is real: the camp pull sets
 * it, and nothing else in the game does. Changed only through the `setObjective` and
 * `clearObjective` commands, at the drain at the tick's top, and
 * serialized.
 */
export type ObjectiveTarget =
  | { readonly kind: 'enemy'; readonly unitId: number }
  | { readonly kind: 'neutral'; readonly unitId: number }
  | { readonly kind: 'tile'; readonly cell: GridCoord };

/** The teams that carry an objective. A neutral never does, and
 *  `World.objectiveFor` answers `atWill` for one. */
export type ObjectiveTeam = 'player' | 'enemy';

/** A team's objective, always present; the modes are described above. */
export type TeamObjective =
  | { readonly mode: 'atWill' }
  | { readonly mode: 'engage'; readonly target: ObjectiveTarget }
  | { readonly mode: 'hold' }
  | { readonly mode: 'focus'; readonly target: ObjectiveTarget };

/**
 * The shared `atWill`: both teams start here and every revert lands here.
 * Frozen, so one instance serves both teams, and a revert swaps a
 * reference rather than allocating.
 */
export const AT_WILL: TeamObjective = Object.freeze({ mode: 'atWill' } as const);

/** A living enemy's id and cell, all `objectiveAtCell` needs. The
 *  objective-input controller builds these from the World's living enemies,
 *  so this file imports nothing from render or UI. */
export interface EnemyAtCell {
  readonly id: number;
  readonly cell: GridCoord;
}

/** A living targetable neutral's id and its footprint's cells. A 2×2 or 3×3
 *  rubble covers several cells and a click on any of them targets it, so
 *  this carries a list, where `EnemyAtCell` has one cell (every shipped
 *  combatant is 1×1). Built by the objective-input controller, as
 *  `EnemyAtCell` is. */
export interface NeutralAtCell {
  readonly id: number;
  readonly cells: readonly GridCoord[];
}

/**
 * Resolves a clicked cell into an `ObjectiveTarget`, first match wins: a
 * living enemy on the cell, then a neutral in `neutrals` whose footprint
 * covers it, then the cell itself as a `tile`. So an enemy in front of
 * rubble wins, and a click on empty ground, a friend or an indestructible
 * wall (absent from `neutrals`) rallies the team to the cell. The caller
 * wraps the result in a mode (an unarmed left-click `engage`, a right-click
 * `focus`, an armed pick its own).
 *
 * Plain data in, no `World`, so it tests headless and every input path, the
 * two unarmed clicks and the armed left-click, goes through this one
 * resolver.
 */
export function objectiveAtCell(
  cell: GridCoord,
  enemies: readonly EnemyAtCell[],
  neutrals: readonly NeutralAtCell[] = [],
): ObjectiveTarget {
  const enemy = enemies.find((e) => e.cell.x === cell.x && e.cell.y === cell.y);
  if (enemy) return { kind: 'enemy', unitId: enemy.id };
  const neutral = neutrals.find((n) =>
    n.cells.some((c) => c.x === cell.x && c.y === cell.y),
  );
  if (neutral) return { kind: 'neutral', unitId: neutral.id };
  return { kind: 'tile', cell };
}
