/**
 * The procedural board: crossbars, dividers and a noise blend, built for a
 * clash between the top and bottom rows, where the spawn bands are.
 *
 * - Crossbars are wavy wall lines across the advance, each with gaps, so
 *   the advance funnels through chokepoints. A gap is shallow water (a
 *   ford, slow to cross) at `fordChance`, else floor. Where a bar steps
 *   between rows the column between is walled too, so a wavy bar leaves no
 *   diagonal leak. A `windowChance` share of the wall cells are half-cover
 *   windows, which block movement and let shots through.
 * - Dividers are vertical partial walls, windowed the same way: lateral
 *   structure and alternate routes.
 * - One value-noise field textures the open ground: its high end becomes
 *   solid cover (walls, blocking sight and movement), its low end shallow
 *   pools. Half cover appears only as the windows.
 * - The theme's tiles layer onto the same pass: the lowest slice of the
 *   pools becomes impassable `deep_water`, the ground patches (hills, ice,
 *   sand, mud) claim open floor off fields of their own, and a theme with
 *   `fire` scatters fire cells off the crossings. Deep water counts against
 *   the obstacle cap, and the cap and the connectivity guard both turn it
 *   into shallow water, so a wet roll can't seal the crossing.
 * - Symmetry keeps the clash fair: `point` is a 180° rotation, which puts a
 *   gap's partner at the opposite column so the chokepoints don't line up;
 *   `mirror` reflects across the horizontal midline; `none` is free.
 *
 * Two stages: `sampleProceduralParams` draws a `ResolvedMapParams` from the
 * `procedural` envelope in `config/terrain.json`, and
 * `generateProceduralMap` builds the board from it and the encounter's
 * stream. The same rng state, size and params give the same board.
 *
 * Walls and half cover are neutral units in the sim, not tile kinds, so
 * they are returned as coords for the caller to spawn. The connectivity
 * guard carves a breach when the crossings are sealed, so no roll leaves
 * the teams apart.
 *
 * `terrainGen` imports this module, never the reverse, and assembles the
 * `GeneratedTerrain` from the result.
 */
import type { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import type {
  ProceduralTerrainConfig,
  ThemeTilesConfig,
  CampPlacementMode,
  RangeSpec,
} from '../config/terrain';
import type { Theme } from '../config/layouts';
import { TileGrid } from './TileGrid';
import { SPAWN_REGION_TILE_COUNT, type SpawnRegion } from './layouts';
import { sampleRange, sampleIntRange, weightedPick } from '../core/sampling';

export type Symmetry = 'none' | 'mirror' | 'point';

/**
 * One theme's sampled tile layer, the resolved form of a `ThemeTilesConfig`
 * entry (its keys are documented in `src/config/terrain.ts`). An undeclared
 * knob resolves to 0, the feature off. The theme's `poolDensity` override
 * replaces `ResolvedMapParams.poolDensity` instead of appearing here.
 */
export interface ResolvedThemeTiles {
  deepWaterFraction: number;
  hills: number;
  ice: number;
  sand: number;
  mud: number;
  fire: number;
}

/** The ground-patch kinds in claim order: where their fields overlap, the
 *  first kind takes the cell. The order also fixes the fields' draws, so it
 *  is part of the determinism contract. */
const PATCH_KINDS = ['hills', 'ice', 'sand', 'mud'] as const;
type PatchKind = (typeof PATCH_KINDS)[number];

/** One encounter's knobs, sampled from `ProceduralTerrainConfig`. */
export interface ResolvedMapParams {
  symmetry: Symmetry;
  /** Wall lines across the advance. */
  crossbars: number;
  /** Gaps per crossbar, the chokepoints. */
  gapsPerBar: number;
  /** Gap width in cells. */
  gapWidth: number;
  /** The chance a gap is shallow water (a ford) rather than floor. */
  fordChance: number;
  /** How far a crossbar's row wobbles, in rows either way. */
  crossbarWaver: number;
  /** Vertical partial walls. */
  dividers: number;
  /** The top share of the noise range that becomes solid cover: a cell
   *  whose noise is above `1 − coverDensity`. */
  coverDensity: number;
  /** Per structural wall cell, the chance it is a half-cover window
   *  instead of a wall. */
  windowChance: number;
  /** The bottom share of the noise range that becomes pools: a cell whose
   *  noise is below it. */
  poolDensity: number;
  /** The noise lattice's cells across the width; fewer gives broader
   *  blobs. */
  noiseScale: number;
  /** The ceiling on blocking cells (wall, half cover, deep water), as a
   *  share of the board. Fixed, not sampled. */
  wallCapFraction: number;
  /** The theme's tile layer. */
  tiles: ResolvedThemeTiles;
  /** The camp-site plan: how many sites (`count`, 0 when the theme's pool
   *  is empty), placed how (`mode`), and the least Chebyshev distance from
   *  every spawn tile (`standoff`). Which camp a site becomes is
   *  `spawnCamps`' roll on the `campSetup` stream. */
  camps: { count: number; mode: CampPlacementMode; standoff: number };
}

interface GenStats {
  walls: number;
  halfCovers: number;
  /** Shallow-water cells: fords, pools, carves and drained deep water. */
  water: number;
  deepWater: number;
  fires: number;
  /** Blocking cells (wall, half cover, deep water) as a share of the board. */
  obstacleFraction: number;
  /** Blockers removed by the connectivity guard (0 = the gaps already sufficed). */
  carved: number;
  chokepoints: number;
}

/**
 * The generator's output: the fields `terrainGen` puts into a
 * `GeneratedTerrain` (which gives a procedural board no rubble), and two
 * diagnostics that the tests and the map prototype
 * (`tools/mapgen-prototype/`) read, `chokeCells` and `stats`.
 */
export interface ProceduralMapResult {
  tileGrid: TileGrid;
  walls: GridCoord[];
  halfCovers: GridCoord[];
  /** The fire cells, also on `tileGrid`. */
  fires: GridCoord[];
  /** The rolled camp sites, empty on a camp-free board; `terrainGen` pairs
   *  them with the theme's pool. */
  campSpawns: GridCoord[];
  spawnRegions: SpawnRegion[];
  /** The crossing cells: the gaps, their partners and the carved breaches. */
  chokeCells: GridCoord[];
  stats: GenStats;
}

const range = (rng: RNG, s: RangeSpec): number =>
  sampleRange(rng, s.min, s.max, s.center, s.intensity);
const intRange = (rng: RNG, s: RangeSpec): number =>
  sampleIntRange(rng, s.min, s.max, s.center, s.intensity);

/**
 * Draws one encounter's knobs from the envelope, one draw a knob in the
 * order below (`wallCapFraction` is fixed and draws none); then the theme's
 * tile knobs in the order `poolDensity`, `deepWaterFraction`, `hills`,
 * `ice`, `sand`, `mud`, `fire`, one draw for each the theme declares (an
 * undeclared knob draws nothing, so the theme's entry fixes its count);
 * then the camp plan, two draws made whatever the pool. Reordering or
 * adding a draw changes every procedural board, and the fuzz baselines with
 * them.
 */
export function sampleProceduralParams(
  rng: RNG,
  cfg: ProceduralTerrainConfig,
  theme: Theme,
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
  const themeCfg: ThemeTilesConfig = cfg.themeTiles[theme];
  const optRange = (s: RangeSpec | undefined): number => (s === undefined ? 0 : range(rng, s));
  const pooled = themeCfg.poolDensity === undefined ? poolDensity : range(rng, themeCfg.poolDensity);
  const tiles: ResolvedThemeTiles = {
    deepWaterFraction: optRange(themeCfg.deepWaterFraction),
    hills: optRange(themeCfg.hills),
    ice: optRange(themeCfg.ice),
    sand: optRange(themeCfg.sand),
    mud: optRange(themeCfg.mud),
    fire: optRange(themeCfg.fire),
  };
  // The count, then the mode, drawn whatever the pool, so the stream doesn't
  // depend on it; an empty pool zeroes the count after the draws.
  const campCount = Number(weightedPick(rng, cfg.camps.density));
  const campMode = weightedPick(rng, cfg.camps.placement) as CampPlacementMode;
  const camps = {
    count: cfg.camps.pools[theme].length === 0 ? 0 : campCount,
    mode: campMode,
    standoff: cfg.camps.spawnStandoff,
  };
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
    poolDensity: pooled,
    noiseScale,
    wallCapFraction: cfg.wallCapFraction,
    tiles,
    camps,
  };
}

// The working cell: floor, wall, half cover, shallow water (`a`), and the
// theme's tiles.
type Cell = 'f' | 'w' | 'h' | 'a' | 'deep' | 'hills' | 'ice' | 'sand' | 'mud' | 'fire';
// Cells no unit can stand on. Deep water blocks like a wall for the cap and
// the connectivity guard, but the cap drains it to shallow water, not floor,
// so it reads as a ford.
const isBlocking = (c: Cell): boolean => c === 'w' || c === 'h' || c === 'deep';

const keyOf = (x: number, y: number): string => `${x},${y}`;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Builds the board from the sampled knobs, drawing on `rng` directly with no
 * re-seed, so the encounter's stream alone decides the board.
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

  // --- the spawn bands: `SPAWN_REGION_TILE_COUNT` centred cells on the top
  // and bottom rows, or the whole row on a narrower board ---
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
  // A cell's partner, so the passes after the symmetry copy keep it: the
  // 180° rotation for `point`, else the reflection across the horizontal
  // midline, which the camp pairing uses on a `none` board too.
  const partner = (x: number, y: number): GridCoord =>
    params.symmetry === 'point' ? { x: W - 1 - x, y: H - 1 - y } : { x, y: H - 1 - y };

  // The generated rows: from 2 to just above the midline when symmetric, the
  // copy filling the bottom, else from 2 to H − 3. Rows 0 and 1 and their
  // partners get no terrain.
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
    // A window at `windowChance`: half cover still blocks movement, so the
    // bar or divider still funnels to the gaps, and it gives ranged units a
    // firing lane.
    set(x, y, rng.next() < params.windowChance ? 'h' : 'w');
  };

  // --- the noise field, built first since the crossbars waver off it ---
  const noise = buildValueNoise(rng, W, H, params.noiseScale);

  // --- crossbars ---
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
        // A gap cell: a ford at `fordChance`, else floor.
        const ford = rng.next() < params.fordChance;
        set(x, r, ford ? 'a' : 'f');
        choke.add(keyOf(x, r));
        prevRow = null; // don't bridge a wall across the gap
        continue;
      }
      // Wall this column from the previous column's row to this one's, so a
      // step in the bar leaves no diagonal leak.
      const lo = prevRow === null ? r : Math.min(prevRow, r);
      const hi = prevRow === null ? r : Math.max(prevRow, r);
      for (let yy = lo; yy <= hi; yy++) wallAt(x, yy);
      prevRow = r;
    }
  }

  // --- dividers ---
  for (let d = 0; d < params.dividers; d++) {
    const frac = (d + 1) / (params.dividers + 1);
    const dx = clamp(Math.round(frac * (W - 1)) + rng.int(-1, 1), 0, W - 1);
    const len = Math.max(2, Math.round(span * (0.4 + rng.next() * 0.4)));
    const startY = firstRow + rng.int(0, Math.max(0, span - len));
    for (let y = startY; y < startY + len && y <= lastGenRow; y++) {
      if (grid[y]![dx] === 'f' && !choke.has(keyOf(dx, y))) {
        set(dx, y, rng.next() < params.windowChance ? 'h' : 'w'); // windowed as the bars are
      }
    }
  }

  // --- the noise pass: solid cover, pools, deep water, ground patches ---
  // Each active ground patch (density above 0) gets a field of its own, so
  // the patches don't follow the pools or the cover; built in `PATCH_KINDS`
  // order, which fixes the draws.
  const patchFields = new Map<PatchKind, (x: number, y: number) => number>();
  for (const kind of PATCH_KINDS) {
    if (params.tiles[kind] > 0) {
      patchFields.set(kind, buildValueNoise(rng, W, H, params.noiseScale));
    }
  }
  const coverCut = 1 - params.coverDensity;
  // The lowest slice of the pool band is deep water, so a deep centre keeps
  // a shallow rim.
  const deepCut = params.poolDensity * params.tiles.deepWaterFraction;
  for (let y = firstRow; y <= lastGenRow; y++) {
    for (let x = 0; x < W; x++) {
      if (isSpawn(x, y)) continue;
      if (grid[y]![x] !== 'f') continue; // never overwrite a bar / gap / divider
      if (choke.has(keyOf(x, y))) continue; // never fill a chokepoint
      const n = noise(x, y);
      if (n > coverCut) {
        set(x, y, 'w');
        continue;
      }
      if (n < params.poolDensity) {
        set(x, y, n < deepCut ? 'deep' : 'a');
        continue;
      }
      for (const [kind, field] of patchFields) {
        if (field(x, y) > 1 - params.tiles[kind]) {
          set(x, y, kind);
          break;
        }
      }
    }
  }

  // --- the fire scatter: a roll per open floor cell, never on a crossing,
  // so the crossing stays free ---
  if (params.tiles.fire > 0) {
    for (let y = firstRow; y <= lastGenRow; y++) {
      for (let x = 0; x < W; x++) {
        if (isSpawn(x, y) || choke.has(keyOf(x, y))) continue;
        if (grid[y]![x] !== 'f') continue;
        if (rng.next() < params.tiles.fire) set(x, y, 'fire');
      }
    }
  }

  // --- symmetry: each bottom-half cell copies its partner, crossings
  // included ---
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

  // --- the obstacle cap: trims blockers, the structural walls among them ---
  enforceObstacleCap(grid, rng, params.wallCapFraction, isSpawn, symmetric, partner);

  // --- connectivity: a route between the spawn bands ---
  const carved = ensureConnectivity(grid, spawnTop, spawnBottom, choke, symmetric, partner);

  // --- camp sites, last, so the number of camps never changes the terrain
  // (`proceduralMap.test.ts` pins density 0 against 2) ---
  const campSpawns = placeCampSites(
    grid,
    rng,
    params,
    choke,
    isSpawn,
    [...spawnTop, ...spawnBottom],
    partner,
  );

  // --- assemble outputs ---
  const tileGrid = new TileGrid(W, H);
  const walls: GridCoord[] = [];
  const halfCovers: GridCoord[] = [];
  const fires: GridCoord[] = [];
  let waterCount = 0;
  let deepCount = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = grid[y]![x]!;
      if (c === 'w') walls.push({ x, y });
      else if (c === 'h') halfCovers.push({ x, y });
      else if (c === 'a') {
        tileGrid.setKind({ x, y }, 'shallow_water');
        waterCount++;
      } else if (c === 'deep') {
        tileGrid.setKind({ x, y }, 'deep_water');
        deepCount++;
      } else if (c === 'fire') {
        tileGrid.setKind({ x, y }, 'fire');
        fires.push({ x, y });
      } else if (c !== 'f') {
        // A ground patch's cell is its own `TileKind`.
        tileGrid.setKind({ x, y }, c);
      }
    }
  }
  const chokeCells: GridCoord[] = [...choke].map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { x: x!, y: y! };
  });

  const blockers = walls.length + halfCovers.length + deepCount;
  const stats: GenStats = {
    walls: walls.length,
    halfCovers: halfCovers.length,
    water: waterCount,
    deepWater: deepCount,
    fires: fires.length,
    obstacleFraction: blockers / (W * H),
    carved,
    chokepoints: chokeCells.length,
  };

  const spawnRegions: SpawnRegion[] = [
    { tiles: spawnTop, availability: 'both' },
    { tiles: spawnBottom, availability: 'both' },
  ];

  return { tileGrid, walls, halfCovers, fires, campSpawns, spawnRegions, chokeCells, stats };
}

/** One crossbar's gap columns: `count` gaps of `width`, each centred on a
 *  random column of its own segment of the width, less an edge margin, so
 *  the chokepoints vary instead of hugging the centre. */
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

/** Trims blocking cells (wall, half cover, deep water) in a shuffled order
 *  until the count is at the cap, drawing only when it is over. A trimmed
 *  wall or half cover becomes floor; trimmed deep water drains to shallow,
 *  still a pool but fordable. When symmetric, each goes with its partner,
 *  so the cap keeps the symmetry. */
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
      if (isBlocking(grid[y]![x]!) && !isSpawn(x, y)) cells.push({ x, y });
    }
  }
  let count = cells.length;
  if (count <= cap) return;
  rng.shuffle(cells);
  const clear = (x: number, y: number): void => {
    grid[y]![x] = grid[y]![x] === 'deep' ? 'a' : 'f';
  };
  for (const c of cells) {
    if (count <= cap) break;
    if (!isBlocking(grid[c.y]![c.x]!)) continue; // already cleared as a partner
    clear(c.x, c.y);
    count--;
    if (symmetric) {
      const p = partner(c.x, c.y);
      if ((p.x !== c.x || p.y !== c.y) && isBlocking(grid[p.y]![p.x]!) && !isSpawn(p.x, p.y)) {
        clear(p.x, p.y);
        count--;
      }
    }
  }
}

/** Breadth-first reachability over eight-way moves; wall, half cover and
 *  deep water block. */
function hasPath(grid: Cell[][], start: GridCoord, goal: GridCoord): boolean {
  const H = grid.length;
  const W = grid[0]!.length;
  const passable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && !isBlocking(grid[y]![x]!);
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

/** Carves blockers into shallow water, nearest the centre column first and
 *  then top to bottom, until the spawn bands' centroids connect; a carved
 *  cell is a crossing from then on. When symmetric, the partner is carved
 *  too, which can only add route. Returns how many were carved. */
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
      if (isBlocking(grid[y]![x]!)) cells.push({ x, y });
    }
  }
  const cx = (W - 1) / 2;
  cells.sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx) || a.y - b.y);

  const carve = (x: number, y: number): number => {
    if (!isBlocking(grid[y]![x]!)) return 0;
    grid[y]![x] = 'a'; // a breach of shallow water, read as a ford
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

/**
 * Rolls the board's camp sites per the sampled plan, on the finished grid,
 * after the cap and the guard, so the camps never change the terrain. A
 * cell hosts a camp when a unit can appear on it and it is in no one's way:
 * passable (shallow water and the ground patches count, as a layout's camp
 * spawns may sit on them, `src/config/layouts.ts`), not fire, which would
 * burn the camp it spawns, not a crossing, not a spawn tile, and at least
 * `standoff` Chebyshev from every spawn tile.
 *
 * Modes:
 * - `pair` — a site and its `partner` (on a `none` board the reflection,
 *   the same fair geometry). It needs a count of 2 or more and a candidate
 *   whose partner is hostable, else it places as `midBand`; any count past
 *   the pair places as `midBand` too.
 * - `midBand` — the midline's row (two on an even board) and
 *   `max(1, floor(H / 6))` rows either side, or anywhere hostable when that
 *   band holds no candidate.
 * - `free` — anywhere hostable.
 * A thin candidate set places fewer sites than the count rather than force
 * a bad tile; a small board with a wide standoff can run out.
 */
function placeCampSites(
  grid: Cell[][],
  rng: RNG,
  params: ResolvedMapParams,
  choke: Set<string>,
  isSpawn: (x: number, y: number) => boolean,
  spawnTiles: readonly GridCoord[],
  partner: (x: number, y: number) => GridCoord,
): GridCoord[] {
  if (params.camps.count <= 0) return [];
  const H = grid.length;
  const W = grid[0]!.length;
  const standoff = params.camps.standoff;

  const hostable = (x: number, y: number): boolean => {
    const c = grid[y]![x]!;
    if (isBlocking(c) || c === 'fire') return false;
    if (choke.has(keyOf(x, y)) || isSpawn(x, y)) return false;
    return spawnTiles.every((t) => Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) >= standoff);
  };
  const candidates: GridCoord[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (hostable(x, y)) candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return [];

  const sites: GridCoord[] = [];
  const taken = new Set<string>();
  const claim = (c: GridCoord): void => {
    sites.push(c);
    taken.add(keyOf(c.x, c.y));
  };

  let mode = params.camps.mode;
  let remaining = params.camps.count;
  if (mode === 'pair' && remaining < 2) mode = 'midBand'; // a single site can't pair

  if (mode === 'pair') {
    const pairables = candidates.filter((c) => {
      const p = partner(c.x, c.y);
      return (p.x !== c.x || p.y !== c.y) && hostable(p.x, p.y);
    });
    if (pairables.length > 0) {
      const c = pairables[rng.int(0, pairables.length - 1)]!;
      claim(c);
      claim(partner(c.x, c.y));
      remaining -= 2;
    }
    mode = 'midBand'; // remainder (or the no-pairable fallback) places mid-band
  }

  // The middle band of rows for `midBand`; `free` takes the whole set.
  const bandHalf = Math.max(1, Math.floor(H / 6));
  const midLo = Math.floor((H - 1) / 2) - bandHalf;
  const midHi = Math.ceil((H - 1) / 2) + bandHalf;
  const banded = candidates.filter((c) => c.y >= midLo && c.y <= midHi);
  const pool = (mode === 'free' ? candidates : banded.length > 0 ? banded : candidates).filter(
    (c) => !taken.has(keyOf(c.x, c.y)),
  );
  for (let i = 0; i < remaining && pool.length > 0; i++) {
    const idx = rng.int(0, pool.length - 1);
    claim(pool[idx]!);
    pool.splice(idx, 1);
  }
  return sites;
}
