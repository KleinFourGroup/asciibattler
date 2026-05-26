/**
 * Per-encounter terrain generator. Given an encounter's RNG fork, the
 * arena dimensions, and the terrain config, returns a freshly-built
 * `GeneratedTerrain` — TileGrid + wall coords + spawn regions. The
 * caller (battle setup) is responsible for turning the walls into
 * neutral-team `Unit`s via `spawnWall` and for drawing player + enemy
 * regions from the returned `spawnRegions`. That seam keeps the
 * generator independent of World construction and easy to test in
 * isolation.
 *
 * Hybrid model: when `layoutId` is null the generator uses the
 * procedural density-driven path; when non-null it dispatches to the
 * hand-authored library at `src/sim/layouts.ts`. `Run` rolls the split
 * at encounter creation time, so a given playthrough sees a mix of
 * procedural variety and tactically-tuned set pieces.
 *
 * **D3 — rectangular arenas.** The generator takes `(gridW, gridH)`
 * independently. Procedural scatters obstacles on any rectangle in the
 * configured size range; the layout path reads the layout's own
 * `gridW` × `gridH` and refuses if the caller's dimensions disagree.
 *
 * **D5 — explicit spawn regions.** Every encounter now carries
 * `SpawnRegion[]` (each region is exactly 8 tiles + an availability
 * flag). Hand-authored layouts declare their regions in JSON;
 * procedural emits two `'both'`-availability bands on the top and
 * bottom edges of the arena. Walls + water mask against the union of
 * all spawn tiles instead of the pre-D5 `reservedSpawnRows` array
 * (retired in D5.D.A along with the editor's stripe overlay).
 *
 * Determinism contract: same `(rng state, gridW, gridH, config,
 * layoutId)` → identical `GeneratedTerrain`. Tests rely on this so the
 * fuzz harness can replay any seed; battleSetup feeds in a per-
 * encounter RNG fork so terrain doesn't perturb the battle RNG stream.
 */

import { TileGrid } from './TileGrid';
import type { TerrainConfig } from '../config/terrain';
import type { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import {
  getLayout,
  SPAWN_REGION_TILE_COUNT,
  type LayoutDef,
  type SpawnRegion,
} from './layouts';

export interface GeneratedTerrain {
  readonly tileGrid: TileGrid;
  readonly walls: readonly GridCoord[];
  /** D6: neutral-team LOS-transparent obstacles. Empty for procedural
   *  (D6 is hand-authored-only); hand-authored layouts may declare any
   *  count. Pathfinding blocks through them; AttackBehavior shoots over. */
  readonly halfCovers: readonly GridCoord[];
  /** D7.A: impassable tile (Infinity pathfinding cost, LOS-transparent).
   *  Stored on `tileGrid` itself as `kind === 'chasm'`; this array is a
   *  parallel readout so callers (renderer, editor, tests) can iterate
   *  chasm coords without re-walking the grid. Empty for procedural —
   *  hand-authored-only in D7. */
  readonly chasms: readonly GridCoord[];
  readonly spawnRegions: readonly SpawnRegion[];
}

export function generateTerrain(
  rng: RNG,
  gridW: number,
  gridH: number,
  config: TerrainConfig,
  layoutId: string | null = null,
): GeneratedTerrain {
  if (layoutId !== null) {
    const layout = getLayout(layoutId);
    if (!layout) {
      throw new Error(`generateTerrain: unknown layoutId="${layoutId}"`);
    }
    return generateFromLayout(layout, gridW, gridH);
  }
  return generateProcedural(rng, gridW, gridH, config);
}

/**
 * Resolve a hand-authored layout into a `GeneratedTerrain`. Validates
 * that the caller's dimensions match the layout's own `gridW` × `gridH`;
 * a violation is a layout-authoring bug, so the dispatcher throws rather
 * than silently rescuing it (the procedural path's `ensureConnectivity`
 * wall-peel doesn't apply here — hand authored means hand verified).
 *
 * D5 — wall/water overlap with spawn tiles is enforced by zod at
 * module-load time (see `src/config/layouts.ts`); the generator no
 * longer re-checks it.
 */
function generateFromLayout(
  layout: LayoutDef,
  gridW: number,
  gridH: number,
): GeneratedTerrain {
  if (gridW !== layout.gridW || gridH !== layout.gridH) {
    throw new Error(
      `generateTerrain: layout "${layout.id}" requires gridW=${layout.gridW} gridH=${layout.gridH} (got ${gridW}x${gridH})`,
    );
  }

  const tileGrid = new TileGrid(layout.gridW, layout.gridH);
  if (layout.water) {
    for (const w of layout.water) tileGrid.setKind(w, 'shallow_water');
  }
  if (layout.chasms) {
    for (const c of layout.chasms) tileGrid.setKind(c, 'chasm');
  }
  return {
    tileGrid,
    walls: layout.walls.slice(),
    halfCovers: layout.halfCovers ? layout.halfCovers.slice() : [],
    chasms: layout.chasms ? layout.chasms.slice() : [],
    spawnRegions: layout.spawns,
  };
}

function generateProcedural(
  rng: RNG,
  gridW: number,
  gridH: number,
  config: TerrainConfig,
): GeneratedTerrain {
  const spawnRegions = defaultProceduralSpawnRegions(gridW, gridH);
  const reservedCells = new Set<string>();
  for (const region of spawnRegions) {
    for (const t of region.tiles) reservedCells.add(`${t.x},${t.y}`);
  }

  const total = gridW * gridH;
  const targetWalls = Math.floor(total * config.wallDensity);
  const targetWater = Math.floor(total * config.shallowWaterDensity);

  // Build candidate pool: every cell EXCEPT spawn tiles. Shuffling once
  // and slicing off two disjoint chunks (walls then water) gives both
  // distributions for free, with zero overlap by construction.
  const candidates: GridCoord[] = [];
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (reservedCells.has(`${x},${y}`)) continue;
      candidates.push({ x, y });
    }
  }
  shuffleInPlace(candidates, rng);

  let walls: GridCoord[] = candidates.slice(0, Math.min(targetWalls, candidates.length));
  const tileGrid = new TileGrid(gridW, gridH);
  const waterStart = walls.length;
  const waterEnd = Math.min(candidates.length, waterStart + targetWater);
  for (let i = waterStart; i < waterEnd; i++) {
    tileGrid.setKind(candidates[i]!, 'shallow_water');
  }

  if (config.ensureConnectivity) {
    walls = openCutsUntilConnected(walls, gridW, gridH, spawnRegions);
  }

  // D6 + D7.A: procedural is hand-authored-only for half-cover AND
  // chasm (no density knobs in config/terrain.json). Returning empty
  // arrays keeps the shape stable for the caller.
  return { tileGrid, walls, halfCovers: [], chasms: [], spawnRegions };
}

/**
 * Two `'both'` bands on the literal top and bottom edges (y=0 and
 * y=gridH-1), each exactly `SPAWN_REGION_TILE_COUNT` (8) tiles wide,
 * centered horizontally. Requires `gridW >= 8` and `gridH >= 2` — the
 * procedural side range (10-20) and the layout side range (8-32) both
 * satisfy this.
 */
function defaultProceduralSpawnRegions(gridW: number, gridH: number): SpawnRegion[] {
  if (gridW < SPAWN_REGION_TILE_COUNT) {
    throw new Error(
      `defaultProceduralSpawnRegions: gridW=${gridW} < ${SPAWN_REGION_TILE_COUNT} cannot hold an 8-tile band`,
    );
  }
  if (gridH < 2) {
    throw new Error(`defaultProceduralSpawnRegions: gridH=${gridH} < 2 cannot hold top + bottom bands`);
  }
  const xStart = Math.floor((gridW - SPAWN_REGION_TILE_COUNT) / 2);
  const topTiles: GridCoord[] = [];
  const bottomTiles: GridCoord[] = [];
  for (let i = 0; i < SPAWN_REGION_TILE_COUNT; i++) {
    topTiles.push({ x: xStart + i, y: 0 });
    bottomTiles.push({ x: xStart + i, y: gridH - 1 });
  }
  return [
    { tiles: topTiles, availability: 'both' },
    { tiles: bottomTiles, availability: 'both' },
  ];
}

/**
 * Fisher–Yates shuffle in place. Uses the supplied RNG so the result is
 * deterministic per seed.
 */
function shuffleInPlace<T>(arr: T[], rng: RNG): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/**
 * Connectivity guard. Probes a path between the first two distinct
 * spawn regions using 8-dir BFS over the unblocked cells; if blocked,
 * drops walls one at a time (in input order) until the path opens.
 * Worst case removes every wall, which is fine — degenerate seeds turn
 * into bare arenas rather than unplayable battles.
 *
 * Endpoints: the geometric centroid of each region (rounded to the
 * nearest integer cell). For the procedural defaults — top + bottom
 * bands of 8 contiguous tiles — these land on the center column of
 * each band, mirroring the pre-D5 column-of-spawn-row check.
 *
 * Input order is deterministic (Fisher–Yates output), so the "which
 * wall gets removed first" choice is also deterministic per seed.
 */
function openCutsUntilConnected(
  walls: readonly GridCoord[],
  gridW: number,
  gridH: number,
  spawnRegions: readonly SpawnRegion[],
): GridCoord[] {
  if (spawnRegions.length < 2) return walls.slice();
  const start = centroidOf(spawnRegions[0]!);
  const goal = centroidOf(spawnRegions[1]!);

  const remaining = walls.slice();
  while (!hasPath(start, goal, remaining, gridW, gridH)) {
    if (remaining.length === 0) return remaining;
    remaining.shift();
  }
  return remaining;
}

function centroidOf(region: SpawnRegion): GridCoord {
  let sx = 0;
  let sy = 0;
  for (const t of region.tiles) {
    sx += t.x;
    sy += t.y;
  }
  return { x: Math.round(sx / region.tiles.length), y: Math.round(sy / region.tiles.length) };
}

function hasPath(
  start: GridCoord,
  goal: GridCoord,
  walls: readonly GridCoord[],
  gridW: number,
  gridH: number,
): boolean {
  const blocked = new Set<string>();
  for (const w of walls) blocked.add(`${w.x},${w.y}`);
  if (blocked.has(`${goal.x},${goal.y}`)) return false;

  const visited = new Set<string>([`${start.x},${start.y}`]);
  const queue: GridCoord[] = [start];
  while (queue.length > 0) {
    const c = queue.shift()!;
    if (c.x === goal.x && c.y === goal.y) return true;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
        const k = `${nx},${ny}`;
        if (visited.has(k) || blocked.has(k)) continue;
        visited.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return false;
}
