/** Shared plain shapes. A type that grows behaviour belongs in its own module. */

/**
 * A cell on the battle grid, in whole cells. (0, 0) is the bottom-left
 * corner: the near-left cell as the camera sees it (`gridToWorld` in
 * `BattleRenderer.ts`).
 */
export interface GridCoord {
  readonly x: number;
  readonly y: number;
}
