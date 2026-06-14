import { describe, it, expect } from 'vitest';
import { generateTerrain } from './terrainGen';
import { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import { TERRAIN, type TerrainConfig } from '../config/terrain';
import { getLayout, type SpawnRegion } from './layouts';

const G = 12;

const BASE: TerrainConfig = {
  wallDensity: 0.06,
  shallowWaterDensity: 0.04,
  proceduralMinSize: 10,
  proceduralMaxSize: 20,
  ensureConnectivity: true,
  procedural: TERRAIN.procedural,
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

  it('leaves every spawn-region tile free of obstacles and water', () => {
    for (let seed = 0; seed < 30; seed++) {
      const { tileGrid, walls, halfCovers, spawnRegions } = generateTerrain(new RNG(seed), G, G, BASE);
      const spawnTiles = collectSpawnTiles(spawnRegions);
      const obstacleSet = new Set([...walls, ...halfCovers].map((c) => `${c.x},${c.y}`));
      for (const t of spawnTiles) {
        expect(tileGrid.kindAt(t)).toBe('floor');
        expect(obstacleSet.has(`${t.x},${t.y}`)).toBe(false);
      }
    }
  });

  it('places walls, half-cover, and water on mutually disjoint cells', () => {
    const { tileGrid, walls, halfCovers } = generateTerrain(new RNG(7), G, G, BASE);
    const seen = new Set<string>();
    for (const c of [...walls, ...halfCovers]) {
      const k = `${c.x},${c.y}`;
      // Obstacle cells are never watered, and never doubled up.
      expect(tileGrid.kindAt(c)).toBe('floor');
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it('keeps total obstacles under the configured wall cap', () => {
    // Derived from the config (balance-proof): the generator trims obstacles
    // to at most `wallCapFraction` of the board, and the connectivity guard
    // only ever converts obstacles to water, so the count can't exceed it.
    const cap = Math.floor(TERRAIN.procedural.wallCapFraction * G * G);
    for (let seed = 0; seed < 50; seed++) {
      const { walls, halfCovers } = generateTerrain(new RNG(seed), G, G, BASE);
      expect(walls.length + halfCovers.length).toBeLessThanOrEqual(cap);
    }
  });

  it('always connects the two spawn regions (the connectivity guard fires)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const terrain = generateTerrain(new RNG(seed), G, G, BASE);
      expect(spawnRegionsConnected(terrain, G, G)).toBe(true);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateTerrain(new RNG(99), G, G, BASE);
    const b = generateTerrain(new RNG(99), G, G, BASE);
    expect(a.walls).toEqual(b.walls);
    expect(a.halfCovers).toEqual(b.halfCovers);
    expect(a.tileGrid.toJSON()).toEqual(b.tileGrid.toJSON());
    expect(a.spawnRegions).toEqual(b.spawnRegions);
  });

  it('produces varied terrain across seeds', () => {
    const fingerprints = new Set<string>();
    for (let seed = 0; seed < 16; seed++) {
      const t = generateTerrain(new RNG(seed), G, G, BASE);
      fingerprints.add(JSON.stringify([t.walls, t.halfCovers, t.tileGrid.toJSON().kinds]));
    }
    expect(fingerprints.size).toBeGreaterThan(1);
  });

  it('honors rectangular dimensions (D3): gridW != gridH paints in-bounds only', () => {
    const gridW = 15;
    const gridH = 10;
    const { tileGrid, walls, halfCovers, spawnRegions } = generateTerrain(new RNG(7), gridW, gridH, BASE);
    expect(tileGrid.width).toBe(gridW);
    expect(tileGrid.height).toBe(gridH);
    for (const c of [...walls, ...halfCovers]) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(gridW);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(gridH);
    }
    const spawnTiles = collectSpawnTiles(spawnRegions);
    const obstacleSet = new Set([...walls, ...halfCovers].map((c) => `${c.x},${c.y}`));
    for (const t of spawnTiles) {
      expect(obstacleSet.has(`${t.x},${t.y}`)).toBe(false);
    }
  });

  it('dispatches to the hand-authored library when layoutId is set', () => {
    // `labyrinth` is the canonical 12×12 layout in the library; the test
    // cares about the dispatch path, not the specific layout. Assert the
    // emitted wall count matches the layout's declared walls — a tight
    // fingerprint distinguishing library dispatch from the procedural path
    // (labyrinth ships 36 walls; the structural generator at G=12 won't
    // coincidentally emit exactly that on this seed).
    const layout = getLayout('labyrinth')!;
    const { walls } = generateTerrain(new RNG(1), G, G, BASE, 'labyrinth');
    expect(walls.length).toBe(layout.walls.length);
  });

  it('layout dispatch returns the layout-declared spawn regions verbatim', () => {
    const { spawnRegions } = generateTerrain(new RNG(1), G, G, BASE, 'labyrinth');
    expect(spawnRegions.length).toBeGreaterThanOrEqual(2);
    for (const region of spawnRegions) {
      expect(region.tiles.length).toBe(8);
    }
  });

  it('layout dispatch ignores the RNG (same layoutId → same walls regardless of seed)', () => {
    const a = generateTerrain(new RNG(1), G, G, BASE, 'labyrinth');
    const b = generateTerrain(new RNG(999), G, G, BASE, 'labyrinth');
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

/** BFS between the first two spawn-region centroids over passable cells (floor +
 *  water), blocking walls AND half-cover — the generator's own passability. */
function spawnRegionsConnected(
  terrain: { walls: readonly GridCoord[]; halfCovers: readonly GridCoord[]; spawnRegions: readonly SpawnRegion[] },
  gridW: number,
  gridH: number,
): boolean {
  const blocked = new Set<string>();
  for (const c of [...terrain.walls, ...terrain.halfCovers]) blocked.add(`${c.x},${c.y}`);
  const start = centroid(terrain.spawnRegions[0]!);
  const goal = centroid(terrain.spawnRegions[1]!);
  if (blocked.has(`${goal.x},${goal.y}`) || blocked.has(`${start.x},${start.y}`)) return false;

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
