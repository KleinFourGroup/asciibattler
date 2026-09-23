import { describe, expect, it } from 'vitest';
import { conformToTiles, type TileTops } from './conform';

/**
 * 106c-post — the conforming cut, against a 2×2 board stated by hand: cell
 * (0,0) is the −x / +z quadrant (grid +y runs toward world −z), (1,0) +x / +z,
 * (0,1) −x / −z, (1,1) +x / −z. Each quadrant gets a distinct height, so a
 * piece on the wrong tile shows up as a wrong Y.
 */

const HEIGHTS: Record<string, number> = { '0,0': 0, '1,0': -0.1, '0,1': -0.2, '1,1': -0.3 };
const TOPS: TileTops = { gridW: 2, gridH: 2, heightAt: (gx, gy) => HEIGHTS[`${gx},${gy}`]! };
const quadrantHeight = (x: number, z: number): number =>
  x < 0 ? (z > 0 ? HEIGHTS['0,0']! : HEIGHTS['0,1']!) : z > 0 ? HEIGHTS['1,0']! : HEIGHTS['1,1']!;

/** A square of half-side h centred on (cx, cz), as two flat triangles. */
const square = (cx: number, cz: number, h: number): number[] => [
  cx - h, cz - h, cx + h, cz - h, cx + h, cz + h,
  cx - h, cz - h, cx + h, cz + h, cx - h, cz + h,
];

function pieces(out: number[]): { area: number; centroid: [number, number]; ys: number[] }[] {
  const res = [];
  for (let i = 0; i < out.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = out.slice(i, i + 9) as number[] as [number, number, number, number, number, number, number, number, number];
    res.push({
      area: Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2,
      centroid: [(ax + bx + cx) / 3, (az + bz + cz) / 3] as [number, number],
      ys: [ay, by, cy],
    });
  }
  return res;
}

describe('106c-post — conformToTiles', () => {
  it('a mark inside one tile stays whole, on that tile’s top', () => {
    const ps = pieces(conformToTiles(square(0.5, 0.5, 0.25), TOPS, 0.01));
    expect(ps.reduce((s, p) => s + p.area, 0)).toBeCloseTo(0.25, 12);
    for (const p of ps) for (const y of p.ys) expect(y).toBeCloseTo(-0.1 + 0.01, 12);
  });

  it('a mark over the four-tile corner splits four ways, each piece on ITS tile, nothing lost or doubled', () => {
    const ps = pieces(conformToTiles(square(0, 0, 0.5), TOPS, 0));
    expect(ps.reduce((s, p) => s + p.area, 0)).toBeCloseTo(1, 12);
    const seen = new Set<number>();
    for (const p of ps) {
      const expected = quadrantHeight(p.centroid[0], p.centroid[1]);
      for (const y of p.ys) expect(y).toBe(expected);
      seen.add(expected);
    }
    expect(seen.size).toBe(4);
  });

  it('a mark straddling one edge (a unit mid-step) splits in two at the edge', () => {
    const ps = pieces(conformToTiles(square(0, 0.5, 0.3), TOPS, 0));
    expect(ps.reduce((s, p) => s + p.area, 0)).toBeCloseTo(0.36, 12);
    const left = ps.filter((p) => p.centroid[0] < 0).reduce((s, p) => s + p.area, 0);
    expect(left).toBeCloseTo(0.18, 12);
    for (const p of ps) for (const y of p.ys) expect(y).toBe(quadrantHeight(p.centroid[0], p.centroid[1]));
  });

  it('the part off the board is dropped', () => {
    const ps = pieces(conformToTiles(square(1, 0.5, 0.25), TOPS, 0)); // half past x = +1
    expect(ps.reduce((s, p) => s + p.area, 0)).toBeCloseTo(0.125, 12);
  });
});

/** The vertical output triangles (all three x equal, or all three z equal), with their true 3-D area. */
function faces(out: number[]): { area: number; plane: string; ys: number[] }[] {
  const res = [];
  for (let i = 0; i < out.length; i += 9) {
    const v = out.slice(i, i + 9) as [number, number, number, number, number, number, number, number, number];
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = v;
    const plane = ax === bx && bx === cx ? `x=${ax}` : az === bz && bz === cz ? `z=${az}` : null;
    if (plane === null) continue;
    const [ux, uy, uz, wx, wy, wz] = [bx - ax, by - ay, bz - az, cx - ax, cy - ay, cz - az];
    const area = Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
    res.push({ area, plane, ys: [ay, by, cy] });
  }
  return res;
}

const areaOn = (fs: ReturnType<typeof faces>, plane: string): number =>
  fs.filter((f) => f.plane === plane).reduce((s, f) => s + f.area, 0);

describe('106c-post2 — the step-face drape', () => {
  const SEES_ALL: TileTops = { ...TOPS, drape: { faces: () => true } };

  it('a mark across a step drapes the face from the high top to the low top, and only from the high side', () => {
    // (0,0) at 0 | (1,0) at −0.1: the face is x = 0, z ∈ [0.2, 0.8], 0.1 tall.
    const fs = faces(conformToTiles(square(0, 0.5, 0.3), SEES_ALL, 0.01));
    expect(fs.reduce((s, f) => s + f.area, 0)).toBeCloseTo(0.6 * 0.1, 12);
    expect(areaOn(fs, 'x=0')).toBeCloseTo(0.06, 12);
    for (const f of fs) for (const y of f.ys) expect([0.01, -0.1 + 0.01]).toContainEqual(y);
  });

  it('the four-way corner drapes all four faces, each between its own pair of tops', () => {
    // x = 0: (0,0)|(1,0) Δ0.1 over z ∈ [0, 0.5] and (0,1)|(1,1) Δ0.1 over z ∈ [−0.5, 0];
    // z = 0: (0,0)|(0,1) Δ0.2 over x ∈ [−0.5, 0] and (1,0)|(1,1) Δ0.2 over x ∈ [0, 0.5].
    const fs = faces(conformToTiles(square(0, 0, 0.5), SEES_ALL, 0));
    expect(areaOn(fs, 'x=0')).toBeCloseTo(0.05 + 0.05, 12);
    expect(areaOn(fs, 'z=0')).toBeCloseTo(0.1 + 0.1, 12);
    expect(fs.reduce((s, f) => s + f.area, 0)).toBeCloseTo(0.3, 12);
  });

  it('a face turned away from the camera gets no drape, and the tops are the same either way', () => {
    const away: TileTops = { ...TOPS, drape: { faces: (nx) => nx !== 1 } };
    const out = conformToTiles(square(0, 0.5, 0.3), away, 0);
    expect(faces(out)).toHaveLength(0);
    expect(out).toEqual(conformToTiles(square(0, 0.5, 0.3), TOPS, 0));
  });

  it('a mark inside one tile drapes nothing', () => {
    expect(faces(conformToTiles(square(0.5, 0.5, 0.25), SEES_ALL, 0))).toHaveLength(0);
  });
});
