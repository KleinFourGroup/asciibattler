/**
 * The ground marks' table (Round 7.5 spec D3, built at 108a): what the
 * terrain shader draws under every body, rebuilt each frame and binned per
 * tile, so a terrain fragment evaluates only the few marks that can reach its
 * tile. THREE-free (the `spriteColor.ts` precedent): the binning is what a
 * headless test can pin, and the shader side only reads what this packs.
 *
 * The look is the §106 bookmark's, signed at the 106c–106d reads:
 *  - one mark per combatant, its side's SHAPE (a circle for yours, a diamond
 *    for the enemy's, a triangle for an active camp) at contact size, filled
 *    dark and outlined in the body's colour;
 *  - a PLATE under every scenery body: its footprint less an inset, filled
 *    dark and framed in the body's colour. A destructible wall or cover gets a
 *    DASHED frame (the §108 kickoff's answer to `CRACKED_STONE` being its only
 *    tell), so the tell survives the grey read as a shape.
 * The shapes are world shapes on the ground plane; the shader lays them on the
 * terrain wherever it is drawn (tops, step faces, hill mounds). At yaw 45 the
 * enemy's world diamond draws as a screen rectangle while the tile and the
 * plate draw as screen diamonds, and the four stay distinct.
 *
 * Geometry, world XZ about the mark's centre, `extent` = the vertex radius r
 * (the mock's `CircleGeometry` radius) or, for a plate, the half-side:
 *  - circle: radius r;
 *  - diamond: vertices (±r, 0) and (0, ±r), on the grid axes;
 *  - triangle: apex (0, −r), toward world −z (grid +y), base (±r·√3/2, r/2);
 *  - plate: the axis-aligned square |dx|, |dz| ≤ h.
 */

import type { Team } from '../sim/Unit';
import { LAYOUT_MAX_SIDE } from '../config/layouts';
import { isDestructibleObstacle } from './spriteColor';

export type MarkShape = 'circle' | 'diamond' | 'triangle' | 'plate';

/** The shader's shape code, texel 0's `w` (plus `DASHED_BIT` for a dashed plate). */
export const SHAPE_CODE: Record<MarkShape, number> = { circle: 0, diamond: 1, triangle: 2, plate: 3 };
export const DASHED_BIT = 4;

/**
 * The look's numbers. The defaults are the signed bookmark's (WORKLOG §108
 * Kickoff, finding 8); the explorer dials them for the stop-1 read.
 */
export interface MarkStyle {
  /** A combatant mark's size across its vertices, in tiles, per footprint tile. */
  readonly contactSize: number;
  /** The combatant mark's dark fill opacity. */
  readonly contactFill: number;
  /** The combatant mark's outline opacity. */
  readonly contactOutline: number;
  /** The outline's width as a fraction of the vertex radius, measured ALONG the
   *  radius (the mock's ring), so across an edge it is r·stroke·cos(π/n). */
  readonly contactStroke: number;
  /** A plate's inset from its footprint's edge, world units. */
  readonly plateInset: number;
  /** A plate frame's width, world units. */
  readonly plateStroke: number;
  /** The plate's dark fill opacity. */
  readonly plateFill: number;
  /** The plate frame's opacity. */
  readonly plateOutline: number;
  /** The plate's corner radius, world units (0 = square; the spec's open read). */
  readonly plateCorner: number;
}

export const DEFAULT_MARK_STYLE: MarkStyle = {
  contactSize: 0.55,
  contactFill: 0.45,
  contactOutline: 0.3,
  contactStroke: 0.16,
  plateInset: 0.06,
  plateStroke: 0.07,
  plateFill: 0.6,
  plateOutline: 0.3,
  plateCorner: 0,
};

/**
 * How far past its shape a mark is binned, world units. The shader's
 * anti-aliased edge reaches about half a pixel beyond the shape, and a tile at
 * fit spans tens of pixels, so 0.05 covers it with room. It stays under
 * `plateInset`, so a 1×1 plate is binned into its own tile only.
 */
export const BIN_MARGIN = 0.05;

/** Marks one tile can hold. A planted worst case needs 11 (the test); the
 *  live peak is reported by `maxBin`. */
export const BIN_DEPTH = 16;
/** Mark indices per bin texel (RGBA). */
const BIN_LANES = 4;
const BIN_TEXELS = BIN_DEPTH / BIN_LANES;

/** The largest table: one body per tile on the largest board, twice over for
 *  bodies fading out where new ones stand. */
export const MAX_MARKS = 2 * LAYOUT_MAX_SIDE * LAYOUT_MAX_SIDE;
/** Texels per mark: (x, z, extent, shape code) and (r, g, b, alpha). */
const MARK_TEXELS = 2;
const MARKS_PER_ROW = 128;

/** The marks texture (RGBA32F): mark i's texels at x = 2·(i mod 128) and
 *  x + 1, y = ⌊i / 128⌋. */
export const MARKS_TEX_W = MARKS_PER_ROW * MARK_TEXELS;
export const MARKS_TEX_H = MAX_MARKS / MARKS_PER_ROW;
/** The bins texture (RGBA32F): tile (gx, gy)'s k-th texel at
 *  x = gx·4 + k, y = gy, holding four mark indices + 1 (0 = empty, and the
 *  list stops at the first 0). */
export const BINS_TEX_W = LAYOUT_MAX_SIDE * BIN_TEXELS;
export const BINS_TEX_H = LAYOUT_MAX_SIDE;

/** What a mark needs to know about the body it lies under. */
export interface MarkSubject {
  readonly team: Team;
  readonly archetype: string;
  readonly campId: number | null;
}

/** The side's shape: yours, the enemy's, an active camp, or scenery's plate. */
export function markShapeOf(subject: MarkSubject): MarkShape {
  if (subject.team === 'player') return 'circle';
  if (subject.team === 'enemy') return 'diamond';
  return subject.campId !== null ? 'triangle' : 'plate';
}

/** A destructible wall or cover: the §40c `CRACKED_STONE` tell's bodies. Rubble
 *  keeps a solid frame (it carries its own glyph, like its colour rule). */
export function isDashedPlate(subject: MarkSubject): boolean {
  return markShapeOf(subject) === 'plate' && isDestructibleObstacle(subject.archetype);
}

export interface Mark {
  /** World XZ of the mark's centre: a 1×1 body's sprite ground point, an N×N
   *  body's `footprintCentre` (never its slid sprite anchor). */
  readonly x: number;
  readonly z: number;
  readonly shape: MarkShape;
  /** The vertex radius, or a plate's half-side, world units. */
  readonly extent: number;
  readonly dashed: boolean;
  /** The outline colour, linear RGB (the body's `spriteColorForUnit`). */
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** The body sprite's alpha: the whole mark fades with its glyph. */
  readonly alpha: number;
}

/** A body's mark shape and extent under `style`: a combatant's contact size
 *  scales with its footprint; a plate covers its footprint less the inset. */
export function markExtent(shape: MarkShape, footprint: number, style: MarkStyle): number {
  return shape === 'plate'
    ? footprint / 2 - style.plateInset
    : (style.contactSize / 2) * footprint;
}

/**
 * One frame's marks, packed for the shader. `begin` → `add` per body →
 * `finish`; the two arrays are then ready to upload as they are.
 */
export class MarkTable {
  readonly marks = new Float32Array(MARKS_TEX_W * MARKS_TEX_H * 4);
  readonly bins = new Float32Array(BINS_TEX_W * BINS_TEX_H * 4);
  /** Marks in the table this frame. */
  count = 0;
  /** Placements dropped this frame: a mark past `MAX_MARKS`, or a mark a full
   *  bin could not take (counted per tile). Zero in any sound frame. */
  overflow = 0;
  /** The most marks any one tile wanted this frame, before any drop. */
  maxBin = 0;
  private gridW = 0;
  private gridH = 0;
  private readonly binCount = new Uint8Array(LAYOUT_MAX_SIDE * LAYOUT_MAX_SIDE);
  private readonly binDemand = new Uint16Array(LAYOUT_MAX_SIDE * LAYOUT_MAX_SIDE);

  begin(gridW: number, gridH: number): void {
    if (gridW > LAYOUT_MAX_SIDE || gridH > LAYOUT_MAX_SIDE) {
      throw new Error(`MarkTable: ${gridW}x${gridH} exceeds ${LAYOUT_MAX_SIDE}`);
    }
    this.gridW = gridW;
    this.gridH = gridH;
    this.count = 0;
    this.overflow = 0;
    this.maxBin = 0;
  }

  /** Add one mark; false (and counted) when the table is full or the mark is
   *  invisible (alpha 0 draws nothing, so it takes no bin). */
  add(mark: Mark): boolean {
    if (!(mark.alpha > 0)) return false;
    if (this.count >= MAX_MARKS) {
      this.overflow++;
      return false;
    }
    const i = this.count++;
    const o = markTexel(i) * 4;
    const m = this.marks;
    m[o] = mark.x;
    m[o + 1] = mark.z;
    m[o + 2] = mark.extent;
    m[o + 3] = SHAPE_CODE[mark.shape] + (mark.dashed ? DASHED_BIT : 0);
    m[o + 4] = mark.r;
    m[o + 5] = mark.g;
    m[o + 6] = mark.b;
    m[o + 7] = mark.alpha;
    return true;
  }

  /** Bin every mark into the tiles it can reach, plates before combatants in
   *  each tile (the shader draws in bin order: plates under contact marks). */
  finish(): void {
    this.bins.fill(0);
    this.binCount.fill(0);
    this.binDemand.fill(0);
    for (const platesPass of [true, false]) {
      for (let i = 0; i < this.count; i++) {
        const code = this.marks[markTexel(i) * 4 + 3]!;
        if (((code % DASHED_BIT) === SHAPE_CODE.plate) !== platesPass) continue;
        this.forEachTile(i, (gx, gy) => this.binInto(gx, gy, i));
      }
    }
  }

  /** The mark indices in tile (gx, gy)'s bin, in draw order — for tests and probes. */
  binOf(gx: number, gy: number): number[] {
    const out: number[] = [];
    for (let k = 0; k < BIN_DEPTH; k++) {
      const v = this.bins[binLane(gx, gy, k)]!;
      if (v === 0) break;
      out.push(v - 1);
    }
    return out;
  }

  private binInto(gx: number, gy: number, i: number): void {
    const tile = gy * LAYOUT_MAX_SIDE + gx;
    const demand = ++this.binDemand[tile]!;
    if (demand > this.maxBin) this.maxBin = demand;
    const n = this.binCount[tile]!;
    if (n >= BIN_DEPTH) {
      this.overflow++;
      return;
    }
    this.bins[binLane(gx, gy, n)] = i + 1;
    this.binCount[tile] = n + 1;
  }

  /** The on-board tiles mark `i` can reach: a plate's square, or a contact
   *  mark's circumscribed circle, each grown by `BIN_MARGIN`. */
  private forEachTile(i: number, visit: (gx: number, gy: number) => void): void {
    const o = markTexel(i) * 4;
    const x = this.marks[o]!;
    const z = this.marks[o + 1]!;
    const reach = this.marks[o + 2]! + BIN_MARGIN;
    const plate = this.marks[o + 3]! % DASHED_BIT === SHAPE_CODE.plate;
    const halfW = this.gridW / 2;
    const halfH = this.gridH / 2;
    // gridToWorld: cell (gx, gy) spans x ∈ [gx − W/2, gx + 1 − W/2] and
    // z ∈ [H/2 − gy − 1, H/2 − gy] (grid +y runs toward world −z).
    const gx0 = Math.max(0, Math.floor(x - reach + halfW));
    const gx1 = Math.min(this.gridW - 1, Math.ceil(x + reach + halfW) - 1);
    const gy0 = Math.max(0, Math.floor(halfH - (z + reach)));
    const gy1 = Math.min(this.gridH - 1, Math.ceil(halfH - (z - reach)) - 1);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        if (!plate) {
          const x0 = gx - halfW;
          const z1 = halfH - gy;
          const dx = Math.max(x0 - x, 0, x - (x0 + 1));
          const dz = Math.max(z1 - 1 - z, 0, z - z1);
          if (dx * dx + dz * dz > reach * reach) continue;
        }
        visit(gx, gy);
      }
    }
  }
}

/** Mark i's first texel, as a texel index into `marks`. */
function markTexel(i: number): number {
  return Math.floor(i / MARKS_PER_ROW) * MARKS_TEX_W + (i % MARKS_PER_ROW) * MARK_TEXELS;
}

/** The float index of tile (gx, gy)'s k-th bin slot. */
function binLane(gx: number, gy: number, k: number): number {
  const texel = gy * BINS_TEX_W + gx * BIN_TEXELS + Math.floor(k / BIN_LANES);
  return texel * 4 + (k % BIN_LANES);
}
