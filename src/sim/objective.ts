import type { GridCoord } from '../core/types';

/**
 * J1 — the player team's single shared battle objective (one per `World`), the
 * low-intensity steering layer from the Phase-J brief. Units honor it only when
 * not already engaged (see `updateTarget`'s objective branch in `Targeting.ts`).
 *
 *  - `enemy`: a specific enemy unit to converge on + kill. AUTO-CLEARS the tick
 *    that unit dies (`World.clearObjectiveIfResolved`), so the team reverts to
 *    default nearest-enemy targeting.
 *  - `tile`: a rally cell the team paths toward (an attractor — "as close as
 *    they can"). PERSISTS until the player clears or replaces it (the
 *    user-locked tile-objective semantics).
 *
 * Player-only: enemy AI never reads it. Stored on `World` + snapshotted
 * (WorldSnapshot v23). Set/cleared via the `setObjective` / `clearObjective`
 * `WorldCommand`s, so the apply point is the deterministic top-of-tick drain
 * and a mid-battle save round-trips it (it rides `pendingCommands` + the
 * `objective` field).
 */
export type BattleObjective =
  | { readonly kind: 'enemy'; readonly unitId: number }
  | { readonly kind: 'tile'; readonly cell: GridCoord };

/** A living enemy's id + cell — the minimal slice `objectiveAtCell` needs. The
 *  caller (J3's objective-input controller) builds these from the World's living
 *  enemy units, so this stays free of a render→sim or sim→render import. */
export interface EnemyAtCell {
  readonly id: number;
  readonly cell: GridCoord;
}

/**
 * J3 — resolve a clicked grid cell into a `BattleObjective`: an `enemy`
 * objective when a living enemy occupies the cell, else a `tile` rally
 * objective. Only enemies count as enemy-objectives — clicking empty ground, a
 * friendly unit, or a wall all rally the team to that cell (the tile attractor).
 *
 * Pure (plain data in, no `World`) so it's node-testable and both input paths —
 * right-click and the armed left-click — route through the one resolver.
 */
export function objectiveAtCell(
  cell: GridCoord,
  enemies: readonly EnemyAtCell[],
): BattleObjective {
  const hit = enemies.find((e) => e.cell.x === cell.x && e.cell.y === cell.y);
  return hit ? { kind: 'enemy', unitId: hit.id } : { kind: 'tile', cell };
}
