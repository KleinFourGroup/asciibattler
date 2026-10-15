/**
 * Shared primitives. Kept narrow on purpose — anything that grows behavior
 * beyond a plain shape probably wants its own module.
 */

/** Integer cell index on the battle grid. (0, 0) is the bottom-left corner. */
export interface GridCoord {
  readonly x: number;
  readonly y: number;
}
