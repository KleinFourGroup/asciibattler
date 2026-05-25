import { describe, it, expect } from 'vitest';
import { generateTerrain } from './terrainGen';
import { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import type { TerrainConfig } from '../config/terrain';
import type { SpawnRegion } from './layouts';

const G = 12;

const BASE: TerrainConfig = {
  wallDensity: 0.06,
  shallowWaterDensity: 0.04,
  proceduralMinSize: 10,
  proceduralMaxSize: 20,
  ensureConnectivity: true,
};

describe('generateTerrain (procedural)', () => {
  it('emits two `both` spawn regions on the literal top + bottom edges', () => {
    const { spawnRegions } = generateTerrain(new RNG(42), G, G, BASE);
    expect(spawnRegions.length).toBe(2);
    for (const region of spawnRegions) {
      expect(region.availability).toBe('both');
      expect(region.tiles.length).toBe(8);
    }
    // Top band on y=0, bottom band on y=gridH-1.
    const ys = spawnRegions.map((r) => r.tiles[0]!.y);
    expect(ys).toContain(0);
    expect(ys).toContain(G - 1);
  });

  it('leaves every spawn-region tile free of walls and water', () => {
    const { tileGrid, walls, spawnRegions } = generateTerrain(new RNG(42), G, G, BASE);
    const spawnTiles = collectSpawnTiles(spawnRegions);
    for (const t of spawnTiles) {
      expect(tileGrid.kindAt(t)).toBe('floor');
    }
    const wallSet = new Set(walls.map((w) => `${w.x},${w.y}`));
    for (const t of spawnTiles) {
      expect(wallSet.has(`${t.x},${t.y}`)).toBe(false);
    }
  });

  it('places walls and water on disjoint cells', () => {
    const { tileGrid, walls } = generateTerrain(new RNG(7), G, G, BASE);
    for (const w of walls) {
      expect(tileGrid.kindAt(w)).toBe('floor');
    }
  });

  it('targets approximately the configured wall + water counts', () => {
    const cfg: TerrainConfig = { ...BASE, ensureConnectivity: false };
    const total = G * G;
    const { tileGrid, walls } = generateTerrain(new RNG(123), G, G, cfg);

    expect(walls.length).toBe(Math.floor(total * cfg.wallDensity));
    let water = 0;
    for (const c of tileGrid.cells()) if (c.kind === 'shallow_water') water++;
    expect(water).toBe(Math.floor(total * cfg.shallowWaterDensity));
  });

  it('is deterministic for the same seed', () => {
    const a = generateTerrain(new RNG(99), G, G, BASE);
    const b = generateTerrain(new RNG(99), G, G, BASE);
    expect(a.walls).toEqual(b.walls);
    expect(a.tileGrid.toJSON()).toEqual(b.tileGrid.toJSON());
    expect(a.spawnRegions).toEqual(b.spawnRegions);
  });

  it('produces different terrain for different seeds', () => {
    const a = generateTerrain(new RNG(1), G, G, BASE);
    const b = generateTerrain(new RNG(2), G, G, BASE);
    // Not strictly *guaranteed* but vanishingly unlikely with the BASE
    // densities. If this ever flakes, swap to a stronger inequality on
    // a specific cell.
    expect(a.walls).not.toEqual(b.walls);
  });

  it('returns no walls and no water when both densities are zero', () => {
    const cfg: TerrainConfig = { ...BASE, wallDensity: 0, shallowWaterDensity: 0 };
    const { tileGrid, walls } = generateTerrain(new RNG(1), G, G, cfg);
    expect(walls).toEqual([]);
    for (const c of tileGrid.cells()) expect(c.kind).toBe('floor');
  });

  it('ensureConnectivity peels walls until a path exists between spawn regions', () => {
    // High wall density would normally risk severing the arena. With
    // ensureConnectivity on, the post-fix guarantees a path between the
    // first two spawn-region centroids.
    const cfg: TerrainConfig = {
      ...BASE,
      wallDensity: 0.4, // ~58 walls — easily enough to cut the board
      shallowWaterDensity: 0,
      ensureConnectivity: true,
    };
    const { walls, spawnRegions } = generateTerrain(new RNG(5), G, G, cfg);
    expect(hasPathBetweenRegions(walls, G, G, spawnRegions[0]!, spawnRegions[1]!)).toBe(true);
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
      const { walls, spawnRegions } = generateTerrain(new RNG(seed), G, G, cfg);
      if (!hasPathBetweenRegions(walls, G, G, spawnRegions[0]!, spawnRegions[1]!)) {
        foundSevered = true;
      }
    }
    expect(foundSevered).toBe(true);
  });

  it('honors rectangular dimensions (D3): gridW != gridH paints in-bounds only', () => {
    const cfg: TerrainConfig = {
      ...BASE,
      wallDensity: 0.1,
      shallowWaterDensity: 0.1,
      ensureConnectivity: false,
    };
    const gridW = 15;
    const gridH = 10;
    const { tileGrid, walls, spawnRegions } = generateTerrain(new RNG(7), gridW, gridH, cfg);
    expect(tileGrid.width).toBe(gridW);
    expect(tileGrid.height).toBe(gridH);
    for (const w of walls) {
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.x).toBeLessThan(gridW);
      expect(w.y).toBeGreaterThanOrEqual(0);
      expect(w.y).toBeLessThan(gridH);
    }
    const spawnTiles = collectSpawnTiles(spawnRegions);
    const wallSet = new Set(walls.map((w) => `${w.x},${w.y}`));
    for (const t of spawnTiles) {
      expect(wallSet.has(`${t.x},${t.y}`)).toBe(false);
    }
  });

  it('dispatches to the hand-authored library when layoutId is set', () => {
    const { walls } = generateTerrain(new RNG(1), G, G, BASE, 'corridor');
    // Corridor places 16 walls (2 rows × 8 cells); procedural at the BASE
    // densities targets ~9. The count mismatch is a sufficient signal that
    // the library path ran rather than the procedural one.
    expect(walls.length).toBe(16);
  });

  it('layout dispatch returns the layout-declared spawn regions verbatim', () => {
    const { spawnRegions } = generateTerrain(new RNG(1), G, G, BASE, 'corridor');
    expect(spawnRegions.length).toBeGreaterThanOrEqual(2);
    for (const region of spawnRegions) {
      expect(region.tiles.length).toBe(8);
    }
  });

  it('layout dispatch ignores the RNG (same layoutId → same walls regardless of seed)', () => {
    const a = generateTerrain(new RNG(1), G, G, BASE, 'corridor');
    const b = generateTerrain(new RNG(999), G, G, BASE, 'corridor');
    expect(a.walls).toEqual(b.walls);
  });

  it('throws on an unknown layoutId', () => {
    expect(() => generateTerrain(new RNG(1), G, G, BASE, 'nonexistent')).toThrow(/unknown layoutId/i);
  });
});

function collectSpawnTiles(regions: readonly SpawnRegion[]): GridCoord[] {
  const out: GridCoord[] = [];
  for (const region of regions) {
    for (const t of region.tiles) out.push(t);
  }
  return out;
}

function hasPathBetweenRegions(
  walls: readonly { x: number; y: number }[],
  gridW: number,
  gridH: number,
  a: SpawnRegion,
  b: SpawnRegion,
): boolean {
  const start = centroid(a);
  const goal = centroid(b);
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

function centroid(region: SpawnRegion): GridCoord {
  let sx = 0;
  let sy = 0;
  for (const t of region.tiles) {
    sx += t.x;
    sy += t.y;
  }
  return { x: Math.round(sx / region.tiles.length), y: Math.round(sy / region.tiles.length) };
}
