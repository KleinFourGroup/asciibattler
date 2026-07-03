import type { GridCoord } from '../core/types';

/**
 * The in-battle objective model. O1 (Phase O) refactored J1's single nullable
 * player objective into a per-team, ALWAYS-PRESENT typed objective, separating
 * the MODE (what the team is doing) from the TARGET (where / who).
 *
 * `ObjectiveTarget` — the inner where/who (the old J1 `BattleObjective`):
 *  - `enemy`: a specific enemy unit to converge on + kill.
 *  - `neutral` (§40e): a specific DESTRUCTIBLE neutral (rubble / a destructible
 *    wall or cover) to converge on + demolish. Kept DISTINCT from `enemy` so the
 *    targeting resolvers stay honest — "attack a hostile" vs "demolish an
 *    obstacle" (a neutral is never an `enemy`, and every targeting scan already
 *    branches on `team === 'neutral'`). Manual only: the player clicks it; §40b's
 *    AUTO-target sets `targetId` directly, never through an objective.
 *  - `tile`:  a rally cell the team paths toward (an attractor — "as close as
 *    they can").
 *
 * `TeamObjective` — the always-present per-team wrapper. O1 shipped `atWill` +
 * `engage`; O2 adds `hold`; O3 adds `focus` (each extends this union + its
 * behavior branch):
 *  - `atWill` (the default): no target — default nearest-enemy targeting +
 *    normal pathing. BEHAVIORALLY IDENTICAL to J1's `objective === null`. A team
 *    reverts here when an `engage`/`focus` enemy target dies (J1's auto-clear,
 *    now "revert to at-will" rather than "set null").
 *  - `engage`: target = enemy or tile. The RTS attack-move — BEHAVIORALLY
 *    IDENTICAL to J1's set objective (leash-capped engage radius + retaliation;
 *    see `Targeting.updateObjectiveTarget`).
 *  - `hold` (O2): no target. Units STOP MOVING (`MovementBehavior` proposes no
 *    intent — no pursuit, no dash) but ACT IN PLACE: they target + attack any
 *    enemy ALREADY within their attack range (`Targeting.updateTarget`'s hold
 *    branch picks an in-range enemy or none). A held ranged unit fires at
 *    anything in reach; a held melee unit only strikes adjacent.
 *  - `focus` (O3): target = enemy or tile. Like `engage` but COMPLETELY
 *    PREEMPTS targeting + pathing — a unit ABANDONS its current fight (and eats
 *    hits from non-focused enemies; no retaliation break-off) to converge on
 *    the focus. An ENEMY focus = beeline to that unit, ignore everything else
 *    (`Targeting.updateFocusTarget`). A TILE focus is steered by the switchable
 *    `focusTileResolution` strategy (`src/sim/focusTile.ts`): disallow /
 *    clearOnArrival / leashAtNearest. A dead focus enemy reverts to `atWill`
 *    (mirrors engage); a tile focus reverts per its strategy.
 *
 * Stored per-team on `World` (`objectiveFor(team)`); the ENEMY team is fixed at
 * `atWill` for now (J1's "enemy AI never sets it"), but the storage is real and
 * the behaviors read the ACTING unit's team objective, so a future enemy
 * strategy is a data change, not a refactor. Set/cleared via the `setObjective`
 * / `clearObjective` `WorldCommand`s (the deterministic top-of-tick drain);
 * snapshotted (part of the WorldSnapshot).
 */
export type ObjectiveTarget =
  | { readonly kind: 'enemy'; readonly unitId: number }
  | { readonly kind: 'neutral'; readonly unitId: number }
  | { readonly kind: 'tile'; readonly cell: GridCoord };

/** The teams that carry an objective. Neutrals (walls / environment entities)
 *  never do — `World.objectiveFor` maps them to `atWill` defensively. */
export type ObjectiveTeam = 'player' | 'enemy';

/**
 * A team's always-present steering objective. O1 = `atWill` | `engage`; O2 adds
 * `hold` (no target, act-in-place), O3 adds `focus` (target, fully preempts
 * targeting + pathing).
 */
export type TeamObjective =
  | { readonly mode: 'atWill' }
  | { readonly mode: 'engage'; readonly target: ObjectiveTarget }
  | { readonly mode: 'hold' }
  | { readonly mode: 'focus'; readonly target: ObjectiveTarget };

/**
 * The shared `atWill` default — both teams start here and every revert lands
 * here. Frozen + shared (the value is immutable, so a single instance is safe
 * across both teams' state) so a revert is a reference swap, never an alloc.
 */
export const AT_WILL: TeamObjective = Object.freeze({ mode: 'atWill' } as const);

/** A living enemy's id + cell — the minimal slice `objectiveAtCell` needs. The
 *  caller (J3's objective-input controller) builds these from the World's living
 *  enemy units, so this stays free of a render→sim or sim→render import. */
export interface EnemyAtCell {
  readonly id: number;
  readonly cell: GridCoord;
}

/** §40e — a living DESTRUCTIBLE neutral's id + its footprint cells. A multi-tile
 *  rubble (2×2/3×3) occupies several cells, so a click on ANY of them targets it;
 *  hence the cell LIST (vs `EnemyAtCell`'s single cell — the shipped combatants
 *  are all 1×1). Built by the objective-input controller from the World's
 *  destructible neutrals, so this too stays import-free (mirrors `EnemyAtCell`). */
export interface NeutralAtCell {
  readonly id: number;
  readonly cells: readonly GridCoord[];
}

/**
 * J3 — resolve a clicked grid cell into an `ObjectiveTarget`, in priority order:
 * a living `enemy` occupying the cell → a `neutral` DESTRUCTIBLE body whose
 * footprint covers the cell (§40e) → else a `tile` rally target. A hostile
 * standing in front of rubble still wins (enemy-first); clicking empty ground, a
 * friendly, or an INDESTRUCTIBLE wall (absent from `neutrals`) all rally the team
 * to that cell (the tile attractor). The caller wraps the result in a
 * `TeamObjective` mode (right-click → `engage`, the armed pick → its mode).
 *
 * Pure (plain data in, no `World`) so it's node-testable and both input paths —
 * right-click and the armed left-click — route through the one resolver.
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
