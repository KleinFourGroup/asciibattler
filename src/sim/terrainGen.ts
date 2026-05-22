/**
 * Per-encounter terrain generator. Given an encounter's RNG fork and the
 * terrain config, returns a freshly-built TileGrid plus a list of wall
 * coordinates. Walls are returned as raw `GridCoord`s rather than spawned
 * directly — the caller (battle setup) is responsible for turning them
 * into neutral-team Units via `spawnWall`. That seam keeps the generator
 * independent of World construction and easy to test in isolation.
 *
 * Hybrid model: in C1a only the procedural path is reachable; the
 * `layoutId` parameter is plumbed but the library is empty, so a non-null
 * id throws. C1b+ will wire up the layout resolver alongside hand-
 * authored set pieces.
 *
 * Determinism contract: same `(rng state, gridSize, config, layoutId)` →
 * identical `GeneratedTerrain`. Tests rely on this so the fuzz harness
 * can replay any seed; the integration commit feeds in a per-encounter
 * RNG fork so terrain doesn't perturb the battle RNG stream.
 */

import { TileGrid } from './TileGrid';
import type { TerrainConfig } from '../config/terrain';
import type { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';

export interface GeneratedTerrain {
  readonly tileGrid: TileGrid;
  readonly walls: readonly GridCoord[];
}

export function generateTerrain(
  rng: RNG,
  gridSize: number,
  config: TerrainConfig,
  layoutId: string | null = null,
): GeneratedTerrain {
  if (layoutId !== null) {
    throw new Error(
      `generateTerrain: layout library not implemented yet (layoutId="${layoutId}")`,
    );
  }
  return generateProcedural(rng, gridSize, config);
}

function generateProcedural(
  rng: RNG,
  gridSize: number,
  config: TerrainConfig,
): GeneratedTerrain {
  const total = gridSize * gridSize;
  const targetWalls = Math.floor(total * config.wallDensity);
  const targetWater = Math.floor(total * config.shallowWaterDensity);

  // Build candidate pool: every cell EXCEPT the spawn rows. Shuffling once
  // and slicing off two disjoint chunks (walls then water) gives both
  // distributions for free, with zero overlap by construction.
  const reservedRows = new Set(config.spawnRowsClear);
  const candidates: GridCoord[] = [];
  for (let y = 0; y < gridSize; y++) {
    if (reservedRows.has(y)) continue;
    for (let x = 0; x < gridSize; x++) {
      candidates.push({ x, y });
    }
  }
  shuffleInPlace(candidates, rng);

  let walls: GridCoord[] = candidates.slice(0, Math.min(targetWalls, candidates.length));
  const tileGrid = new TileGrid(gridSize, gridSize);
  const waterStart = walls.length;
  const waterEnd = Math.min(candidates.length, waterStart + targetWater);
  for (let i = waterStart; i < waterEnd; i++) {
    tileGrid.setKind(candidates[i]!, 'shallow_water');
  }

  if (config.ensureConnectivity) {
    walls = openCutsUntilConnected(walls, gridSize, config.spawnRowsClear);
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
  gridSize: number,
  spawnRowsClear: readonly number[],
): GridCoord[] {
  if (spawnRowsClear.length < 2) return walls.slice();
  const center = Math.floor(gridSize / 2);
  const start: GridCoord = { x: center, y: Math.min(...spawnRowsClear) };
  const goal: GridCoord = { x: center, y: Math.max(...spawnRowsClear) };

  const remaining = walls.slice();
  while (!hasPath(start, goal, remaining, gridSize)) {
    if (remaining.length === 0) return remaining;
    remaining.shift();
  }
  return remaining;
}

function hasPath(
  start: GridCoord,
  goal: GridCoord,
  walls: readonly GridCoord[],
  gridSize: number,
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
        if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
        const k = `${nx},${ny}`;
        if (visited.has(k) || blocked.has(k)) continue;
        visited.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return false;
}
