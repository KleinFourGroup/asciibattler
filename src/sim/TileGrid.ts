/**
 * The 2D tile grid under a battle. Owned by World; written during terrain
 * generation and battle setup, then read by pathfinding, combat, the status
 * hooks and the renderer.
 *
 * Coordinates are `GridCoord`: integer cells with (0, 0) at the bottom-left.
 * Storage is row-major.
 *
 * Tiles are surface properties (`TileDef`). Walls and other solid obstacles
 * are neutral-team units (`src/sim/environment.ts`), not tile kinds, so
 * destructibility and line-of-sight blocking go through the Unit pipeline.
 *
 * Width and height are independent and both default to `GRID_SIZE`, so a
 * one-argument constructor call gets a `GRID_SIZE` height; pass both.
 */

import { GRID_SIZE } from '../config';
import { statusDef } from '../config/statuses';
import type { GridCoord } from '../core/types';

export type TileKind =
  | 'floor'
  | 'shallow_water'
  | 'chasm'
  | 'fire'
  | 'healing'
  | 'deep_water'
  | 'hills'
  | 'ice'
  | 'sand'
  | 'mud';

/**
 * A tile kind's surface properties: movement cost and passability
 * (pathfinding), to-hit mods (`World.applyDamage`), and status hooks on
 * entering (`World.applyTileEnterEffects`). The statuses sustained while
 * standing on `fire` (burn) and `healing` (rejuvenate) are not here: they are
 * keyed by kind in `World.applyTileStatuses`.
 *
 * Never serialized (a snapshot holds only the `TileKind` string, see
 * `TileGridSnapshot`), so adding a kind or tuning a mod never bumps a
 * snapshot.
 */
interface TileDef {
  /**
   * Movement cost to enter. Pathfinding weights a step by the destination
   * cell's cost, and `Infinity` blocks it (the `isFinite` check in
   * `Pathfinding.findPath`). Every finite cost must be >= 1, or the Chebyshev
   * heuristic stops being admissible (gotcha #34); a fast tile gets the floor
   * cost of 1.
   */
  cost: number;
  /**
   * Whether a unit may occupy or path onto this tile, for code that asks the
   * intent directly (the bot's sensors and scripts). Pathfinding reads only
   * `cost`, so a finite cost with `passable: false` would still be walked;
   * every shipped entry keeps the two in agreement.
   */
  passable: boolean;
  /**
   * Added to the defender's evasion when it is struck while standing on this
   * tile; positive is harder to hit. Absent = 0.
   */
  evasionMod?: number;
  /**
   * Added to the attacker's precision when it attacks from this tile;
   * negative is clumsier footing. Absent = 0.
   */
  accuracyMod?: number;
  /** Status id applied to a unit when it enters the tile. Absent = none. */
  statusOnEnter?: string;
  /** Status id removed from a unit when it enters the tile. Absent = none. */
  statusRemovedOnEnter?: string;
}

/**
 * The shipped tile table. Of the costs only their order matters, above the
 * floor of 1 (see `cost`). A mod point moves the to-hit chance by 0.02
 * (`hitChancePerPrecision`, `dodgeChancePerEvasion` in `config/stats.json`),
 * so -10 is -20% to hit.
 *
 * - `shallow_water` — slow; wading costs accuracy, and entering douses burn.
 * - `chasm` — impassable (gotcha #73). Line of sight checks units only
 *   (`LineOfSight.ts`), so a chasm never blocks a shot.
 * - `fire`, `healing` — floor cost; standing on one sustains a status (see
 *   `TileDef`).
 * - `deep_water` — impassable like chasm, and douses burn. No combat mod,
 *   since nothing stands on it.
 * - `hills` — slow, and high ground is harder to hit.
 * - `ice` — floor cost, and slick footing costs accuracy.
 * - `sand` — slow, and exposed footing is easier to hit.
 * - `mud` — the slowest passable tile; it costs accuracy and poisons on
 *   entering.
 */
export const TILE_DEFS: Record<TileKind, TileDef> = {
  floor: { cost: 1, passable: true },
  shallow_water: { cost: 2, passable: true, accuracyMod: -10, statusRemovedOnEnter: 'burn' },
  chasm: { cost: Infinity, passable: false },
  fire: { cost: 1, passable: true },
  healing: { cost: 1, passable: true },
  deep_water: { cost: Infinity, passable: false, statusRemovedOnEnter: 'burn' },
  hills: { cost: 3, passable: true, evasionMod: 8 },
  ice: { cost: 1, passable: true, accuracyMod: -12 },
  sand: { cost: 2, passable: true, evasionMod: -6 },
  mud: { cost: 4, passable: true, accuracyMod: -12, statusOnEnter: 'poison' },
};

/** The `TileDef` governing a kind. Keyed lookup — total over `TileKind`. */
export function tileDef(kind: TileKind): TileDef {
  return TILE_DEFS[kind];
}

/**
 * Load-time check, like `assertStatusRefsResolve` and
 * `assertSummonRefsResolve`: every status hook in the tile table must name a
 * real status, so a typo fails at module load rather than when a unit steps
 * on the tile. `statusDef` throws on an unknown id, so calling it is the
 * assertion.
 */
(function assertTileStatusRefsResolve(): void {
  for (const def of Object.values(TILE_DEFS)) {
    if (def.statusOnEnter) statusDef(def.statusOnEnter);
    if (def.statusRemovedOnEnter) statusDef(def.statusRemovedOnEnter);
  }
})();

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
    return this.costAtXY(c.x, c.y);
  }

  /** `costAt` without the coord object, for the A* expansion path, where the
   *  `CostFn` boundary passes bare `(x, y)` and allocation per call matters. */
  costAtXY(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return Infinity;
    return TILE_DEFS[this.kinds[this.index(x, y)]!].cost;
  }

  /**
   * The `TileDef` governing a cell. Throws out of bounds like `kindAt`: its
   * readers (combat, status hooks) key off a live unit's position, so an
   * out-of-bounds read is a bug, unlike pathfinding's, which `costAt` answers
   * with `Infinity`.
   */
  defAt(c: GridCoord): TileDef {
    return TILE_DEFS[this.kindAt(c)];
  }

  /**
   * A count of `setKind` calls, so a memo can tell "tiles unchanged" in O(1)
   * (the bot's chokeHold memo, `src/bot/scripts/chokeHold.ts`). Not
   * serialized: a rehydrated grid restarts at 0, so compare it only within
   * one grid instance (that memo keys per World). The sim never reads it.
   */
  private _mutations = 0;
  get mutations(): number {
    return this._mutations;
  }

  setKind(c: GridCoord, kind: TileKind): void {
    if (!this.inBounds(c)) {
      throw new Error(`TileGrid.setKind: out of bounds (${c.x}, ${c.y})`);
    }
    this.kinds[this.index(c.x, c.y)] = kind;
    this._mutations++;
  }

  inBounds(c: GridCoord): boolean {
    return c.x >= 0 && c.y >= 0 && c.x < this.width && c.y < this.height;
  }

  /** Iterate every cell in row-major order; `battleSetup` copies generated
   *  terrain onto the battle grid with it. */
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
