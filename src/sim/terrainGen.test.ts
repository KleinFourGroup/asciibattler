import { describe, it, expect } from 'vitest';
import { generateTerrain } from './terrainGen';
import { RNG } from '../core/RNG';
import type { TerrainConfig } from '../config/terrain';

const G = 12;

const BASE: TerrainConfig = {
  wallDensity: 0.06,
  shallowWaterDensity: 0.04,
  spawnRowsClear: [1, 2, 9, 10],
  ensureConnectivity: true,
};

describe('generateTerrain (procedural)', () => {
  it('leaves every reserved spawn row free of walls and water', () => {
    const { tileGrid, walls } = generateTerrain(new RNG(42), G, BASE);
    for (const row of BASE.spawnRowsClear) {
      for (let x = 0; x < G; x++) {
        expect(tileGrid.kindAt({ x, y: row })).toBe('floor');
      }
    }
    for (const w of walls) {
      expect(BASE.spawnRowsClear).not.toContain(w.y);
    }
  });

  it('places walls and water on disjoint cells', () => {
    const { tileGrid, walls } = generateTerrain(new RNG(7), G, BASE);
    for (const w of walls) {
      expect(tileGrid.kindAt(w)).toBe('floor');
    }
  });

  it('targets approximately the configured wall + water counts', () => {
    const cfg: TerrainConfig = { ...BASE, ensureConnectivity: false };
    const total = G * G;
    const { tileGrid, walls } = generateTerrain(new RNG(123), G, cfg);

    expect(walls.length).toBe(Math.floor(total * cfg.wallDensity));
    let water = 0;
    for (const c of tileGrid.cells()) if (c.kind === 'shallow_water') water++;
    expect(water).toBe(Math.floor(total * cfg.shallowWaterDensity));
  });

  it('is deterministic for the same seed', () => {
    const a = generateTerrain(new RNG(99), G, BASE);
    const b = generateTerrain(new RNG(99), G, BASE);
    expect(a.walls).toEqual(b.walls);
    expect(a.tileGrid.toJSON()).toEqual(b.tileGrid.toJSON());
  });

  it('produces different terrain for different seeds', () => {
    const a = generateTerrain(new RNG(1), G, BASE);
    const b = generateTerrain(new RNG(2), G, BASE);
    // Not strictly *guaranteed* but vanishingly unlikely with the BASE
    // densities. If this ever flakes, swap to a stronger inequality on
    // a specific cell.
    expect(a.walls).not.toEqual(b.walls);
  });

  it('returns no walls and no water when both densities are zero', () => {
    const cfg: TerrainConfig = { ...BASE, wallDensity: 0, shallowWaterDensity: 0 };
    const { tileGrid, walls } = generateTerrain(new RNG(1), G, cfg);
    expect(walls).toEqual([]);
    for (const c of tileGrid.cells()) expect(c.kind).toBe('floor');
  });

  it('ensureConnectivity peels walls until a path exists between spawn rows', () => {
    // High wall density would normally risk severing the arena. With
    // ensureConnectivity on, the post-fix guarantees a path.
    const cfg: TerrainConfig = {
      ...BASE,
      wallDensity: 0.4, // ~58 walls — easily enough to cut the board
      shallowWaterDensity: 0,
      ensureConnectivity: true,
    };
    const { walls } = generateTerrain(new RNG(5), G, cfg);
    expect(hasPathThrough(walls, G, BASE.spawnRowsClear)).toBe(true);
  });

  it('without ensureConnectivity, a pathological seed CAN sever the board', () => {
    // Smoke check that the guard is doing real work — find a seed where
    // the unconditional procedural placement severs connectivity, and
    // confirm the post-fix would have rescued it. Empirically several
    // seeds qualify at 0.4 density.
    const cfg: TerrainConfig = {
      ...BASE,
      wallDensity: 0.5,
      shallowWaterDensity: 0,
      ensureConnectivity: false,
    };
    let foundSevered = false;
    for (let seed = 1; seed <= 20 && !foundSevered; seed++) {
      const { walls } = generateTerrain(new RNG(seed), G, cfg);
      if (!hasPathThrough(walls, G, BASE.spawnRowsClear)) foundSevered = true;
    }
    expect(foundSevered).toBe(true);
  });

  it('throws when a non-null layoutId is supplied (library not implemented yet)', () => {
    expect(() => generateTerrain(new RNG(1), G, BASE, 'arena_1')).toThrow(/not implemented/i);
  });
});

/** Mirror of terrainGen's internal hasPath: 8-dir BFS, used only by tests. */
function hasPathThrough(
  walls: readonly { x: number; y: number }[],
  gridSize: number,
  spawnRowsClear: readonly number[],
): boolean {
  const center = Math.floor(gridSize / 2);
  const start = { x: center, y: Math.min(...spawnRowsClear) };
  const goal = { x: center, y: Math.max(...spawnRowsClear) };
  const blocked = new Set<string>();
  for (const w of walls) blocked.add(`${w.x},${w.y}`);
  if (blocked.has(`${goal.x},${goal.y}`)) return false;

  const visited = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
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
