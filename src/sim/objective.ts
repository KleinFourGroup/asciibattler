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
