/**
 * Procedural map generation (M6 rework). Ported from the eyeball-tuned
 * `tools/mapgen-prototype/generator.ts` — the crossbar + divider + noise blend,
 * built around our top/bottom-clash topology:
 *
 *   - CROSSBARS are wavy horizontal wall lines ACROSS the advance axis, each
 *     with a fordable GAP. They funnel the vertical advance into a chokepoint;
 *     a watered gap is an M6 bog-down ford. A vertical bridge at each waver step
 *     keeps a wavy bar a true barrier (no diagonal leak). A `windowChance` of
 *     each wall cell is a half-cover WINDOW — shoot-through, movement-blocking.
 *   - DIVIDERS are vertical partial walls: lateral structure / alternate routes
 *     (windowed the same way).
 *   - NOISE (one value-noise field) textures the open ground: high ground →
 *     SOLID cover clumps (LOS + movement blockers), low ground → organic water
 *     pools. (Half-cover is structural — it lives only in the walls above.)
 *   - SYMMETRY ('point' = 180° rotation, offsetting the partnered gap so
 *     chokepoints don't stack; 'mirror' = reflect across the midline; 'none' =
 *     free) keeps the clash fair.
 *
 * Two stages:
 *   1. `sampleProceduralParams` draws a concrete `ResolvedMapParams` from the
 *      designer-set ranges/weights in `config/terrain.json#procedural`, so maps
 *      vary seed-to-seed within the envelope.
 *   2. `generateProceduralMap` builds the map from those params + the forked
 *      encounter `RNG`.
 *
 * Determinism: same `(rng state, gridW, gridH, params)` → identical map. Walls
 * are neutral UNITS in the sim (not a tile kind), so they're returned as coords
 * for the caller to `spawnWall`; half-cover likewise. The connectivity guard
 * carves a watered breach if the gaps ever seal, so a degenerate roll can't
 * produce an unplayable arena.
 *
 * Kept independent of `terrainGen` (no import cycle): `terrainGen` constructs
 * the `GeneratedTerrain` from the `ProceduralMapResult` returned here.
 */
import type { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import type { ProceduralTerrainConfig, RangeSpec } from '../config/terrain';
import { TileGrid } from './TileGrid';
import { SPAWN_REGION_TILE_COUNT, type SpawnRegion } from './layouts';
import { sampleRange, sampleIntRange, weightedPick } from '../core/sampling';

export type Symmetry = 'none' | 'mirror' | 'point';

/** A concrete, fully-resolved knob set for one encounter's map (the sampled
 *  form of `ProceduralTerrainConfig`). */
export interface ResolvedMapParams {
  symmetry: Symmetry;
  /** Horizontal wall lines across the advance axis. */
  crossbars: number;
  /** Fordable gaps per crossbar (the chokepoints). */
  gapsPerBar: number;
  /** Gap width in cells. */
  gapWidth: number;
  /** Probability a gap is watered (a bog-down ford) vs bare floor. */
  fordChance: number;
  /** Vertical wobble amplitude of a crossbar's wall row. */
  crossbarWaver: number;
  /** Vertical partial walls for lateral structure. */
  dividers: number;
  /** Fraction of the noise field's HIGH ground that becomes (solid) cover. */
  coverDensity: number;
  /** Per structural-wall cell, the chance it's a half-cover WINDOW (a
   *  shoot-through gap in a crossbar/divider) instead of a solid wall. */
  windowChance: number;
  /** Fraction of the noise field's LOW ground that becomes water pools. */
  poolDensity: number;
  /** Value-noise lattice resolution. */
  noiseScale: number;
  /** Hard ceiling on total obstacle cells, as a board fraction (NOT sampled). */
  wallCapFraction: number;
}

export interface GenStats {
  walls: number;
  halfCovers: number;
  water: number;
  /** wall + half-cover, over the board. */
  obstacleFraction: number;
  connected: boolean;
  /** Obstacles removed by the connectivity guard (0 = the gaps already sufficed). */
  carved: number;
  chokepoints: number;
}

/**
 * The generator's output. A superset of `GeneratedTerrain`'s procedural
 * fields plus dev/test diagnostics (`chokeCells`, `stats`). `chasms` / `fires`
 * / `healings` are always empty for procedural (hand-authored-only), so the
 * caller fills those with `[]` when assembling a `GeneratedTerrain`.
 */
export interface ProceduralMapResult {
  tileGrid: TileGrid;
  walls: GridCoord[];
  halfCovers: GridCoord[];
  spawnRegions: SpawnRegion[];
  /** Gap/ford cells, for the chokepoint highlight (dev tooling). */
  chokeCells: GridCoord[];
  stats: GenStats;
}

const range = (rng: RNG, s: RangeSpec): number =>
  sampleRange(rng, s.min, s.max, s.center, s.intensity);
const intRange = (rng: RNG, s: RangeSpec): number =>
  sampleIntRange(rng, s.min, s.max, s.center, s.intensity);

/**
 * Draw a concrete map-parameter set from the procedural config envelope. One
 * RNG draw per sampled knob, in the order below (`wallCapFraction` is a fixed
 * guard rail, no draw). Reordering or adding a knob re-baselines the fuzz
 * stream — the usual RNG-fork caveat.
 */
export function sampleProceduralParams(
  rng: RNG,
  cfg: ProceduralTerrainConfig,
): ResolvedMapParams {
  const symmetry = weightedPick(rng, cfg.symmetry);
  const crossbars = Number(weightedPick(rng, cfg.crossbars));
  const gapsPerBar = Number(weightedPick(rng, cfg.gapsPerBar));
  const gapWidth = intRange(rng, cfg.gapWidth);
  const fordChance = range(rng, cfg.fordChance);
  const crossbarWaver = range(rng, cfg.crossbarWaver);
  const dividers = Number(weightedPick(rng, cfg.dividers));
  const coverDensity = range(rng, cfg.coverDensity);
  const windowChance = range(rng, cfg.windowChance);
  const poolDensity = range(rng, cfg.poolDensity);
  const noiseScale = intRange(rng, cfg.noiseScale);
  return {
    symmetry,
    crossbars,
    gapsPerBar,
    gapWidth,
    fordChance,
    crossbarWaver,
    dividers,
    coverDensity,
    windowChance,
    poolDensity,
    noiseScale,
    wallCapFraction: cfg.wallCapFraction,
  };
}

// Internal working cell: floor / wall / half-cover / water.
type Cell = 'f' | 'w' | 'h' | 'a';
const isObstacle = (c: Cell): boolean => c === 'w' || c === 'h';

const keyOf = (x: number, y: number): string => `${x},${y}`;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Build a procedural map from a resolved param set + a forked encounter RNG.
 * The RNG is consumed directly (no re-seeding) so the per-encounter fork
 * contract holds and the fuzz harness can replay any seed.
 */
export function generateProceduralMap(
  rng: RNG,
  gridW: number,
  gridH: number,
  params: ResolvedMapParams,
): ProceduralMapResult {
  const W = gridW;
  const H = gridH;

  const grid: Cell[][] = Array.from({ length: H }, () => new Array<Cell>(W).fill('f'));
  const choke = new Set<string>();

  // --- spawn bands (8 centered cells on the top + bottom rows) ---
  const band = Math.min(SPAWN_REGION_TILE_COUNT, W);
  const bandX0 = Math.floor((W - band) / 2);
  const spawnTop: GridCoord[] = [];
  const spawnBottom: GridCoord[] = [];
  for (let i = 0; i < band; i++) {
    spawnTop.push({ x: bandX0 + i, y: 0 });
    spawnBottom.push({ x: bandX0 + i, y: H - 1 });
  }
  const isSpawn = (x: number, y: number): boolean =>
    (y === 0 || y === H - 1) && x >= bandX0 && x < bandX0 + band;

  const symmetric = params.symmetry !== 'none';
  // The partner of a cell under the active symmetry (used to keep post-symmetry
  // passes from breaking it). 'point' = 180° rotation; 'mirror' = reflect-Y.
  const partner = (x: number, y: number): GridCoord =>
    params.symmetry === 'point' ? { x: W - 1 - x, y: H - 1 - y } : { x, y: H - 1 - y };

  // Generated region: the top half (rows 2..lastGenRow) when symmetric — the
  // symmetry copy fills the bottom — else the whole interior.
  const firstRow = 2;
  const lastGenRow = symmetric ? Math.max(firstRow, Math.floor(H / 2) - 1) : H - 3;

  const set = (x: number, y: number, v: Cell): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (isSpawn(x, y)) return;
    grid[y]![x] = v;
  };
  const wallAt = (x: number, y: number): void => {
    if (y < firstRow || y > lastGenRow) return;
    if (choke.has(keyOf(x, y))) return; // never wall a chokepoint shut
    // M6 windows: a structural-wall cell occasionally becomes half-cover — a
    // shoot-through gap that still blocks movement (the bar/divider stays a
    // barrier funneling to the fords; ranged units get a firing lane).
    set(x, y, rng.next() < params.windowChance ? 'h' : 'w');
  };

  // --- NOISE FIELD (built first so crossbars can waver off it) ---
  const noise = buildValueNoise(rng, W, H, params.noiseScale);

  // --- CROSSBARS: wavy horizontal walls across the width, with fordable gaps ---
  const span = Math.max(1, lastGenRow - firstRow);
  for (let b = 0; b < params.crossbars; b++) {
    const frac = (b + 1) / (params.crossbars + 1);
    const baseRow = clamp(firstRow + Math.round(frac * span) + rng.int(-1, 1), firstRow, lastGenRow);
    const gapCols = chooseGapCols(rng, W, params.gapsPerBar, params.gapWidth);
    const rowAt = (x: number): number =>
      clamp(
        baseRow + Math.round((noise(x, baseRow) - 0.5) * 2 * params.crossbarWaver),
        firstRow,
        lastGenRow,
      );

    let prevRow: number | null = null;
    for (let x = 0; x < W; x++) {
      const r = rowAt(x);
      if (gapCols.has(x)) {
        // Open the gap (the army's crossing). Ford with `fordChance`.
        const ford = rng.next() < params.fordChance;
        set(x, r, ford ? 'a' : 'f');
        choke.add(keyOf(x, r));
        prevRow = null; // don't bridge a wall across the gap
        continue;
      }
      // Bridge the vertical step from the previous column so a wavy wall has no
      // diagonal leak — fill the column between the two rows.
      const lo = prevRow === null ? r : Math.min(prevRow, r);
      const hi = prevRow === null ? r : Math.max(prevRow, r);
      for (let yy = lo; yy <= hi; yy++) wallAt(x, yy);
      prevRow = r;
    }
  }

  // --- DIVIDERS: vertical partial walls (lateral structure) ---
  for (let d = 0; d < params.dividers; d++) {
    const frac = (d + 1) / (params.dividers + 1);
    const dx = clamp(Math.round(frac * (W - 1)) + rng.int(-1, 1), 0, W - 1);
    const len = Math.max(2, Math.round(span * (0.4 + rng.next() * 0.4)));
    const startY = firstRow + rng.int(0, Math.max(0, span - len));
    for (let y = startY; y < startY + len && y <= lastGenRow; y++) {
      if (grid[y]![dx] === 'f' && !choke.has(keyOf(dx, y))) {
        set(dx, y, rng.next() < params.windowChance ? 'h' : 'w'); // windows here too
      }
    }
  }

  // --- NOISE texture: cover clumps (some HALF-cover) + water pools ---
  const coverCut = 1 - params.coverDensity;
  for (let y = firstRow; y <= lastGenRow; y++) {
    for (let x = 0; x < W; x++) {
      if (isSpawn(x, y)) continue;
      if (grid[y]![x] !== 'f') continue; // never overwrite a bar / gap / divider
      if (choke.has(keyOf(x, y))) continue; // never fill a chokepoint
      const n = noise(x, y);
      // Noise cover is SOLID (rocks/rubble — full LOS + movement blockers).
      // Half-cover lives only as windows in the structural walls (wallAt above).
      if (n > coverCut) set(x, y, 'w');
      else if (n < params.poolDensity) set(x, y, 'a');
    }
  }

  // --- SYMMETRY: copy the generated top half onto the bottom half ---
  if (symmetric) {
    for (let y = 0; y < H; y++) {
      if (2 * y <= H - 1) continue; // strict bottom half only
      for (let x = 0; x < W; x++) {
        if (isSpawn(x, y)) continue;
        const src = partner(x, y); // top-half source
        grid[y]![x] = grid[src.y]![src.x]!;
        if (choke.has(keyOf(src.x, src.y))) choke.add(keyOf(x, y));
      }
    }
  }

  // --- OBSTACLE CAP: trim excess cover (symmetry-aware pairs) ---
  enforceObstacleCap(grid, rng, params.wallCapFraction, isSpawn, symmetric, partner);

  // --- CONNECTIVITY: guarantee a spawn-to-spawn route (symmetry-aware) ---
  const carved = ensureConnectivity(grid, spawnTop, spawnBottom, choke, symmetric, partner);

  // --- assemble outputs ---
  const tileGrid = new TileGrid(W, H);
  const walls: GridCoord[] = [];
  const halfCovers: GridCoord[] = [];
  let waterCount = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = grid[y]![x]!;
      if (c === 'w') walls.push({ x, y });
      else if (c === 'h') halfCovers.push({ x, y });
      else if (c === 'a') {
        tileGrid.setKind({ x, y }, 'shallow_water');
        waterCount++;
      }
    }
  }
  const chokeCells: GridCoord[] = [...choke].map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { x: x!, y: y! };
  });

  const obstacles = walls.length + halfCovers.length;
  const stats: GenStats = {
    walls: walls.length,
    halfCovers: halfCovers.length,
    water: waterCount,
    obstacleFraction: obstacles / (W * H),
    connected: true,
    carved,
    chokepoints: chokeCells.length,
  };

  const spawnRegions: SpawnRegion[] = [
    { tiles: spawnTop, availability: 'both' },
    { tiles: spawnBottom, availability: 'both' },
  ];

  return { tileGrid, walls, halfCovers, spawnRegions, chokeCells, stats };
}

/** Gap column set for a crossbar: `count` gaps of `width`, each placed RANDOMLY
 *  within its own width-segment (with an edge margin) so chokepoints land at
 *  varied positions instead of always hugging the centre. */
function chooseGapCols(rng: RNG, W: number, count: number, width: number): Set<number> {
  const cols = new Set<number>();
  const margin = Math.min(2, Math.floor(W / 6));
  const usable = Math.max(1, W - 2 * margin);
  const seg = usable / count;
  for (let g = 0; g < count; g++) {
    const lo = margin + Math.floor(g * seg);
    const hi = margin + Math.floor((g + 1) * seg) - 1;
    const center = rng.int(Math.min(lo, hi), Math.max(lo, hi));
    const half = Math.floor(width / 2);
    for (let d = -half; d < width - half; d++) {
      const x = center + d;
      if (x >= 0 && x < W) cols.add(x);
    }
  }
  return cols;
}

/** Value noise in [0,1): a random lattice, bilinearly interpolated with
 *  smoothstep. `scale` lattice cells span the map, so smaller = broader blobs. */
function buildValueNoise(
  rng: RNG,
  W: number,
  H: number,
  scale: number,
): (x: number, y: number) => number {
  const gx = Math.max(2, Math.round(scale));
  const gy = Math.max(2, Math.round((scale * H) / W));
  const lat: number[][] = [];
  for (let j = 0; j <= gy; j++) {
    lat[j] = [];
    for (let i = 0; i <= gx; i++) lat[j]![i] = rng.next();
  }
  const sm = (t: number): number => t * t * (3 - 2 * t);
  return (x: number, y: number): number => {
    const fx = (x / Math.max(1, W - 1)) * gx;
    const fy = (y / Math.max(1, H - 1)) * gy;
    const i = Math.min(gx - 1, Math.floor(fx));
    const j = Math.min(gy - 1, Math.floor(fy));
    const tx = fx - i;
    const ty = fy - j;
    const a = lat[j]![i]!;
    const b = lat[j]![i + 1]!;
    const c = lat[j + 1]![i]!;
    const d = lat[j + 1]![i + 1]!;
    const top = a + (b - a) * sm(tx);
    const bot = c + (d - c) * sm(tx);
    return top + (bot - top) * sm(ty);
  };
}

/** Trim obstacles (wall + half-cover) until under the cap. When symmetric,
 *  removes each together with its partner so the cap can't break symmetry. */
function enforceObstacleCap(
  grid: Cell[][],
  rng: RNG,
  capFraction: number,
  isSpawn: (x: number, y: number) => boolean,
  symmetric: boolean,
  partner: (x: number, y: number) => GridCoord,
): void {
  const H = grid.length;
  const W = grid[0]!.length;
  const cap = Math.floor(capFraction * W * H);
  const cells: GridCoord[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isObstacle(grid[y]![x]!) && !isSpawn(x, y)) cells.push({ x, y });
    }
  }
  let count = cells.length;
  if (count <= cap) return;
  for (let i = cells.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = cells[i]!;
    cells[i] = cells[j]!;
    cells[j] = tmp;
  }
  for (const c of cells) {
    if (count <= cap) break;
    if (!isObstacle(grid[c.y]![c.x]!)) continue; // already cleared as a partner
    grid[c.y]![c.x] = 'f';
    count--;
    if (symmetric) {
      const p = partner(c.x, c.y);
      if ((p.x !== c.x || p.y !== c.y) && isObstacle(grid[p.y]![p.x]!) && !isSpawn(p.x, p.y)) {
        grid[p.y]![p.x] = 'f';
        count--;
      }
    }
  }
}

/** BFS reachability over passable cells (floor + water; wall + half-cover block). */
function hasPath(grid: Cell[][], start: GridCoord, goal: GridCoord): boolean {
  const H = grid.length;
  const W = grid[0]!.length;
  const passable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && !isObstacle(grid[y]![x]!);
  if (!passable(goal.x, goal.y) || !passable(start.x, start.y)) return false;
  const seen = new Set<string>([keyOf(start.x, start.y)]);
  const queue: GridCoord[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    if (c.x === goal.x && c.y === goal.y) return true;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = c.x + dx;
        const ny = c.y + dy;
        const k = keyOf(nx, ny);
        if (seen.has(k) || !passable(nx, ny)) continue;
        seen.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return false;
}

const centroid = (tiles: GridCoord[]): GridCoord => {
  let sx = 0;
  let sy = 0;
  for (const t of tiles) {
    sx += t.x;
    sy += t.y;
  }
  return { x: Math.round(sx / tiles.length), y: Math.round(sy / tiles.length) };
};

/** Remove obstacles (nearest the vertical centre first, a central breach) until
 *  the spawn bands connect. When symmetric, carves the partner too (carving the
 *  extra cell only ever helps the path). Returns how many were cut. */
function ensureConnectivity(
  grid: Cell[][],
  spawnTop: GridCoord[],
  spawnBottom: GridCoord[],
  choke: Set<string>,
  symmetric: boolean,
  partner: (x: number, y: number) => GridCoord,
): number {
  const H = grid.length;
  const W = grid[0]!.length;
  const start = centroid(spawnTop);
  const goal = centroid(spawnBottom);
  if (hasPath(grid, start, goal)) return 0;

  const cells: GridCoord[] = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      if (isObstacle(grid[y]![x]!)) cells.push({ x, y });
    }
  }
  const cx = (W - 1) / 2;
  cells.sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx) || a.y - b.y);

  const carve = (x: number, y: number): number => {
    if (!isObstacle(grid[y]![x]!)) return 0;
    grid[y]![x] = 'a'; // a watered breach (reads as a ford, on-theme)
    choke.add(keyOf(x, y));
    return 1;
  };

  let carved = 0;
  for (const c of cells) {
    if (hasPath(grid, start, goal)) break;
    carved += carve(c.x, c.y);
    if (symmetric) {
      const p = partner(c.x, c.y);
      if (p.x !== c.x || p.y !== c.y) carved += carve(p.x, p.y);
    }
  }
  return carved;
}
