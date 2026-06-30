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
import { statusDef } from '../config/statuses';
import type { GridCoord } from '../core/types';

export type TileKind =
  | 'floor'
  | 'shallow_water'
  | 'chasm'
  | 'fire'
  | 'healing'
  // §37b — terrain-depth tiles. Cost + passability here; the combat to-hit
  // mods land in 37c (`evasionMod`/`accuracyMod`), the status hooks in 37d.
  | 'deep_water'
  | 'hills'
  | 'ice'
  | 'sand'
  | 'mud';

/**
 * §37a — the per-`TileKind` surface-property table, generalizing the old flat
 * `TILE_COSTS` map. ONE keyed table that every tile mechanic reads:
 *   - movement **cost** + **passability** (pathfinding) — today's behaviour;
 *   - combat to-hit **mods** (§37c folds `accuracyMod`/`evasionMod` into
 *     `applyDamage`'s precision-vs-evasion roll, generalizing M6's wading
 *     penalty);
 *   - tile→status **hooks on enter** (§37d — mud→poison / water→remove burn).
 *
 * Keyed by kind, **never serialized** (the grid serializes only the `TileKind`
 * string, see `TileGridSnapshot`), so adding a kind or tuning a mod never bumps
 * a snapshot.
 */
export interface TileDef {
  /**
   * Movement cost to ENTER. Pathfinding weights neighbour edges by the
   * destination cell's cost; `Infinity` is the data-driven block (the
   * `!isFinite(stepCost)` short-circuit in `Pathfinding.findPath`).
   *
   * Chebyshev (the A* heuristic) is a lower bound on min-cost path length only
   * when every FINITE cost is >= 1 — keep it >= 1 (GOTCHAS #34: "faster" comes
   * from cost 1, never < 1) or the heuristic stops being admissible.
   */
  cost: number;
  /**
   * Whether a unit may occupy / path onto this tile. Today this is redundant
   * with `isFinite(cost)` (the cost short-circuit is the live gate in
   * pathfinding), but it's carried explicitly so an impassable-but-finite or
   * passable-but-costly tile stays expressible, and so consumers can ask the
   * intent directly rather than inferring it from a magic Infinity.
   */
  passable: boolean;
  /**
   * §37c — added to the **defender's** evasion when it is struck while standing
   * on this tile (positive = harder to hit; e.g. hills bonus, sand penalty).
   * Absent = 0.
   */
  evasionMod?: number;
  /**
   * §37c — added to the **attacker's** precision when it attacks FROM this tile
   * (negative = clumsier footing; generalizes M6's `shallow_water` wading
   * penalty, and ice's severe accuracy hit). Absent = 0.
   */
  accuracyMod?: number;
  /**
   * §37d — status id APPLIED to a unit on ENTER (e.g. `mud` → `poison`, behind
   * a config flag). A plain status id resolved via `statusDef` at the use site;
   * a boot-assert validates the reference (mirroring the ability `statusId`
   * pattern). Absent = none.
   */
  statusOnEnter?: string;
  /**
   * §37d — status id REMOVED from a unit on ENTER (e.g. `shallow_water` /
   * `deep_water` → remove `burn` — the inverse of the Cluster-1 fire→burn
   * sustain). Absent = none.
   */
  statusRemovedOnEnter?: string;
}

/**
 * The shipped tile table. Existing kinds carry today's cost + no mods (§37a is
 * byte-identical); §37b–d fill in the new tiles and the mod/status fields.
 *
 * D7.A: `chasm` is `Infinity`/impassable — pathfinding short-circuits via the
 * `!isFinite(stepCost)` guard. LOS is a unit-blocker check (`LineOfSight.ts`),
 * so chasm is automatically LOS-transparent — tiles never enter the LOS
 * pipeline.
 *
 * D7.B: `fire` and `healing` are surface effects, not obstacles — normal floor
 * cost (1). Their per-tick chip is applied by `World.tick`'s tile-effect pass
 * (`applyTileStatuses`), not by pathfinding.
 */
export const TILE_DEFS: Record<TileKind, TileDef> = {
  floor: { cost: 1, passable: true },
  // §37c — `shallow_water`'s `accuracyMod: -10` is the M6 "bog-down" wading
  // penalty, now OWNED by this table (the source for every tile combat mod) and
  // read by `World.applyDamage`'s to-hit fold. -10 precision × 0.02 = -20% to
  // hit while wading — byte-identical to the retired `STATS.waterPrecisionPenalty`.
  // §37d — `statusRemovedOnEnter: 'burn'`: wading douses fire (the inverse of the
  // fire→burn sustain). Always on (not gated by `applyStatusOnEnter`).
  shallow_water: { cost: 2, passable: true, accuracyMod: -10, statusRemovedOnEnter: 'burn' },
  chasm: { cost: Infinity, passable: false },
  fire: { cost: 1, passable: true },
  healing: { cost: 1, passable: true },
  // §37b cost/passability + §37c combat mods. All STARTING values (§41 tunes);
  // for costs only the relative ordering + the ≥1 floor are load-bearing. Mods
  // fold into the to-hit roll at 0.02/pt: `accuracyMod` docks the ATTACKER's
  // precision (it's standing here), `evasionMod` shifts the DEFENDER's evasion.
  //   - deep_water — impassable like chasm (cost ∞); the future marine/waterwalk
  //     traversal that crosses it is a declared-inert seam (no field yet). No
  //     combat mod — nothing stands on it.
  //   - hills — slow (climb) + evasion BONUS (+8 → +16% harder to hit: high ground).
  //   - ice — the cost-1 floor ("faster" = floor cost, never < 1, GOTCHAS #34 —
  //     keeps the Chebyshev A* heuristic admissible) + a severe accuracy penalty
  //     (-12 → -24% to hit: slick footing).
  //   - sand — slow + evasion PENALTY (-6 → -12% easier to hit: exposed footing).
  //   - mud — the worst passable mobility (deep_water on foot) + a severe accuracy
  //     penalty (-12) + mud→poison on enter (37d, gated by `applyStatusOnEnter`).
  // §37d status hooks: deep_water douses burn like shallow water (`statusRemovedOnEnter`,
  // always on); mud applies poison on enter (`statusOnEnter`, the flag-gated trial).
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
 * §37d boot check (the `assertStatusRefsResolve` / `assertSummonRefsResolve`
 * sibling): every `statusOnEnter` / `statusRemovedOnEnter` in the tile table must
 * reference a real status id, so a typo fails at module load rather than at the
 * moment a unit steps on the tile. `statusDef` throws loudly on a miss — calling
 * it here IS the assertion. Rides this guaranteed-at-import IIFE.
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
    if (!this.inBounds(c)) return Infinity;
    return TILE_DEFS[this.kinds[this.index(c.x, c.y)]!].cost;
  }

  /**
   * §37 — the full `TileDef` governing a cell (cost / passability / combat mods
   * / status hooks). Throws out-of-bounds like `kindAt`: combat + status reads
   * key off a live unit's in-bounds position, so an OOB read is a bug, not a
   * "treat as impassable" case (that's `costAt`'s job for pathfinding).
   */
  defAt(c: GridCoord): TileDef {
    return TILE_DEFS[this.kindAt(c)];
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
