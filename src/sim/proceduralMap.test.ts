import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { TERRAIN } from '../config/terrain';
import { THEMES, type Theme } from '../config/layouts';
import {
  sampleProceduralParams,
  generateProceduralMap,
  type ProceduralMapResult,
  type ResolvedMapParams,
  type ResolvedThemeTiles,
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

// §81a — draws = every base knob except the two non-draw keys (the
// wallCapFraction guard rail + the themeTiles table), plus one draw per knob
// the chosen theme DECLARES. Derived from the config, never hardcoded.
const BASE_KNOB_COUNT = Object.keys(P).length - 2;
const themeDrawCount = (theme: Theme): number => Object.keys(P.themeTiles[theme]).length;

describe('sampleProceduralParams', () => {
  it('is deterministic for a given seed', () => {
    const a = sampleProceduralParams(new RNG(1234), P, 'grassland');
    const b = sampleProceduralParams(new RNG(1234), P, 'grassland');
    expect(a).toEqual(b);
  });

  it('passes the fixed guard rail through unsampled', () => {
    expect(sampleProceduralParams(new RNG(0), P, 'grassland').wallCapFraction).toBe(
      P.wallCapFraction,
    );
  });

  it('consumes exactly one draw per sampled knob (base + the theme-declared set)', () => {
    for (const theme of THEMES) {
      const rng = new RNG(55);
      const probe = RNG.fromJSON(rng.toJSON());
      sampleProceduralParams(rng, P, theme);
      for (let i = 0; i < BASE_KNOB_COUNT + themeDrawCount(theme); i++) probe.next();
      expect(rng.toJSON()).toEqual(probe.toJSON());
    }
  });

  it('§81a — resolves undeclared theme knobs to 0 (feature off) and samples declared ones in-range', () => {
    const TILE_KEYS = ['deepWaterFraction', 'hills', 'ice', 'sand', 'mud', 'fire'] as const;
    for (const theme of THEMES) {
      const declared = P.themeTiles[theme];
      for (let seed = 0; seed < 100; seed++) {
        const p = sampleProceduralParams(new RNG(seed), P, theme);
        for (const key of TILE_KEYS) {
          const spec = declared[key];
          if (spec === undefined) {
            expect(p.tiles[key]).toBe(0);
          } else {
            expect(p.tiles[key]).toBeGreaterThanOrEqual(spec.min);
            expect(p.tiles[key]).toBeLessThanOrEqual(spec.max);
          }
        }
        // The poolDensity override folds into params.poolDensity directly.
        const poolSpec = declared.poolDensity ?? P.poolDensity;
        expect(p.poolDensity).toBeGreaterThanOrEqual(poolSpec.min);
        expect(p.poolDensity).toBeLessThanOrEqual(poolSpec.max);
      }
    }
  });

  it('keeps every sampled knob within its configured envelope', () => {
    const crossbarVals = allowedInts(P.crossbars);
    const gapVals = allowedInts(P.gapsPerBar);
    const dividerVals = allowedInts(P.dividers);
    for (let seed = 0; seed < 500; seed++) {
      const p = sampleProceduralParams(new RNG(seed), P, 'grassland');

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
      seen.add(sampleProceduralParams(new RNG(seed), P, 'grassland').crossbars);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('exercises every positively-weighted symmetry mode over enough seeds', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 500; seed++) {
      seen.add(sampleProceduralParams(new RNG(seed), P, 'grassland').symmetry);
    }
    for (const mode of allowedSymmetries) expect(seen).toContain(mode);
  });
});

const W = 14;
const H = 14;

// §81a — an all-off tile layer keeps the pre-81 geometry tests meaningful;
// tile-specific tests override individual knobs.
const noTiles = (over: Partial<ResolvedThemeTiles> = {}): ResolvedThemeTiles => ({
  deepWaterFraction: 0,
  hills: 0,
  ice: 0,
  sand: 0,
  mud: 0,
  fire: 0,
  ...over,
});

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
  tiles: noTiles(),
  ...over,
});

function waterCount(r: ProceduralMapResult): number {
  return kindCount(r, 'shallow_water');
}

function kindCount(r: ProceduralMapResult, kind: string): number {
  let n = 0;
  for (const c of r.tileGrid.cells()) if (c.kind === kind) n++;
  return n;
}

// BFS between the two spawn-region centroids over passable cells (floor +
// shallow water + ground patches), blocking walls, half-cover AND §81a deep
// water — the generator's own passability.
function connected(r: ProceduralMapResult, gridW: number, gridH: number): boolean {
  const blocked = new Set<string>();
  for (const c of [...r.walls, ...r.halfCovers]) blocked.add(`${c.x},${c.y}`);
  for (const c of r.tileGrid.cells()) {
    if (c.kind === 'deep_water') blocked.add(`${c.x},${c.y}`);
  }
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
    expect(r.stats.fires).toBe(r.fires.length);
    expect(r.stats.deepWater).toBe(kindCount(r, 'deep_water'));
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

describe('§81a — the theme tile layer', () => {
  // A swampy stress params set: big pools, half of them deepening.
  const swampy = (): ResolvedMapParams =>
    makeParams({
      poolDensity: 0.3,
      tiles: noTiles({ deepWaterFraction: 0.5, mud: 0.12 }),
    });

  it('deepWaterFraction > 0 produces deep water inside the pool band', () => {
    let deep = 0;
    for (let seed = 0; seed < 20; seed++) {
      deep += kindCount(generateProceduralMap(new RNG(seed), W, H, swampy()), 'deep_water');
    }
    expect(deep).toBeGreaterThan(0);
  });

  it('spawn bands stay connected with deep water blocking (the §81a guard rework)', () => {
    for (const symmetry of ['none', 'mirror', 'point'] as Symmetry[]) {
      for (let seed = 0; seed < 30; seed++) {
        const r = generateProceduralMap(new RNG(seed), W, H, { ...swampy(), symmetry });
        expect(connected(r, W, H)).toBe(true);
      }
    }
  });

  it('deep water counts against the wall cap (blocking budget, not obstacle-only)', () => {
    const p = swampy();
    const cap = Math.floor(p.wallCapFraction * W * H);
    for (let seed = 0; seed < 30; seed++) {
      const r = generateProceduralMap(new RNG(seed), W, H, p);
      expect(r.walls.length + r.halfCovers.length + kindCount(r, 'deep_water')).toBeLessThanOrEqual(
        cap,
      );
    }
  });

  it('ground patches claim only open floor — never obstacles, water, fords, or spawn bands', () => {
    const p = makeParams({
      tiles: noTiles({ hills: 0.2, ice: 0.1, sand: 0.1, mud: 0.1 }),
    });
    for (let seed = 0; seed < 20; seed++) {
      const r = generateProceduralMap(new RNG(seed), W, H, p);
      const obstacles = new Set([...r.walls, ...r.halfCovers].map((c) => `${c.x},${c.y}`));
      const choke = new Set(r.chokeCells.map((c) => `${c.x},${c.y}`));
      const spawn = new Set(
        r.spawnRegions.flatMap((reg) => reg.tiles.map((t) => `${t.x},${t.y}`)),
      );
      for (const c of r.tileGrid.cells()) {
        if (c.kind === 'hills' || c.kind === 'ice' || c.kind === 'sand' || c.kind === 'mud') {
          const k = `${c.x},${c.y}`;
          expect(obstacles.has(k)).toBe(false);
          expect(choke.has(k)).toBe(false);
          expect(spawn.has(k)).toBe(false);
        }
      }
    }
  });

  it('a positive patch density actually lands its tile kind (over seeds)', () => {
    let hills = 0;
    for (let seed = 0; seed < 20; seed++) {
      const r = generateProceduralMap(new RNG(seed), W, H, makeParams({ tiles: noTiles({ hills: 0.15 }) }));
      hills += kindCount(r, 'hills');
    }
    expect(hills).toBeGreaterThan(0);
  });

  it('fire scatter is sparse, never on a chokepoint, and lands on the fires readout', () => {
    let total = 0;
    for (let seed = 0; seed < 30; seed++) {
      const r = generateProceduralMap(new RNG(seed), W, H, makeParams({ tiles: noTiles({ fire: 0.03 }) }));
      const choke = new Set(r.chokeCells.map((c) => `${c.x},${c.y}`));
      for (const f of r.fires) {
        expect(r.tileGrid.kindAt(f)).toBe('fire');
        expect(choke.has(`${f.x},${f.y}`)).toBe(false);
      }
      // "Sparse": the scatter can never exceed the whole open-floor share.
      expect(r.fires.length).toBeLessThan(W * H * 0.2);
      total += r.fires.length;
    }
    expect(total).toBeGreaterThan(0);
  });

  it('the tile layer respects symmetry (partner cells share a tile kind)', () => {
    for (const symmetry of ['point', 'mirror'] as const) {
      const r = generateProceduralMap(
        new RNG(17),
        W,
        H,
        makeParams({
          symmetry,
          poolDensity: 0.25,
          tiles: noTiles({ deepWaterFraction: 0.4, hills: 0.15, fire: 0.03 }),
        }),
      );
      const band = Math.min(8, W);
      const bandX0 = Math.floor((W - band) / 2);
      const isSpawn = (x: number, y: number): boolean =>
        (y === 0 || y === H - 1) && x >= bandX0 && x < bandX0 + band;
      const partner = (x: number, y: number): { x: number; y: number } =>
        symmetry === 'point' ? { x: W - 1 - x, y: H - 1 - y } : { x, y: H - 1 - y };
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (isSpawn(x, y)) continue;
          const p = partner(x, y);
          if (isSpawn(p.x, p.y)) continue;
          // The connectivity carve breaks pairs deliberately (it carves the
          // partner too, but a carve can land where the partner was already
          // open); skip carved water cells.
          const a = r.tileGrid.kindAt({ x, y });
          const b = r.tileGrid.kindAt({ x: p.x, y: p.y });
          if (a === 'shallow_water' || b === 'shallow_water') continue;
          expect(a).toBe(b);
        }
      }
    }
  });

  it('an all-off tile layer changes nothing: no deep water, no patches, no fire', () => {
    for (let seed = 0; seed < 20; seed++) {
      const r = generateProceduralMap(new RNG(seed), W, H, makeParams());
      expect(kindCount(r, 'deep_water')).toBe(0);
      expect(kindCount(r, 'hills')).toBe(0);
      expect(kindCount(r, 'ice')).toBe(0);
      expect(kindCount(r, 'sand')).toBe(0);
      expect(kindCount(r, 'mud')).toBe(0);
      expect(r.fires.length).toBe(0);
    }
  });
});
