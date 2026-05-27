/**
 * Shared battle-setup logic. Game.ts (via `BattleScene.mount`) and the
 * headless fuzz harness both need to take a Run's `BattleEncounter`,
 * apply terrain, pick spawn regions, and place both teams into a fresh
 * `World`. Putting it here keeps the two code paths from drifting — if
 * spawn placement ever changes, both the live game and the fuzz harness
 * pick it up.
 *
 * **D5** retired the row-based / fixed-column formation in favor of
 * explicit per-encounter `SpawnRegion`s. Hand-authored layouts declare
 * their own spawns; the procedural generator emits two `'both'`-
 * availability bands on the top + bottom edges. Battle setup picks one
 * region for the player and a distinct one for the enemy, then places
 * each team into shuffled tiles within their region.
 *
 * RNG: the spawn picker + per-region shuffle both consume the same
 * `RNG`, derived as `new RNG(encounter.terrainSeed).fork()`. Using
 * `fork()` gives a child stream independent of terrain-gen's RNG
 * advancement — so changing wall density doesn't shift spawn picks for
 * the same encounter seed. The fresh-parent-then-fork pattern keeps the
 * picks deterministic without bumping `Run.handleEnterNode`'s byte
 * stream.
 */

import { RNG } from '../core/RNG';
import type { World } from './World';
import { MovementBehavior } from './behaviors/MovementBehavior';
import { AttackBehavior } from './behaviors/AttackBehavior';
import type { Team, UnitTemplate } from './Unit';
import type { BattleEncounter } from '../run/Run';
import { TERRAIN } from '../config/terrain';
import { generateTerrain } from './terrainGen';
import { spawnHalfCover, spawnWall } from './environment';
import type { SpawnRegion } from './layouts';

export interface PickedSpawnRegions {
  readonly player: SpawnRegion;
  readonly enemy: SpawnRegion;
}

/**
 * Sequential draw: player picks first from `{ availability: player |
 * both }`, then enemy picks from `{ availability: enemy | both } \
 * { player's region }`. Throws if either pool ends up empty — zod
 * validation upstream (see `src/config/layouts.ts`) is supposed to
 * make this impossible, but the runtime guard catches procedural
 * configurations or future hand-authored ones that slip through.
 */
export function pickSpawnRegions(
  spawnRegions: readonly SpawnRegion[],
  rng: RNG,
): PickedSpawnRegions {
  const playerPool = spawnRegions.filter(
    (r) => r.availability === 'player' || r.availability === 'both',
  );
  if (playerPool.length === 0) {
    throw new Error('pickSpawnRegions: no player-available regions');
  }
  const player = rng.pick(playerPool);
  const enemyPool = spawnRegions.filter(
    (r) => (r.availability === 'enemy' || r.availability === 'both') && r !== player,
  );
  if (enemyPool.length === 0) {
    throw new Error(
      'pickSpawnRegions: no enemy-available region distinct from the player region',
    );
  }
  const enemy = rng.pick(enemyPool);
  return { player, enemy };
}

/**
 * Spawn a pre-rolled team into the active world, placing each unit on
 * one of the region's tiles (shuffled deterministically via `rng`).
 * Each spawned unit gets `MovementBehavior` + `AttackBehavior` — the
 * MVP behavior pair.
 *
 * **D5.C** — templates beyond `region.tiles.length` are pushed onto
 * `world.spawnQueues[team]`; `World.runOverflowScan` drains them as
 * tiles vacate during the battle. Also registers `region` as the
 * team's authoritative spawn region via `world.setTeamSpawnRegion` so
 * the scan knows where to look. The same registration carries the
 * tile ORDER, which is the deterministic scan order — using the
 * un-shuffled `region.tiles` here (the shuffled copy is only for the
 * initial placement) keeps overflow scans stable across reruns of the
 * same seed.
 */
export function spawnTeam(
  world: World,
  team: Team,
  templates: readonly UnitTemplate[],
  region: SpawnRegion,
  rng: RNG,
): void {
  world.setTeamSpawnRegion(team, region);
  const tiles = region.tiles.slice();
  shuffleTilesInPlace(tiles, rng);
  const n = Math.min(templates.length, tiles.length);
  for (let i = 0; i < n; i++) {
    const u = world.spawnUnit(templates[i]!, team, tiles[i]!);
    u.behaviors.push(new MovementBehavior(), new AttackBehavior());
  }
  for (let i = n; i < templates.length; i++) {
    world.queueUnit(team, templates[i]!);
  }
}

function shuffleTilesInPlace<T>(arr: T[], rng: RNG): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/**
 * Apply per-encounter terrain to a fresh World. Generates the tile
 * layout + wall coords + spawn regions from the encounter's terrain
 * seed, copies tile kinds onto `world.tileGrid` in place (the World's
 * grid is kept-by-reference so existing handles stay valid), spawns
 * each wall as a neutral-team Unit, and returns the regions so the
 * caller can pick + spawn teams. The two callers (`BattleScene.mount`
 * + `spawnEncounter`) consume the returned regions immediately.
 *
 * Must run BEFORE any `spawnTeam`. spawnEncounter does this internally;
 * BattleScene mirrors the order explicitly.
 */
export function applyTerrain(
  world: World,
  encounter: BattleEncounter,
): readonly SpawnRegion[] {
  const { tileGrid, walls, halfCovers, spawnRegions } = generateTerrain(
    new RNG(encounter.terrainSeed),
    world.gridW,
    world.gridH,
    TERRAIN,
    encounter.layoutId,
  );
  for (const cell of tileGrid.cells()) {
    world.tileGrid.setKind({ x: cell.x, y: cell.y }, cell.kind);
  }
  for (const coord of walls) {
    spawnWall(world, coord);
  }
  // D6: half-cover spawns after walls so any future "stack on same
  // cell" diagnostic sees walls first (today schema validation
  // prevents the overlap, but keeping the order stable means future
  // failure modes are predictable).
  for (const coord of halfCovers) {
    spawnHalfCover(world, coord);
  }
  return spawnRegions;
}

/**
 * Spawn both sides of a `BattleEncounter` into a fresh world.
 * Convenience wrapper for the fuzz harness; Game spawns player and
 * enemy in two separate calls because it interleaves HUD setup
 * between them. Terrain is applied first so spawn rows are guaranteed
 * clear of obstacles, and a single `setupRng` drives both the region
 * pick and each team's intra-region shuffle so the deterministic
 * order is "pick player → shuffle player tiles → pick enemy →
 * shuffle enemy tiles".
 */
export function spawnEncounter(world: World, encounter: BattleEncounter): void {
  const spawnRegions = applyTerrain(world, encounter);
  const setupRng = setupRngFor(encounter);
  const { player, enemy } = pickSpawnRegions(spawnRegions, setupRng);
  spawnTeam(world, 'player', encounter.playerTeam, player, setupRng);
  spawnTeam(world, 'enemy', encounter.enemyTeam, enemy, setupRng);
}

/**
 * Helper used by `BattleScene` to derive the same fork the headless
 * `spawnEncounter` uses, so both paths agree on the per-battle
 * shuffles. Exported so the centroid-based scroll-camera anchor (D5.E)
 * can also peek at the picked regions via the same fork.
 *
 * E1 note: AttackAction's crit roll consumes `world.combatRng`, which
 * is forked from World's main `rng` (seeded by `encounter.worldSeed`)
 * inside the World constructor. That makes the crit stream independent
 * of `setupRngFor`'s `encounter.terrainSeed` line — adding or removing
 * an attack doesn't shift spawn picks for the same encounter.
 */
export function setupRngFor(encounter: BattleEncounter): RNG {
  return new RNG(encounter.terrainSeed).fork();
}
