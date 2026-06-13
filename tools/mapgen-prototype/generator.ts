/**
 * Procedural map generator PROTOTYPE (M6 follow-up — the "rework procedural
 * maps from the ground up" round). Standalone, dev-only, eyeball-tuned in
 * `tools/mapgen-prototype/`. NOT wired into the sim yet: the point of this tool
 * is to nail the look + feel of the crossbar + divider + noise blend before it
 * replaces the uniform-scatter path in `src/sim/terrainGen.ts`. When we commit
 * to it, this module ports to `src/sim/proceduralMap.ts` with the real
 * `GeneratedTerrain` shape + a proper test suite.
 *
 * It already speaks the sim's determinism vocabulary — the project `RNG` and
 * `GridCoord` — so the port is mechanical.
 *
 * The design, grounded in our topology (two 8-wide spawn bands top + bottom,
 * armies marching to a mid-map clash):
 *
 *   - CROSSBARS are horizontal wall lines ACROSS the advance axis, each with a
 *     fordable GAP. They funnel the vertical advance into a chokepoint — the
 *     gap is where the armies clash, and a watered gap is a bog-down ford
 *     (M6). The wall row WAVERS (samples the noise field) so it reads as a
 *     natural ridge, not a ruled line; a vertical bridge at each step keeps a
 *     wavy bar a true barrier (no diagonal leak).
 *   - DIVIDERS are vertical partial walls: lateral structure / cover / more
 *     than one route down, so the objective system has routing decisions.
 *   - NOISE (one value-noise field) textures the open ground: high ground →
 *     cover clumps (a configurable share of which become HALF-COVER — the D6
 *     shoot-over obstacle), low ground → organic water pools.
 *   - SYMMETRY ('point' = 180° rotation, the default, which offsets the
 *     mirrored gap to the opposite side so chokepoints don't stack; 'mirror' =
 *     reflect across the midline; 'none' = free) keeps the clash fair.
 *
 * Determinism: same config (incl. seed) → identical map.
 */

import { RNG } from '../../src/core/RNG';
import type { GridCoord } from '../../src/core/types';
import type { TileKind } from '../../src/sim/TileGrid';

export type Symmetry = 'none' | 'mirror' | 'point';

export interface MapGenConfig {
  width: number;
  height: number;
  seed: number;
  symmetry: Symmetry;
  /** Horizontal wall lines across the advance axis (placed in the generated
   *  half; symmetry doubles them on the map). */
  crossbars: number;
  /** Fordable gaps per crossbar (the chokepoints). */
  gapsPerBar: number;
  /** Gap width in cells. */
  gapWidth: number;
  /** Probability a gap is filled with water (a bog-down ford) vs bare floor. */
  fordChance: number;
  /** Vertical wobble amplitude of a crossbar's wall row (0 = a ruled line). */
  crossbarWaver: number;
  /** Vertical partial walls for lateral structure / alternate routes. */
  dividers: number;
  /** Fraction of the noise field's HIGH ground that becomes cover (0..~0.35). */
  coverDensity: number;
  /** Of the cover placed, the share that becomes HALF-COVER (shoot-over) vs solid wall. */
  halfCoverFraction: number;
  /** Fraction of the noise field's LOW ground that becomes water pools. */
  poolDensity: number;
  /** Value-noise lattice resolution (cells across the map; 2..6). */
  noiseScale: number;
  /** Hard ceiling on total obstacle cells (wall + half-cover), as a board fraction. */
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

export interface GeneratedProtoMap {
  width: number;
  height: number;
  /** Tile kind per cell ([y][x]) — floor / shallow_water. Walls + half-cover
   *  are NOT tile kinds (they're neutral units in the sim); their cell's kind
   *  is 'floor'. */
  kinds: TileKind[][];
  /** Neutral-unit wall coordinates (block movement + LOS). */
  walls: GridCoord[];
  /** Half-cover coordinates (block movement, transparent to LOS — D6). */
  halfCovers: GridCoord[];
  spawnTop: GridCoord[];
  spawnBottom: GridCoord[];
  /** Gap/ford cells, for the chokepoint highlight. */
  chokeCells: GridCoord[];
  stats: GenStats;
}

// Internal working cell: floor / wall / half-cover / water.
type Cell = 'f' | 'w' | 'h' | 'a';
const isObstacle = (c: Cell): boolean => c === 'w' || c === 'h';

const SPAWN_BAND = 8;
const keyOf = (x: number, y: number): string => `${x},${y}`;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function generateMap(cfg: MapGenConfig): GeneratedProtoMap {
  const rng = new RNG(cfg.seed);
  const W = cfg.width;
  const H = cfg.height;

  const grid: Cell[][] = Array.from({ length: H }, () => new Array<Cell>(W).fill('f'));
  const choke = new Set<string>();

  // --- spawn bands (8 centered cells on the top + bottom rows) ---
  const band = Math.min(SPAWN_BAND, W);
  const bandX0 = Math.floor((W - band) / 2);
  const spawnTop: GridCoord[] = [];
  const spawnBottom: GridCoord[] = [];
  for (let i = 0; i < band; i++) {
    spawnTop.push({ x: bandX0 + i, y: 0 });
    spawnBottom.push({ x: bandX0 + i, y: H - 1 });
  }
  const isSpawn = (x: number, y: number): boolean =>
    (y === 0 || y === H - 1) && x >= bandX0 && x < bandX0 + band;

  const symmetric = cfg.symmetry !== 'none';
  // The partner of a cell under the active symmetry (used to keep post-symmetry
  // passes from breaking it). 'point' = 180° rotation; 'mirror' = reflect-Y.
  const partner = (x: number, y: number): GridCoord =>
    cfg.symmetry === 'point' ? { x: W - 1 - x, y: H - 1 - y } : { x, y: H - 1 - y };

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
    set(x, y, 'w');
  };

  // --- NOISE FIELD (built first so crossbars can waver off it) ---
  const noise = buildValueNoise(rng, W, H, cfg.noiseScale);

  // --- CROSSBARS: wavy horizontal walls across the width, with fordable gaps ---
  const span = Math.max(1, lastGenRow - firstRow);
  for (let b = 0; b < cfg.crossbars; b++) {
    const frac = (b + 1) / (cfg.crossbars + 1);
    const baseRow = clamp(firstRow + Math.round(frac * span) + rng.int(-1, 1), firstRow, lastGenRow);
    const gapCols = chooseGapCols(rng, W, cfg.gapsPerBar, cfg.gapWidth);
    const rowAt = (x: number): number =>
      clamp(
        baseRow + Math.round((noise(x, baseRow) - 0.5) * 2 * cfg.crossbarWaver),
        firstRow,
        lastGenRow,
      );

    let prevRow: number | null = null;
    for (let x = 0; x < W; x++) {
      const r = rowAt(x);
      if (gapCols.has(x)) {
        // Open the gap (the army's crossing). Ford with `fordChance`.
        const ford = rng.next() < cfg.fordChance;
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
  for (let d = 0; d < cfg.dividers; d++) {
    const frac = (d + 1) / (cfg.dividers + 1);
    const dx = clamp(Math.round(frac * (W - 1)) + rng.int(-1, 1), 0, W - 1);
    const len = Math.max(2, Math.round(span * (0.4 + rng.next() * 0.4)));
    const startY = firstRow + rng.int(0, Math.max(0, span - len));
    for (let y = startY; y < startY + len && y <= lastGenRow; y++) {
      if (grid[y]![dx] === 'f' && !choke.has(keyOf(dx, y))) set(dx, y, 'w');
    }
  }

  // --- NOISE texture: cover clumps (some HALF-cover) + water pools ---
  const coverCut = 1 - cfg.coverDensity;
  for (let y = firstRow; y <= lastGenRow; y++) {
    for (let x = 0; x < W; x++) {
      if (isSpawn(x, y)) continue;
      if (grid[y]![x] !== 'f') continue; // never overwrite a bar / gap / divider
      if (choke.has(keyOf(x, y))) continue; // FIX #3: never fill a chokepoint
      const n = noise(x, y);
      if (n > coverCut) set(x, y, rng.next() < cfg.halfCoverFraction ? 'h' : 'w');
      else if (n < cfg.poolDensity) set(x, y, 'a');
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
  enforceObstacleCap(grid, rng, cfg.wallCapFraction, isSpawn, symmetric, partner);

  // --- CONNECTIVITY: guarantee a spawn-to-spawn route (symmetry-aware) ---
  const carved = ensureConnectivity(grid, spawnTop, spawnBottom, choke, symmetric, partner);

  // --- assemble outputs ---
  const kinds: TileKind[][] = Array.from({ length: H }, () => new Array<TileKind>(W).fill('floor'));
  const walls: GridCoord[] = [];
  const halfCovers: GridCoord[] = [];
  let waterCount = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = grid[y]![x]!;
      if (c === 'w') walls.push({ x, y });
      else if (c === 'h') halfCovers.push({ x, y });
      else if (c === 'a') {
        kinds[y]![x] = 'shallow_water';
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

  return { width: W, height: H, kinds, walls, halfCovers, spawnTop, spawnBottom, chokeCells, stats };
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
