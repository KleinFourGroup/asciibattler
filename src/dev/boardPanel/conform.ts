/**
 * 106c-post — a flat ground mark CONFORMED to the tile tops (the user's two
 * flags at the 106c read: the N×N plate "looks flat when the terrain clearly
 * isn't", and a unit's mark must follow the tiles as it crosses an edge).
 *
 * The board's ground is a staircase of FLAT-topped prisms (TerrainRenderer:
 * one height per cell), so a mark cut per tile and laid on each tile's own top
 * follows the ground exactly — on the tops. It does not follow the §37b hill
 * mounds; that wants the marks drawn BY the terrain (a decal in its shader) —
 * a build decision for the Round 7.5 spec.
 *
 * 106c-post2 — THE STEP-FACE DRAPE (the user's one refinement at the 106c-post
 * read): with a `drape` view, a piece whose edge lies on its tile's boundary
 * with a LOWER neighbour continues down that vertical face, from its own top
 * to the neighbour's, so a mark crossing a step no longer shows the bare face
 * between its two halves. That is what a terrain decal sampled by world XZ
 * would draw on a vertical face (the mark's edge stretched down), so this mock
 * previews that path. Only faces turned toward the camera get one: under the
 * `overlay` cue depth (no depth test) a face turned away would paint over the
 * taller tile's top.
 *
 * Pure: flat triangles in world XZ in, triangles in world XYZ out.
 */

export interface TileTops {
  readonly gridW: number;
  readonly gridH: number;
  /** Tile-top world Y of cell (gx, gy) — `TerrainRenderer.heightAt` with its kind. */
  heightAt(gx: number, gy: number): number;
  /** 106c-post2 — drape the step faces this view can see; absent = the tops only. */
  readonly drape?: DrapeView;
}

export interface DrapeView {
  /** Is the vertical face with outward normal (nx, 0, nz) through world (x, z) turned toward the camera? */
  faces(nx: number, nz: number, x: number, z: number): boolean;
}

type Pt = readonly [number, number];

/**
 * The smallest piece kept, world units². A clip hugging a tile edge makes
 * slivers a few 1e-7 wide: sound in doubles, zero-width once the positions
 * are stored as float32 (the pane probe caught 15 per 400 frames, all area 0,
 * all ON an edge). 1e-6 of a tile is ~0.01 px² at fit — nothing visible goes.
 */
const MIN_AREA = 1e-6;

/** Sutherland–Hodgman against one half-plane `keep(p)`, crossing at `cut(a, b)`. */
function clipHalf(poly: Pt[], keep: (p: Pt) => boolean, cut: (a: Pt, b: Pt) => Pt): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ka = keep(a);
    const kb = keep(b);
    if (ka) out.push(a);
    if (ka !== kb) out.push(cut(a, b));
  }
  return out;
}

function signedArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

const atX = (x: number) => (a: Pt, b: Pt): Pt => {
  const t = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + t * (b[1] - a[1])];
};
const atZ = (z: number) => (a: Pt, b: Pt): Pt => {
  const t = (z - a[1]) / (b[1] - a[1]);
  return [a[0] + t * (b[0] - a[0]), z];
};

/**
 * `tris` holds flat triangles as (x, z) pairs — six numbers per triangle.
 * Returns world positions (x, y, z) — nine numbers per output triangle: each
 * input triangle clipped to every tile it overlaps and lifted to that tile's
 * top + `lift`. Pieces off the board are dropped. The grid mapping is
 * `gridToWorld`'s: cell (gx, gy) spans x ∈ [gx − W/2, gx + 1 − W/2] and
 * z ∈ [H/2 − gy − 1, H/2 − gy] (grid +y runs toward world −z). With
 * `tops.drape`, each piece's edges on a step down also emit a vertical quad in
 * the face's plane, from this top + `lift` to the neighbour's top + `lift`, so
 * it meets both pieces edge to edge (no overlap to double-blend).
 */
export function conformToTiles(tris: ArrayLike<number>, tops: TileTops, lift: number): number[] {
  const out: number[] = [];
  const halfW = tops.gridW / 2;
  const halfH = tops.gridH / 2;
  for (let t = 0; t + 5 < tris.length; t += 6) {
    const tri: Pt[] = [
      [tris[t]!, tris[t + 1]!],
      [tris[t + 2]!, tris[t + 3]!],
      [tris[t + 4]!, tris[t + 5]!],
    ];
    const xs = tri.map((p) => p[0]);
    const zs = tri.map((p) => p[1]);
    const gx0 = Math.max(0, Math.floor(Math.min(...xs) + halfW));
    const gx1 = Math.min(tops.gridW - 1, Math.floor(Math.max(...xs) + halfW));
    const gy0 = Math.max(0, Math.floor(halfH - Math.max(...zs)));
    const gy1 = Math.min(tops.gridH - 1, Math.floor(halfH - Math.min(...zs)));
    for (let gy = gy0; gy <= gy1; gy++)
      for (let gx = gx0; gx <= gx1; gx++) {
        const x0 = gx - halfW;
        const x1 = x0 + 1;
        const z1 = halfH - gy;
        const z0 = z1 - 1;
        let poly = clipHalf(tri, (p) => p[0] >= x0, atX(x0));
        if (poly.length >= 3) poly = clipHalf(poly, (p) => p[0] <= x1, atX(x1));
        if (poly.length >= 3) poly = clipHalf(poly, (p) => p[1] >= z0, atZ(z0));
        if (poly.length >= 3) poly = clipHalf(poly, (p) => p[1] <= z1, atZ(z1));
        // A triangle that only TOUCHES a tile (a vertex or an edge on its
        // boundary) clips to a zero-area polygon — no sliver is emitted.
        if (poly.length < 3 || Math.abs(signedArea(poly)) < MIN_AREA) continue;
        const y = tops.heightAt(gx, gy) + lift;
        for (let i = 1; i + 1 < poly.length; i++) {
          const fan: Pt[] = [poly[0]!, poly[i]!, poly[i + 1]!];
          // A clip at a tile CORNER can repeat a vertex, so a fan triangle of
          // a sound polygon can still be a zero-area sliver on the boundary.
          if (Math.abs(signedArea(fan)) < MIN_AREA) continue;
          for (const p of fan) out.push(p[0], y, p[1]);
        }
        if (tops.drape) drapeEdges(poly, gx, gy, x0, x1, z0, z1, y, tops, lift, out);
      }
  }
  return out;
}

/**
 * 106c-post2 — one piece's drapes. A clipped edge on the tile boundary sits
 * EXACTLY on it (`atX` / `atZ` return the boundary value itself), so equality
 * finds the edges. Only the higher side drapes a face; the lower side's piece
 * meets the drape's foot.
 */
function drapeEdges(
  poly: Pt[],
  gx: number,
  gy: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
  tops: TileTops,
  lift: number,
  out: number[],
): void {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    let nx = 0;
    let nz = 0;
    if (a[0] === x0 && b[0] === x0) nx = -1;
    else if (a[0] === x1 && b[0] === x1) nx = 1;
    else if (a[1] === z0 && b[1] === z0) nz = -1; // world −z is grid +y
    else if (a[1] === z1 && b[1] === z1) nz = 1;
    else continue;
    const ngx = gx + nx;
    const ngy = gy - nz;
    if (ngx < 0 || ngx >= tops.gridW || ngy < 0 || ngy >= tops.gridH) continue;
    const foot = tops.heightAt(ngx, ngy) + lift;
    if ((y - foot) * Math.hypot(b[0] - a[0], b[1] - a[1]) < MIN_AREA) continue; // no step down, or a sliver
    if (!tops.drape!.faces(nx, nz, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) continue;
    out.push(a[0], y, a[1], b[0], y, b[1], b[0], foot, b[1]);
    out.push(a[0], y, a[1], b[0], foot, b[1], a[0], foot, a[1]);
  }
}
