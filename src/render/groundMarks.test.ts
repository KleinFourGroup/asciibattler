import { describe, it, expect } from 'vitest';
import {
  BIN_DEPTH,
  BIN_MARGIN,
  DEFAULT_MARK_STYLE,
  MAX_MARKS,
  MarkTable,
  isDashedPlate,
  markExtent,
  markShapeOf,
  type Mark,
  type MarkShape,
} from './groundMarks';

// The known answers are re-derived here, not read from the binner:
//  - a tile is the unit square about its `gridToWorld` centre,
//    (gx + 0.5 − W/2, H/2 − gy − 0.5);
//  - a contact shape is the §106 mock's: three's CircleGeometry (n segments
//    from θ0) laid flat by rotateX(−π/2), which sends (x, y) to world (x, −y);
//    the circle is a true circle (the mock's 40-gon, less its facets);
//  - a plate is the axis-aligned square of its half-side.

const W = 7;
const H = 5;

function tileCentre(gx: number, gy: number): [number, number] {
  return [gx + 0.5 - W / 2, H / 2 - gy - 0.5];
}

function polygon(n: number, theta0: number, r: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const a = theta0 + (2 * Math.PI * k) / n;
    out.push([r * Math.cos(a), -r * Math.sin(a)]);
  }
  return out;
}

function insideConvex(poly: [number, number][], px: number, pz: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i]!;
    const [bx, bz] = poly[(i + 1) % poly.length]!;
    const c = (bx - ax) * (pz - az) - (bz - az) * (px - ax);
    if (Math.abs(c) < 1e-12) continue;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

function inside(m: Mark, px: number, pz: number): boolean {
  const dx = px - m.x;
  const dz = pz - m.z;
  switch (m.shape) {
    case 'circle':
      return dx * dx + dz * dz <= m.extent * m.extent;
    case 'diamond':
      return insideConvex(polygon(4, 0, m.extent), dx, dz);
    case 'triangle':
      return insideConvex(polygon(3, Math.PI / 2, m.extent), dx, dz);
    case 'plate':
      return Math.abs(dx) <= m.extent && Math.abs(dz) <= m.extent;
  }
}

function mark(x: number, z: number, shape: MarkShape, extent: number, extra: Partial<Mark> = {}): Mark {
  return { x, z, shape, extent, dashed: false, r: 1, g: 0.5, b: 0.25, alpha: 1, ...extra };
}

function table(marks: readonly Mark[]): MarkTable {
  const t = new MarkTable();
  t.begin(W, H);
  for (const m of marks) t.add(m);
  t.finish();
  return t;
}

/** Every tile's bin, as a set per tile. */
function allBins(t: MarkTable): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) out.set(`${gx},${gy}`, t.binOf(gx, gy));
  return out;
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

const SHAPES: MarkShape[] = ['circle', 'diamond', 'triangle', 'plate'];

describe('MarkTable binning', () => {
  it('holds every mark in every tile its shape reaches, and no mark past its bound', () => {
    const next = lcg(108);
    const SAMPLES = 13;
    let checked = 0;
    for (let trial = 0; trial < 150; trial++) {
      const marks: Mark[] = [];
      for (let k = 0; k < 6; k++) {
        const shape = SHAPES[Math.floor(next() * 4)]!;
        // Contact marks up to the dial's max (size 1 → r 0.5); plates up to 3×3.
        const extent = shape === 'plate' ? 0.2 + next() * 1.3 : 0.1 + next() * 0.4;
        // Centres anywhere on the board and a little past its edge.
        marks.push(mark((next() - 0.5) * (W + 1), (next() - 0.5) * (H + 1), shape, extent));
      }
      const t = table(marks);
      expect(t.overflow).toBe(0);
      for (const [key, bin] of allBins(t)) {
        const [gx, gy] = key.split(',').map(Number) as [number, number];
        const [cx, cz] = tileCentre(gx, gy);
        marks.forEach((m, i) => {
          // Completeness: a sample of the closed tile inside the true shape ⇒ binned.
          let reached = false;
          for (let a = 0; a < SAMPLES && !reached; a++)
            for (let b = 0; b < SAMPLES && !reached; b++)
              reached = inside(m, cx - 0.5 + a / (SAMPLES - 1), cz - 0.5 + b / (SAMPLES - 1));
          if (reached) expect(bin, `mark ${i} (${m.shape}) reaches tile ${key}`).toContain(i);
          if (!bin.includes(i)) return;
          // Soundness: binned ⇒ the bound (a plate's square, a contact mark's
          // circumscribed circle), grown by the margin, reaches the tile.
          const dx = Math.max(Math.abs(m.x - cx) - 0.5, 0);
          const dz = Math.max(Math.abs(m.z - cz) - 0.5, 0);
          const reach = m.extent + BIN_MARGIN;
          if (m.shape === 'plate') expect(Math.max(dx, dz)).toBeLessThan(reach);
          else expect(Math.hypot(dx, dz)).toBeLessThanOrEqual(reach + 1e-9);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(500); // the property ran on real bins, not an empty board
  });

  it('keeps a standing mark and a footprint plate on their own tiles', () => {
    const style = DEFAULT_MARK_STYLE;
    const [cx, cz] = tileCentre(3, 2);
    const standing = table(
      (['circle', 'diamond', 'triangle'] as const).map((s) => mark(cx, cz, s, markExtent(s, 1, style))),
    );
    for (const [key, bin] of allBins(standing)) expect(bin, key).toEqual(key === '3,2' ? [0, 1, 2] : []);

    for (const n of [1, 2, 3]) {
      // An N×N body's corner cell (1, 1); its plate sits at the footprint centre.
      const [x0, z0] = tileCentre(1, 1);
      const plate = mark(x0 - 0.5 + n / 2, z0 + 0.5 - n / 2, 'plate', markExtent('plate', n, style));
      for (const [key, bin] of allBins(table([plate]))) {
        const [gx, gy] = key.split(',').map(Number) as [number, number];
        const covered = gx >= 1 && gx < 1 + n && gy >= 1 && gy < 1 + n;
        expect(bin, `${n}x${n} plate, tile ${key}`).toEqual(covered ? [0] : []);
      }
    }
  });

  it('fits a planted worst case: a crowded tile at the largest contact size', () => {
    // Tile T = (3, 2), centre (0, 0) on the 7×5 board; contact size 1 (r 0.5).
    const r = markExtent('circle', 1, { ...DEFAULT_MARK_STYLE, contactSize: 1 });
    const crowd = [
      mark(0, 0, 'circle', r), // dying on T while the others move
      mark(0.5, 0, 'diamond', r), // leaving T for its east neighbour
      mark(0, 0.25, 'triangle', r), // arriving from the +z neighbour, three quarters in
      ...[-0.5, 0.5].flatMap((x) => [-0.5, 0.5].map((z) => mark(x, z, 'circle', r))), // diagonals over T's corners
      ...[[-1, 0], [1, 0], [0, -1], [0, 1]].map(([x, z]) => mark(x!, z!, 'diamond', r)), // standing edge neighbours
    ];
    const t = table(crowd);
    expect(t.binOf(3, 2)).toHaveLength(11);
    expect(t.maxBin).toBe(11);
    expect(t.maxBin).toBeLessThanOrEqual(BIN_DEPTH);
    expect(t.overflow).toBe(0);
  });

  it('counts what a full bin drops instead of dropping it silently', () => {
    const [cx, cz] = tileCentre(3, 2);
    const t = table(Array.from({ length: BIN_DEPTH + 4 }, () => mark(cx, cz, 'circle', 0.1)));
    expect(t.binOf(3, 2)).toHaveLength(BIN_DEPTH);
    expect(t.overflow).toBe(4);
    expect(t.maxBin).toBe(BIN_DEPTH + 4);
  });

  it('refuses and counts a mark past the table capacity', () => {
    const t = new MarkTable();
    t.begin(W, H);
    for (let i = 0; i < MAX_MARKS; i++) expect(t.add(mark(0, 0, 'circle', 0.1))).toBe(true);
    expect(t.add(mark(0, 0, 'circle', 0.1))).toBe(false);
    expect(t.count).toBe(MAX_MARKS);
    expect(t.overflow).toBe(1);
  });

  it('puts plates first in a bin, whatever the order they were added', () => {
    const [cx, cz] = tileCentre(2, 2);
    const t = table([mark(cx, cz, 'circle', 0.2), mark(cx, cz, 'plate', 0.44)]);
    expect(t.binOf(2, 2)).toEqual([1, 0]);
  });

  it('bins nothing off the board, and nothing for an invisible mark', () => {
    // On the right board edge: the edge column only; the column past it (a
    // valid texel on a wider board) stays empty.
    const t = table([mark(W / 2, 0, 'circle', 0.3), mark(W, 0, 'circle', 0.3), mark(0, 0, 'circle', 0.3, { alpha: 0 })]);
    expect(t.count).toBe(2);
    expect(t.binOf(W - 1, 2)).toEqual([0]);
    expect(t.binOf(W, 2)).toEqual([]);
    for (const [key, bin] of allBins(t)) if (key !== `${W - 1},2`) expect(bin, key).toEqual([]);
  });

  it('starts each frame empty', () => {
    const t = new MarkTable();
    t.begin(W, H);
    t.add(mark(0, 0, 'circle', 0.3));
    t.finish();
    t.begin(W, H);
    t.finish();
    expect(t.count).toBe(0);
    expect(t.binOf(3, 2)).toEqual([]);
  });

  it('packs marks and bins where the shader reads them', () => {
    // The layout the header documents: mark i at texels 2·(i mod 128) and +1 of
    // row ⌊i / 128⌋ in a 256-wide RGBA texture; tile (gx, gy)'s bin at texels
    // gx·4 … gx·4 + 3 of row gy in a 128-wide one, holding index + 1.
    const t = new MarkTable();
    t.begin(W, H);
    for (let i = 0; i < 131; i++) t.add(mark(i === 130 ? 0.1 : 99, 0.2, i === 130 ? 'triangle' : 'circle', 0.3));
    t.add(mark(-1.2, 0.8, 'plate', 0.44, { dashed: true, r: 0.7, g: 0.5, b: 0.2, alpha: 0.5 }));
    t.finish();
    expect([...t.marks.slice(1040, 1048)]).toEqual([0.1, 0.2, 0.3, 2, 1, 0.5, 0.25, 1].map((v) => Math.fround(v)));
    const p = (1 * 256 + 3 * 2) * 4; // mark 131: row 1, column 3
    expect([...t.marks.slice(p, p + 8)]).toEqual(
      [-1.2, 0.8, 0.44, 7, 0.7, 0.5, 0.2, 0.5].map((v) => Math.fround(v)),
    );
    // Mark 131's plate lies on tile (2, 1): centre (−1, 1). Mark 130 sits on (3, 2).
    expect(t.bins[(1 * 128 + 2 * 4) * 4]).toBe(132);
    expect(t.bins[(2 * 128 + 3 * 4) * 4]).toBe(131);
  });
});

describe('the mark each body gets', () => {
  const body = (team: 'player' | 'enemy' | 'neutral', archetype: string, campId: number | null = null) => ({
    team,
    archetype,
    campId,
  });

  it('separates the four identities by shape', () => {
    expect(markShapeOf(body('player', 'mercenary'))).toBe('circle');
    expect(markShapeOf(body('enemy', 'mercenary'))).toBe('diamond');
    expect(markShapeOf(body('neutral', 'bandit', 3))).toBe('triangle');
    expect(markShapeOf(body('neutral', 'wall'))).toBe('plate');
  });

  it('dashes the frame of a destructible wall or cover only', () => {
    expect(isDashedPlate(body('neutral', 'wall_destructible'))).toBe(true);
    expect(isDashedPlate(body('neutral', 'half_cover_destructible'))).toBe(true);
    for (const archetype of ['wall', 'half_cover', 'rubble_1x1', 'rubble_2x2', 'rubble_3x3']) {
      expect(isDashedPlate(body('neutral', archetype)), archetype).toBe(false);
    }
    expect(isDashedPlate(body('neutral', 'wall_destructible', 1))).toBe(false); // a camp member is a combatant
  });

  it('sizes a contact mark by its footprint and a plate by its footprint less the inset', () => {
    // The signed bookmark's numbers (WORKLOG §108 Kickoff, finding 8).
    expect(DEFAULT_MARK_STYLE).toEqual({
      contactSize: 0.55,
      contactFill: 0.45,
      contactOutline: 0.3,
      contactStroke: 0.16,
      plateInset: 0.06,
      plateStroke: 0.07,
      plateFill: 0.6,
      plateOutline: 0.3,
      plateCorner: 0,
      plateDashGap: 0.1, // 108b's proposal, not the bookmark's: read at stop 1
    });
    expect(markExtent('circle', 1, DEFAULT_MARK_STYLE)).toBeCloseTo(0.275, 12);
    expect(markExtent('plate', 1, DEFAULT_MARK_STYLE)).toBeCloseTo(0.44, 12);
    expect(markExtent('plate', 3, DEFAULT_MARK_STYLE)).toBeCloseTo(1.44, 12);
  });
});
