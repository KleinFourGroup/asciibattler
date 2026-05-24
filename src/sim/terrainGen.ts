/**
 * Per-encounter terrain generator. Given an encounter's RNG fork and the
 * terrain config, returns a freshly-built TileGrid plus a list of wall
 * coordinates. Walls are returned as raw `GridCoord`s rather than spawned
 * directly — the caller (battle setup) is responsible for turning them
 * into neutral-team Units via `spawnWall`. That seam keeps the generator
 * independent of World construction and easy to test in isolation.
 *
 * Hybrid model: when `layoutId` is null the generator uses the procedural
 * density-driven path; when non-null it dispatches to the hand-authored
 * library at `src/sim/layouts.ts`. `Run` rolls the split at encounter
 * creation time, so a given playthrough sees a mix of procedural variety
 * and tactically-tuned set pieces.
 *
 * **D3 — rectangular arenas.** The generator now takes `(gridW, gridH)`
 * independently. The procedural path scatters walls + water onto any
 * rectangle in the configured size range; the layout path reads the
 * layout's own `gridW` × `gridH` and refuses if the caller's dimensions
 * disagree. The pre-D3 `config.spawnRowsClear` array is gone — reserved
 * rows are computed per-encounter from `gridH` (top 2 rows + bottom 2
 * rows) inside this module via `reservedSpawnRows(gridH)`. D5 will
 * replace this row-based reservation with per-layout spawn regions.
 *
 * Determinism contract: same `(rng state, gridW, gridH, config, layoutId)`
 * → identical `GeneratedTerrain`. Tests rely on this so the fuzz harness
 * can replay any seed; battleSetup feeds in a per-encounter RNG fork so
 * terrain doesn't perturb the battle RNG stream.
 */

import { TileGrid } from './TileGrid';
import type { TerrainConfig } from '../config/terrain';
import type { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import { getLayout, type LayoutDef } from './layouts';

export interface GeneratedTerrain {
  readonly tileGrid: TileGrid;
  readonly walls: readonly GridCoord[];
}

/**
 * Rows that the spawn formation in `battleSetup.spawnTeam` will fill
 * (player melee on row 2, ranged on row 1; enemy melee on `gridH - 3`,
 * ranged on `gridH - 2`). Terrain generation must leave these clear of
 * walls + water so no unit spawns on an obstacle.
 *
 * Returns `[]` for grids too short to spawn into; callers (procedural
 * generator + layout validator) treat this as "no reservation," which
 * makes the lower limit (`gridH < 4`) a layout-bug surface rather than a
 * silent-corruption one — pathological dimensions will surface as
 * out-of-bounds spawn writes downstream.
 *
 * D5 retires this in favor of per-layout `SpawnRegion`s; until then it
 * stays the canonical "where do units land" function so the editor's
 * overlay, the generator's reservation, and the validator agree.
 */
export function reservedSpawnRows(gridH: number): number[] {
  if (gridH < 4) return [];
  return [1, 2, gridH - 3, gridH - 2];
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
 * that the layout's wall coordinates respect the reserved spawn rows and
 * the caller's dimensions match the layout's own `gridW` × `gridH`; a
 * violation is a layout-authoring bug, so the dispatcher throws rather
 * than silently rescuing it (the procedural path's `ensureConnectivity`
 * wall-peel doesn't apply here — hand authored means hand verified).
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
  const reserved = new Set(reservedSpawnRows(layout.gridH));
  for (const w of layout.walls) {
    if (reserved.has(w.y)) {
      throw new Error(
        `generateTerrain: layout "${layout.id}" places a wall on reserved spawn row ${w.y}`,
      );
    }
    if (w.x < 0 || w.y < 0 || w.x >= layout.gridW || w.y >= layout.gridH) {
      throw new Error(
        `generateTerrain: layout "${layout.id}" places a wall at out-of-bounds (${w.x},${w.y})`,
      );
    }
  }
  if (layout.water) {
    for (const w of layout.water) {
      if (reserved.has(w.y)) {
        throw new Error(
          `generateTerrain: layout "${layout.id}" places water on reserved spawn row ${w.y}`,
        );
      }
      if (w.x < 0 || w.y < 0 || w.x >= layout.gridW || w.y >= layout.gridH) {
        throw new Error(
          `generateTerrain: layout "${layout.id}" places water at out-of-bounds (${w.x},${w.y})`,
        );
      }
    }
  }

  const tileGrid = new TileGrid(layout.gridW, layout.gridH);
  if (layout.water) {
    for (const w of layout.water) tileGrid.setKind(w, 'shallow_water');
  }
  return { tileGrid, walls: layout.walls.slice() };
}

function generateProcedural(
  rng: RNG,
  gridW: number,
  gridH: number,
  config: TerrainConfig,
): GeneratedTerrain {
  const total = gridW * gridH;
  const targetWalls = Math.floor(total * config.wallDensity);
  const targetWater = Math.floor(total * config.shallowWaterDensity);

  // Build candidate pool: every cell EXCEPT the spawn rows. Shuffling once
  // and slicing off two disjoint chunks (walls then water) gives both
  // distributions for free, with zero overlap by construction.
  const reservedRows = reservedSpawnRows(gridH);
  const reservedSet = new Set(reservedRows);
  const candidates: GridCoord[] = [];
  for (let y = 0; y < gridH; y++) {
    if (reservedSet.has(y)) continue;
    for (let x = 0; x < gridW; x++) {
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
    walls = openCutsUntilConnected(walls, gridW, gridH, reservedRows);
  }

  return { tileGrid, walls };
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
 * Connectivity guard. Probes a path from the lowest spawn row to the
 * highest using 8-dir BFS over the unblocked cells; if blocked, drops
 * walls one at a time (in input order) until the path opens. Worst case
 * removes every wall, which is fine — degenerate seeds turn into bare
 * arenas rather than unplayable battles.
 *
 * Input order is deterministic (Fisher–Yates output), so the "which wall
 * gets removed first" choice is also deterministic per seed.
 */
function openCutsUntilConnected(
  walls: readonly GridCoord[],
  gridW: number,
  gridH: number,
  reservedRows: readonly number[],
): GridCoord[] {
  if (reservedRows.length < 2) return walls.slice();
  const center = Math.floor(gridW / 2);
  const start: GridCoord = { x: center, y: Math.min(...reservedRows) };
  const goal: GridCoord = { x: center, y: Math.max(...reservedRows) };

  const remaining = walls.slice();
  while (!hasPath(start, goal, remaining, gridW, gridH)) {
    if (remaining.length === 0) return remaining;
    remaining.shift();
  }
  return remaining;
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
