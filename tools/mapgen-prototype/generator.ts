/**
 * Procedural map generator PROTOTYPE (M6 follow-up — the "rework procedural
 * maps from the ground up" round). Standalone, dev-only, eyeball-tuned in
 * `tools/mapgen-prototype/`. NOT wired into the sim yet: the point of this tool
 * is to nail the look + feel of the lane/crossbar + noise blend before it
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
 *     (M6). This is the structure the uniform scatter never produced.
 *   - DIVIDERS are vertical partial walls: lateral structure / cover / more
 *     than one route down, so the objective system has routing decisions.
 *   - NOISE (one value-noise field) textures the open ground: high ground →
 *     cover clumps (ranged cover, LOS breaks), low ground → organic water
 *     pools. Smooth noise means these cluster instead of speckling.
 *   - MIRROR symmetry reflects the top half onto the bottom so neither army
 *     gets a terrain advantage (fairness for a two-sided clash).
 *
 * Determinism: same config (incl. seed) → identical map.
 */

import { RNG } from '../../src/core/RNG';
import type { GridCoord } from '../../src/core/types';
import type { TileKind } from '../../src/sim/TileGrid';

export interface MapGenConfig {
  width: number;
  height: number;
  seed: number;
  /** 'mirror' reflects the top half onto the bottom (fair clash); 'none' is free. */
  symmetry: 'mirror' | 'none';
  /** Horizontal wall lines across the advance axis (placed in the generated
   *  half; mirror doubles them on the map). */
  crossbars: number;
  /** Fordable gaps per crossbar (the chokepoints). */
  gapsPerBar: number;
  /** Gap width in cells. */
  gapWidth: number;
  /** Probability a gap is filled with water (a bog-down ford) vs bare floor. */
  fordChance: number;
  /** Vertical partial walls for lateral structure / alternate routes. */
  dividers: number;
  /** Fraction of the noise field's HIGH ground that becomes cover (0..~0.35). */
  coverDensity: number;
  /** Fraction of the noise field's LOW ground that becomes water pools. */
  poolDensity: number;
  /** Value-noise lattice resolution (cells across the map; 2..6). */
  noiseScale: number;
  /** Hard ceiling on total wall cells, as a fraction of the board. */
  wallCapFraction: number;
}

export interface GenStats {
  walls: number;
  water: number;
  wallFraction: number;
  connected: boolean;
  /** Walls removed by the connectivity guard (0 = the gaps already sufficed). */
  carved: number;
  /** Highlighted chokepoint/ford cells. */
  chokepoints: number;
}

export interface GeneratedProtoMap {
  width: number;
  height: number;
  /** Tile kind per cell ([y][x]) — floor / shallow_water. Walls are NOT a tile
   *  kind (they're neutral units in the sim); a wall cell's kind is 'floor'. */
  kinds: TileKind[][];
  /** Neutral-unit wall coordinates. */
  walls: GridCoord[];
  spawnTop: GridCoord[];
  spawnBottom: GridCoord[];
  /** Gap/ford cells, for the chokepoint highlight. */
  chokeCells: GridCoord[];
  stats: GenStats;
}

// Internal working cell: floor / wall / water.
type Cell = 'f' | 'w' | 'a';

const SPAWN_BAND = 8;

const keyOf = (x: number, y: number): string => `${x},${y}`;

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

  const set = (x: number, y: number, v: Cell): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (isSpawn(x, y)) return;
    grid[y]![x] = v;
  };

  // The generated region: the top half (rows 1..mid-1) when mirroring, else the
  // whole interior. Features land here; mirror reflects them downward.
  const mirror = cfg.symmetry === 'mirror';
  const lastGenRow = mirror ? Math.max(2, Math.floor(H / 2) - 1) : H - 3;
  const firstRow = 2;

  // --- CROSSBARS: horizontal walls across the width, each with fordable gaps ---
  const span = Math.max(1, lastGenRow - firstRow);
  for (let b = 0; b < cfg.crossbars; b++) {
    const frac = (b + 1) / (cfg.crossbars + 1);
    let ry = firstRow + Math.round(frac * span) + rng.int(-1, 1);
    ry = Math.min(lastGenRow, Math.max(firstRow, ry));
    const gapCols = chooseGapCols(rng, W, cfg.gapsPerBar, cfg.gapWidth);
    for (let x = 0; x < W; x++) {
      if (isSpawn(x, ry)) continue;
      if (gapCols.has(x)) {
        const ford = rng.next() < cfg.fordChance;
        set(x, ry, ford ? 'a' : 'f');
        choke.add(keyOf(x, ry));
      } else {
        set(x, ry, 'w');
      }
    }
  }

  // --- DIVIDERS: vertical partial walls (lateral structure) ---
  for (let d = 0; d < cfg.dividers; d++) {
    const frac = (d + 1) / (cfg.dividers + 1);
    const dx = Math.min(W - 1, Math.max(0, Math.round(frac * (W - 1)) + rng.int(-1, 1)));
    const len = Math.max(2, Math.round(span * (0.4 + rng.next() * 0.4)));
    const startY = firstRow + rng.int(0, Math.max(0, span - len));
    for (let y = startY; y < startY + len && y <= lastGenRow; y++) {
      if (grid[y]![dx] === 'f') set(dx, y, 'w');
    }
  }

  // --- NOISE texture: cover clumps (high ground) + water pools (low ground) ---
  const noise = buildValueNoise(rng, W, H, cfg.noiseScale);
  const coverCut = 1 - cfg.coverDensity;
  for (let y = firstRow; y <= lastGenRow; y++) {
    for (let x = 0; x < W; x++) {
      if (isSpawn(x, y)) continue;
      if (grid[y]![x] !== 'f') continue; // never overwrite a crossbar / gap / divider
      const n = noise(x, y);
      if (n > coverCut) set(x, y, 'w');
      else if (n < cfg.poolDensity) set(x, y, 'a');
    }
  }

  // --- MIRROR: reflect the generated top half onto the bottom half ---
  if (mirror) {
    for (let y = H - 2; y > lastGenRow; y--) {
      const srcY = H - 1 - y;
      for (let x = 0; x < W; x++) {
        if (isSpawn(x, y)) continue;
        grid[y]![x] = grid[srcY]![x]!;
        if (choke.has(keyOf(x, srcY))) choke.add(keyOf(x, y));
      }
    }
  }

  // --- WALL CAP: trim excess cover walls (never the choke gaps) ---
  enforceWallCap(grid, rng, cfg.wallCapFraction, isSpawn, mirror);

  // --- CONNECTIVITY: guarantee a spawn-to-spawn route (carve near center) ---
  const carved = ensureConnectivity(grid, spawnTop, spawnBottom, choke, mirror);

  // --- assemble outputs ---
  const kinds: TileKind[][] = Array.from({ length: H }, () => new Array<TileKind>(W).fill('floor'));
  const walls: GridCoord[] = [];
  let waterCount = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = grid[y]![x]!;
      if (c === 'w') {
        walls.push({ x, y });
      } else if (c === 'a') {
        kinds[y]![x] = 'shallow_water';
        waterCount++;
      }
    }
  }
  const chokeCells: GridCoord[] = [...choke].map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { x: x!, y: y! };
  });

  const stats: GenStats = {
    walls: walls.length,
    water: waterCount,
    wallFraction: walls.length / (W * H),
    connected: true, // ensureConnectivity guarantees it
    carved,
    chokepoints: chokeCells.length,
  };

  return { width: W, height: H, kinds, walls, spawnTop, spawnBottom, chokeCells, stats };
}

/** Gap column set for a crossbar: `count` gaps of `width`, spread across the
 *  width with jitter (never hugging the very edges). */
function chooseGapCols(rng: RNG, W: number, count: number, width: number): Set<number> {
  const cols = new Set<number>();
  for (let g = 0; g < count; g++) {
    const frac = (g + 1) / (count + 1);
    const center = Math.round(frac * (W - 1)) + rng.int(-1, 1);
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

/** Trim walls (deterministic shuffle order) until the count is under the cap.
 *  When mirroring, removes each wall together with its mirror partner so the
 *  cap pass can't break the symmetry the mirror established. */
function enforceWallCap(
  grid: Cell[][],
  rng: RNG,
  capFraction: number,
  isSpawn: (x: number, y: number) => boolean,
  mirror: boolean,
): void {
  const H = grid.length;
  const W = grid[0]!.length;
  const cap = Math.floor(capFraction * W * H);
  const wallCells: GridCoord[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y]![x] === 'w' && !isSpawn(x, y)) wallCells.push({ x, y });
    }
  }
  let count = wallCells.length;
  if (count <= cap) return;
  // Shuffle deterministically, then drop the overflow (in mirror pairs).
  for (let i = wallCells.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = wallCells[i]!;
    wallCells[i] = wallCells[j]!;
    wallCells[j] = tmp;
  }
  for (const c of wallCells) {
    if (count <= cap) break;
    if (grid[c.y]![c.x] !== 'w') continue; // already cleared as a partner
    grid[c.y]![c.x] = 'f';
    count--;
    if (mirror) {
      const py = H - 1 - c.y;
      if (py !== c.y && grid[py]![c.x] === 'w' && !isSpawn(c.x, py)) {
        grid[py]![c.x] = 'f';
        count--;
      }
    }
  }
}

/** BFS reachability over passable cells (floor + water; walls block). */
function hasPath(grid: Cell[][], start: GridCoord, goal: GridCoord): boolean {
  const H = grid.length;
  const W = grid[0]!.length;
  const passable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && grid[y]![x] !== 'w';
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

/** Remove walls (nearest the vertical centre first, so the carve reads as a
 *  central breach) until the spawn bands connect. Returns how many were cut.
 *  When mirroring, carves each wall together with its mirror partner so the
 *  guarantee can't break symmetry (carving the extra cell only ever helps the
 *  path). */
function ensureConnectivity(
  grid: Cell[][],
  spawnTop: GridCoord[],
  spawnBottom: GridCoord[],
  choke: Set<string>,
  mirror: boolean,
): number {
  const H = grid.length;
  const W = grid[0]!.length;
  const start = centroid(spawnTop);
  const goal = centroid(spawnBottom);
  if (hasPath(grid, start, goal)) return 0;

  const wallCells: GridCoord[] = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y]![x] === 'w') wallCells.push({ x, y });
    }
  }
  const cx = (W - 1) / 2;
  wallCells.sort(
    (a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx) || a.y - b.y,
  );

  const carve = (x: number, y: number): number => {
    if (grid[y]![x] !== 'w') return 0;
    grid[y]![x] = 'a'; // a watered breach (reads as a ford, on-theme)
    choke.add(keyOf(x, y));
    return 1;
  };

  let carved = 0;
  for (const c of wallCells) {
    if (hasPath(grid, start, goal)) break;
    carved += carve(c.x, c.y);
    if (mirror) {
      const py = H - 1 - c.y;
      if (py !== c.y) carved += carve(c.x, py);
    }
  }
  return carved;
}
