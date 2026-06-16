import type { GridCoord } from '../core/types';

/**
 * The in-battle objective model. O1 (Phase O) refactored J1's single nullable
 * player objective into a per-team, ALWAYS-PRESENT typed objective, separating
 * the MODE (what the team is doing) from the TARGET (where / who).
 *
 * `ObjectiveTarget` — the inner where/who (the old J1 `BattleObjective`,
 * unchanged in shape):
 *  - `enemy`: a specific enemy unit to converge on + kill.
 *  - `tile`:  a rally cell the team paths toward (an attractor — "as close as
 *    they can").
 *
 * `TeamObjective` — the always-present per-team wrapper. O1 ships two modes; O2
 * adds `hold`, O3 adds `focus` (each extends this union + its behavior branch):
 *  - `atWill` (the default): no target — default nearest-enemy targeting +
 *    normal pathing. BEHAVIORALLY IDENTICAL to J1's `objective === null`. A team
 *    reverts here when an `engage`/`focus` enemy target dies (J1's auto-clear,
 *    now "revert to at-will" rather than "set null").
 *  - `engage`: target = enemy or tile. The RTS attack-move — BEHAVIORALLY
 *    IDENTICAL to J1's set objective (leash-capped engage radius + retaliation;
 *    see `Targeting.updateObjectiveTarget`).
 *
 * Stored per-team on `World` (`objectiveFor(team)`); the ENEMY team is fixed at
 * `atWill` for now (J1's "enemy AI never sets it"), but the storage is real and
 * the behaviors read the ACTING unit's team objective, so a future enemy
 * strategy is a data change, not a refactor. Set/cleared via the `setObjective`
 * / `clearObjective` `WorldCommand`s (the deterministic top-of-tick drain);
 * snapshotted (WorldSnapshot v25).
 */
export type ObjectiveTarget =
  | { readonly kind: 'enemy'; readonly unitId: number }
  | { readonly kind: 'tile'; readonly cell: GridCoord };

/** The teams that carry an objective. Neutrals (walls / environment entities)
 *  never do — `World.objectiveFor` maps them to `atWill` defensively. */
export type ObjectiveTeam = 'player' | 'enemy';

/**
 * A team's always-present steering objective. O1 = `atWill` | `engage`; O2 adds
 * `hold` (no target, act-in-place), O3 adds `focus` (target, preempts pathing).
 */
export type TeamObjective =
  | { readonly mode: 'atWill' }
  | { readonly mode: 'engage'; readonly target: ObjectiveTarget };

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

/**
 * J3 — resolve a clicked grid cell into an `ObjectiveTarget`: an `enemy` target
 * when a living enemy occupies the cell, else a `tile` rally target. Only
 * enemies count as enemy-targets — clicking empty ground, a friendly unit, or a
 * wall all rally the team to that cell (the tile attractor). The caller wraps
 * the result in a `TeamObjective` mode (the J3 controller uses `engage`).
 *
 * Pure (plain data in, no `World`) so it's node-testable and both input paths —
 * right-click and the armed left-click — route through the one resolver.
 */
export function objectiveAtCell(
  cell: GridCoord,
  enemies: readonly EnemyAtCell[],
): ObjectiveTarget {
  const hit = enemies.find((e) => e.cell.x === cell.x && e.cell.y === cell.y);
  return hit ? { kind: 'enemy', unitId: hit.id } : { kind: 'tile', cell };
}
