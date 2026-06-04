/**
 * H2 — randomized spawn-tile selection.
 *
 * `spawnTeam` shuffles the region's tiles and places the team on the
 * first `min(team, tiles)` of them — i.e. a uniformly random subset, in
 * random order — for BOTH teams (added in D5.B; H2 locks the contract
 * in with tests + relaxes the per-region tile count to a range so the
 * subset case has room to matter). These tests pin three properties:
 *
 *   1. the chosen subset always stays within the region's tiles;
 *   2. over many seeds every region tile gets used (no dead tile);
 *   3. placement is deterministic per seed, yet varies across seeds.
 *
 * Regions are built as plain `SpawnRegion` TS values (not through the
 * zod schema) so the count is free to exceed the team size — the same
 * pattern as `spawn-overflow.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { World } from '../../src/sim/World';
import { RNG } from '../../src/core/RNG';
import { spawnTeam } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import { SPAWN_REGION_MAX_TILES } from '../../src/sim/layouts';
import type { GameEvents } from '../../src/core/events';
import type { Team } from '../../src/sim/Unit';
import type { SpawnRegion } from '../../src/sim/layouts';
import type { GridCoord } from '../../src/core/types';

const TEAM_SIZE = 5; // < SPAWN_REGION_MAX_TILES, so the subset case engages

const key = (c: GridCoord) => `${c.x},${c.y}`;

/** A single horizontal band of `n` distinct tiles for `team`. */
function rowRegion(team: Team, n: number): SpawnRegion {
  const availability = team === 'player' ? 'player' : 'enemy';
  return {
    tiles: Array.from({ length: n }, (_, i) => ({ x: i + 1, y: team === 'player' ? 2 : 9 })),
    availability,
  };
}

/** Spawn `count` units into a fresh world and return their tile coords. */
function spawnPositions(team: Team, region: SpawnRegion, seed: number, count: number): GridCoord[] {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const rng = new RNG(seed);
  const templates = Array.from({ length: count }, () => rollUnit('melee', rng));
  spawnTeam(world, team, templates, region, rng);
  return world.units.filter((u) => u.team === team).map((u) => ({ ...u.position }));
}

describe('H2 randomized spawn-tile selection', () => {
  it('places the team on a distinct subset entirely within the region', () => {
    const region = rowRegion('player', SPAWN_REGION_MAX_TILES);
    const tileKeys = new Set(region.tiles.map(key));
    const positions = spawnPositions('player', region, 7, TEAM_SIZE);

    expect(positions).toHaveLength(TEAM_SIZE);
    for (const p of positions) {
      expect(tileKeys.has(key(p))).toBe(true);
    }
    // No two units share a tile.
    expect(new Set(positions.map(key)).size).toBe(TEAM_SIZE);
  });

  it('covers every region tile over many seeds (no dead tile)', () => {
    const region = rowRegion('player', SPAWN_REGION_MAX_TILES);
    const used = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      for (const p of spawnPositions('player', region, seed, TEAM_SIZE)) used.add(key(p));
    }
    expect(used.size).toBe(region.tiles.length);
  });

  it('is deterministic for a given seed', () => {
    const region = rowRegion('player', SPAWN_REGION_MAX_TILES);
    expect(spawnPositions('player', region, 99, TEAM_SIZE)).toEqual(
      spawnPositions('player', region, 99, TEAM_SIZE),
    );
  });

  it('varies the placement across seeds', () => {
    const region = rowRegion('player', SPAWN_REGION_MAX_TILES);
    const arrangements = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      arrangements.add(spawnPositions('player', region, seed, TEAM_SIZE).map(key).join('|'));
    }
    expect(arrangements.size).toBeGreaterThan(1);
  });

  it('randomizes the enemy team the same way', () => {
    const region = rowRegion('enemy', SPAWN_REGION_MAX_TILES);
    const tileKeys = new Set(region.tiles.map(key));
    const positions = spawnPositions('enemy', region, 13, TEAM_SIZE);

    expect(positions).toHaveLength(TEAM_SIZE);
    for (const p of positions) {
      expect(tileKeys.has(key(p))).toBe(true);
    }
    const arrangements = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      arrangements.add(spawnPositions('enemy', region, seed, TEAM_SIZE).map(key).join('|'));
    }
    expect(arrangements.size).toBeGreaterThan(1);
  });

  it('uses every tile exactly once when the team exactly fills the region', () => {
    const region = rowRegion('player', TEAM_SIZE);
    const positions = spawnPositions('player', region, 4, TEAM_SIZE);
    expect(new Set(positions.map(key))).toEqual(new Set(region.tiles.map(key)));
  });
});
