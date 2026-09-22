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
