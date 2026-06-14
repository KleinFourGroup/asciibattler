import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { TERRAIN } from '../config/terrain';
import {
  sampleProceduralParams,
  generateProceduralMap,
  type ProceduralMapResult,
  type ResolvedMapParams,
  type Symmetry,
} from './proceduralMap';

const P = TERRAIN.procedural;

// Possible discrete values are the weighted-int keys carrying positive weight.
const allowedInts = (w: Record<string, number>): number[] =>
  Object.entries(w)
    .filter(([, weight]) => weight > 0)
    .map(([k]) => Number(k));

const allowedSymmetries = Object.entries(P.symmetry)
  .filter(([, weight]) => weight > 0)
  .map(([k]) => k);

// The number of knobs that consume a draw (everything but the fixed guard rail).
const SAMPLED_KNOB_COUNT = Object.keys(P).length - 1;

describe('sampleProceduralParams', () => {
  it('is deterministic for a given seed', () => {
    const a = sampleProceduralParams(new RNG(1234), P);
    const b = sampleProceduralParams(new RNG(1234), P);
    expect(a).toEqual(b);
  });

  it('passes the fixed guard rail through unsampled', () => {
    expect(sampleProceduralParams(new RNG(0), P).wallCapFraction).toBe(P.wallCapFraction);
  });

  it('consumes exactly one draw per sampled knob', () => {
    const rng = new RNG(55);
    const probe = RNG.fromJSON(rng.toJSON());
    sampleProceduralParams(rng, P);
    for (let i = 0; i < SAMPLED_KNOB_COUNT; i++) probe.next();
    expect(rng.toJSON()).toEqual(probe.toJSON());
  });

  it('keeps every sampled knob within its configured envelope', () => {
    const crossbarVals = allowedInts(P.crossbars);
    const gapVals = allowedInts(P.gapsPerBar);
    const dividerVals = allowedInts(P.dividers);
    for (let seed = 0; seed < 500; seed++) {
      const p = sampleProceduralParams(new RNG(seed), P);

      expect(allowedSymmetries).toContain(p.symmetry);
      expect(crossbarVals).toContain(p.crossbars);
      expect(gapVals).toContain(p.gapsPerBar);
      expect(dividerVals).toContain(p.dividers);

      expect(Number.isInteger(p.gapWidth)).toBe(true);
      expect(p.gapWidth).toBeGreaterThanOrEqual(P.gapWidth.min);
      expect(p.gapWidth).toBeLessThanOrEqual(P.gapWidth.max);

      expect(Number.isInteger(p.noiseScale)).toBe(true);
      expect(p.noiseScale).toBeGreaterThanOrEqual(P.noiseScale.min);
      expect(p.noiseScale).toBeLessThanOrEqual(P.noiseScale.max);

      expect(p.fordChance).toBeGreaterThanOrEqual(P.fordChance.min);
      expect(p.fordChance).toBeLessThanOrEqual(P.fordChance.max);
      expect(p.crossbarWaver).toBeGreaterThanOrEqual(P.crossbarWaver.min);
      expect(p.crossbarWaver).toBeLessThanOrEqual(P.crossbarWaver.max);
      expect(p.coverDensity).toBeGreaterThanOrEqual(P.coverDensity.min);
      expect(p.coverDensity).toBeLessThanOrEqual(P.coverDensity.max);
      expect(p.windowChance).toBeGreaterThanOrEqual(P.windowChance.min);
      expect(p.windowChance).toBeLessThanOrEqual(P.windowChance.max);
      expect(p.poolDensity).toBeGreaterThanOrEqual(P.poolDensity.min);
      expect(p.poolDensity).toBeLessThanOrEqual(P.poolDensity.max);
    }
  });

  it('produces variety: crossbar count spans more than one value over seeds', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      seen.add(sampleProceduralParams(new RNG(seed), P).crossbars);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('exercises every positively-weighted symmetry mode over enough seeds', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 500; seed++) {
      seen.add(sampleProceduralParams(new RNG(seed), P).symmetry);
    }
    for (const mode of allowedSymmetries) expect(seen).toContain(mode);
  });
});

const W = 14;
const H = 14;

const makeParams = (over: Partial<ResolvedMapParams> = {}): ResolvedMapParams => ({
  symmetry: 'point',
  crossbars: 2,
  gapsPerBar: 1,
  gapWidth: 2,
  fordChance: 0.5,
  crossbarWaver: 1,
  dividers: 1,
  coverDensity: 0.15,
  windowChance: 0.12,
  poolDensity: 0.08,
  noiseScale: 3,
  wallCapFraction: 0.22,
  ...over,
});

function waterCount(r: ProceduralMapResult): number {
  let n = 0;
  for (const c of r.tileGrid.cells()) if (c.kind === 'shallow_water') n++;
  return n;
}

// BFS between the two spawn-region centroids over passable cells (floor +
// water), blocking walls AND half-cover — the generator's own passability.
function connected(r: ProceduralMapResult, gridW: number, gridH: number): boolean {
  const blocked = new Set<string>();
  for (const c of [...r.walls, ...r.halfCovers]) blocked.add(`${c.x},${c.y}`);
  const cen = (tiles: { x: number; y: number }[]): { x: number; y: number } => ({
    x: Math.round(tiles.reduce((s, t) => s + t.x, 0) / tiles.length),
    y: Math.round(tiles.reduce((s, t) => s + t.y, 0) / tiles.length),
  });
  const start = cen(r.spawnRegions[0]!.tiles);
  const goal = cen(r.spawnRegions[1]!.tiles);
  if (blocked.has(`${start.x},${start.y}`) || blocked.has(`${goal.x},${goal.y}`)) return false;
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    if (c.x === goal.x && c.y === goal.y) return true;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = c.x + dx;
        const ny = c.y + dy;
        const k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH || seen.has(k) || blocked.has(k)) continue;
        seen.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return false;
}

function assertSymmetric(symmetry: 'point' | 'mirror'): void {
  const r = generateProceduralMap(new RNG(11), W, H, makeParams({ symmetry }));
  const band = Math.min(8, W);
  const bandX0 = Math.floor((W - band) / 2);
  const isSpawn = (x: number, y: number): boolean =>
    (y === 0 || y === H - 1) && x >= bandX0 && x < bandX0 + band;
  const partner = (x: number, y: number): { x: number; y: number } =>
    symmetry === 'point' ? { x: W - 1 - x, y: H - 1 - y } : { x, y: H - 1 - y };
  const obstacles = new Set([...r.walls, ...r.halfCovers].map((c) => `${c.x},${c.y}`));
  const isWater = (x: number, y: number): boolean => r.tileGrid.kindAt({ x, y }) === 'shallow_water';
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isSpawn(x, y)) continue;
      const p = partner(x, y);
      expect(obstacles.has(`${x},${y}`)).toBe(obstacles.has(`${p.x},${p.y}`));
      expect(isWater(x, y)).toBe(isWater(p.x, p.y));
    }
  }
}

describe('generateProceduralMap', () => {
  it('is deterministic for the same rng seed + params', () => {
    const p = makeParams();
    const a = generateProceduralMap(new RNG(5), W, H, p);
    const b = generateProceduralMap(new RNG(5), W, H, p);
    expect(a.walls).toEqual(b.walls);
    expect(a.halfCovers).toEqual(b.halfCovers);
    expect(a.chokeCells).toEqual(b.chokeCells);
    expect(a.stats).toEqual(b.stats);
    expect(a.tileGrid.toJSON()).toEqual(b.tileGrid.toJSON());
  });

  it('stats agree with the emitted geometry', () => {
    const r = generateProceduralMap(new RNG(8), W, H, makeParams());
    expect(r.stats.walls).toBe(r.walls.length);
    expect(r.stats.halfCovers).toBe(r.halfCovers.length);
    expect(r.stats.water).toBe(waterCount(r));
    expect(r.stats.chokepoints).toBe(r.chokeCells.length);
    expect(r.stats.connected).toBe(true);
  });

  it('emits two 8-tile `both` spawn bands, kept clear', () => {
    const r = generateProceduralMap(new RNG(3), W, H, makeParams());
    expect(r.spawnRegions.length).toBe(2);
    const obstacles = new Set([...r.walls, ...r.halfCovers].map((c) => `${c.x},${c.y}`));
    for (const region of r.spawnRegions) {
      expect(region.availability).toBe('both');
      expect(region.tiles.length).toBe(8);
      for (const t of region.tiles) {
        expect(r.tileGrid.kindAt(t)).toBe('floor');
        expect(obstacles.has(`${t.x},${t.y}`)).toBe(false);
      }
    }
  });

  it('always connects the spawn bands, across seeds and symmetry modes', () => {
    for (const symmetry of ['none', 'mirror', 'point'] as Symmetry[]) {
      for (let seed = 0; seed < 30; seed++) {
        const r = generateProceduralMap(new RNG(seed), W, H, makeParams({ symmetry }));
        expect(connected(r, W, H)).toBe(true);
      }
    }
  });

  it('keeps obstacles under the param wall cap, even when knobs are maxed', () => {
    const p = makeParams({ coverDensity: 0.3, crossbars: 3, dividers: 3 });
    const cap = Math.floor(p.wallCapFraction * W * H);
    for (let seed = 0; seed < 30; seed++) {
      const r = generateProceduralMap(new RNG(seed), W, H, p);
      expect(r.walls.length + r.halfCovers.length).toBeLessThanOrEqual(cap);
    }
  });

  it('produces a point-symmetric layout when symmetry = point', () => {
    assertSymmetric('point');
  });

  it('produces a mirror-symmetric layout when symmetry = mirror', () => {
    assertSymmetric('mirror');
  });

  it('windowChance 0 → no half-cover anywhere (windows are the only source)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const r = generateProceduralMap(new RNG(seed), W, H, makeParams({ windowChance: 0, crossbars: 3, dividers: 3 }));
      expect(r.halfCovers.length).toBe(0);
    }
  });

  it('a high windowChance with structural walls produces half-cover windows', () => {
    let total = 0;
    for (let seed = 0; seed < 20; seed++) {
      const r = generateProceduralMap(new RNG(seed), W, H, makeParams({ windowChance: 0.5, crossbars: 3, dividers: 2 }));
      total += r.halfCovers.length;
    }
    expect(total).toBeGreaterThan(0);
  });

  it('every window sits on a structural wall, never on open ground', () => {
    // With NO crossbars/dividers there are no structural walls, so even a high
    // windowChance can place no windows (noise cover is solid-only now).
    for (let seed = 0; seed < 20; seed++) {
      const r = generateProceduralMap(new RNG(seed), W, H, makeParams({ windowChance: 0.9, crossbars: 0, dividers: 0 }));
      expect(r.halfCovers.length).toBe(0);
    }
  });
});
