/**
 * 2D tile grid that backs the battle arena. Owned by World; mutated during
 * encounter generation, queried by pathfinding and the renderer.
 *
 * Coordinate system matches `GridCoord` everywhere else in sim: integer
 * cells with (0, 0) at the bottom-left. Row-major internal storage.
 *
 * Tiles are surface properties (movement cost, eventually combat
 * modifiers / LOS). Solid obstacles like walls live as **neutral-team
 * units** sitting on a floor tile — see `wall` template — not as a tile
 * kind. That keeps destructibility, healing shrines, and any other
 * "static thing with optional behaviour" inside the existing Unit
 * pipeline.
 *
 * **D3:** width and height are independent. Constructors that take a
 * single dimension are gone; callers now pass `(width, height)`
 * explicitly so the rectangular case can't be silently squashed back to
 * square by an accidental single-arg call.
 */

import { GRID_SIZE } from '../config';
import type { GridCoord } from '../core/types';

export type TileKind = 'floor' | 'shallow_water';

/**
 * Movement cost to ENTER a tile of this kind. Pathfinding weights
 * neighbour edges by the destination cell's cost. Chebyshev (the A*
 * heuristic) is a lower bound on min-cost path length only when every
 * cost is >= 1 — don't add free tiles or the heuristic stops being
 * admissible.
 */
const TILE_COSTS: Record<TileKind, number> = {
  floor: 1,
  shallow_water: 2,
};

export interface TileGridSnapshot {
  width: number;
  height: number;
  /**
   * Flat row-major array of kind strings. Stored as the discriminator
   * string rather than a packed numeric code so adding a new TileKind
   * doesn't invalidate existing snapshots.
   */
  kinds: TileKind[];
}

export class TileGrid {
  readonly width: number;
  readonly height: number;
  private readonly kinds: TileKind[];

  constructor(width: number = GRID_SIZE, height: number = GRID_SIZE) {
    this.width = width;
    this.height = height;
    this.kinds = new Array(width * height).fill('floor' as TileKind);
  }

  kindAt(c: GridCoord): TileKind {
    if (!this.inBounds(c)) {
      throw new Error(`TileGrid.kindAt: out of bounds (${c.x}, ${c.y})`);
    }
    return this.kinds[this.index(c.x, c.y)]!;
  }

  /** Movement cost to enter the cell. Out-of-bounds returns Infinity so
   *  pathfinding can short-circuit without a separate bounds check. */
  costAt(c: GridCoord): number {
    if (!this.inBounds(c)) return Infinity;
    return TILE_COSTS[this.kinds[this.index(c.x, c.y)]!];
  }

  setKind(c: GridCoord, kind: TileKind): void {
    if (!this.inBounds(c)) {
      throw new Error(`TileGrid.setKind: out of bounds (${c.x}, ${c.y})`);
    }
    this.kinds[this.index(c.x, c.y)] = kind;
  }

  inBounds(c: GridCoord): boolean {
    return c.x >= 0 && c.y >= 0 && c.x < this.width && c.y < this.height;
  }

  /** Iterate every cell in row-major order. Renderer + generator helper. */
  *cells(): IterableIterator<{ x: number; y: number; kind: TileKind }> {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        yield { x, y, kind: this.kinds[this.index(x, y)]! };
      }
    }
  }

  toJSON(): TileGridSnapshot {
    return { width: this.width, height: this.height, kinds: this.kinds.slice() };
  }

  static fromJSON(snap: TileGridSnapshot): TileGrid {
    if (snap.kinds.length !== snap.width * snap.height) {
      throw new Error(
        `TileGrid.fromJSON: kinds.length ${snap.kinds.length} != width*height ${snap.width * snap.height}`,
      );
    }
    const grid = new TileGrid(snap.width, snap.height);
    for (let i = 0; i < snap.kinds.length; i++) {
      grid.kinds[i] = snap.kinds[i]!;
    }
    return grid;
  }

  private index(x: number, y: number): number {
    return y * this.width + x;
  }
}
