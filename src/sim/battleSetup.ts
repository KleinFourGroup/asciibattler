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
import type { GridCoord } from '../core/types';
import type { World, CampInstance, CampPendingUnit } from './World';
import { getCamp } from '../config/camps';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { createMovementBehavior } from './behaviors/registry';
import { createAbility } from './abilities/registry';
import { abilityIdsForArchetype } from './archetypes';
import type { Team, UnitTemplate } from './Unit';
import type { BattleEncounter } from '../run/Run';
import { TERRAIN } from '../config/terrain';
import { generateTerrain, type GeneratedTerrain } from './terrainGen';
import { spawnHalfCover, spawnRubble, spawnWall } from './environment';
import type { SpawnRegion, CampRef } from './layouts';

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
 * Each spawned unit gets `MovementBehavior` + `AbilityBehavior`, plus
 * the archetype's configured abilities (E2: `melee → [melee_strike]`,
 * `ranged → [ranged_shot]`; future archetypes add more).
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
    const template = templates[i]!;
    // E4: pass through the template's rosterIndex (set by
    // `Run.handleEnterNode` for player templates; null/undefined for
    // enemy templates). Plumbs into `xpAwards` so Run can bank XP
    // into the right roster slot without a separate id map.
    const u = world.spawnUnit(template, team, tiles[i]!, template.rosterIndex ?? null);
    u.behaviors.push(createMovementBehavior(template.archetype), new AbilityBehavior());
    for (const id of abilityIdsForArchetype(template.archetype)) {
      u.abilities.push(createAbility(id));
    }
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
  const terrain = generateTerrain(
    new RNG(encounter.terrainSeed),
    world.gridW,
    world.gridH,
    TERRAIN,
    encounter.layoutId,
  );
  for (const cell of terrain.tileGrid.cells()) {
    world.tileGrid.setKind({ x: cell.x, y: cell.y }, cell.kind);
  }
  spawnLayoutNeutrals(world, terrain);
  // §75c — roll + register the layout's camps (a free no-op on the camp-free
  // common case; the presence gate rides inside spawnCamps + installCamps).
  spawnCamps(world, terrain.campSpawns, terrain.camps, encounter.terrainSeed);
  return terrain.spawnRegions;
}

/**
 * §75c — roll each camp-spawn tile's camp and register the instances + the
 * dedicated camp stream on the World. "Resolved on turn start" IS battle-setup
 * time (a fresh World per turn), and this rides `applyTerrain`, so all four
 * World construction sites (BattleScene / fuzz harness / replayTrace /
 * `spawnEncounter`) get camps with zero per-site changes.
 *
 * Stream derivation (the §75 kickoff worklog): a fresh parent off
 * `terrainSeed`, BURN the first fork — that stream is byte-identical to
 * `setupRngFor`'s (same construction) — and take the second as the camp
 * stream. Selection rolls consume it here; `installCamps` then hands the
 * advanced stream to the World for battle-time draws (drip placement, 75f
 * wander). Nothing touches `battleRng` or Run's fork ladder — the
 * fork-append-free property the §75 cut is built on.
 *
 * Args-explicit (the assert-function pattern) so tests drive synthetic
 * campSpawns/camps against a naked World — no shipped layout lists a camp
 * until the §75j design round, so until then this is exercised by unit tests
 * only (the 74e seam-only posture).
 */
export function spawnCamps(
  world: World,
  campSpawns: readonly GridCoord[],
  campRefs: readonly CampRef[],
  terrainSeed: number,
): void {
  if (campSpawns.length === 0) return;
  if (campRefs.length === 0) {
    // The layouts.ts schema rejects this pairing; a synthetic caller that
    // slips past it must fail loud, not roll from nothing.
    throw new Error('spawnCamps: campSpawns present but the camps list is empty');
  }
  const parent = new RNG(terrainSeed);
  parent.fork(); // burn — fork #1 duplicates setupRngFor's stream
  const campRng = parent.fork();

  const instances: CampInstance[] = campSpawns.map((tile, i) => {
    const ref = weightedCampRef(campRefs, campRng);
    const def = getCamp(ref.campId);
    if (def === undefined) {
      // Shipped layouts are boot-asserted (assertLayoutCampRefs); this guards
      // synthetic/test layouts the same loud way.
      throw new Error(`spawnCamps: unknown camp "${ref.campId}"`);
    }
    const pending: CampPendingUnit[] = [];
    for (const u of def.units) {
      const count = u.count ?? 1;
      for (let k = 0; k < count; k++) {
        pending.push({ archetype: u.archetype, level: u.level ?? 1 });
      }
    }
    return {
      id: i + 1,
      defId: def.id,
      anchor: { x: tile.x, y: tile.y },
      hostileTo: new Set<Team>(),
      pending,
      killedBy: null,
    };
  });
  world.installCamps(instances, campRng);
}

/**
 * §75c — the weighted camp pick (absent weight = 1, the sector-pool
 * convention). Local rather than imported from `run/sectorWalk` — sim never
 * runtime-imports run — but the SEMANTICS match `pickWeighted` exactly,
 * including the #111 zero-draw singleton (a one-camp list costs no draw).
 */
function weightedCampRef(refs: readonly CampRef[], rng: RNG): CampRef {
  if (refs.length === 1) return refs[0]!;
  let total = 0;
  for (const r of refs) total += r.weight ?? 1;
  let roll = rng.next() * total;
  for (const r of refs) {
    roll -= r.weight ?? 1;
    if (roll < 0) return r;
  }
  return refs[refs.length - 1]!;
}

/**
 * Spawn a `GeneratedTerrain`'s neutral obstacles (walls, half-cover, §40d rubble)
 * into `world`. Extracted from `applyTerrain` (§40d) so the layout→board wiring is
 * unit-testable off a `generateFromLayout` fixture without registering it in the
 * global `LAYOUTS` catalog.
 *
 * Spawn order — walls, then half-cover, then rubble — is stable so any future
 * "stack on the same cell" diagnostic sees a deterministic sequence (schema
 * validation forbids the overlap today, but a fixed order keeps failure modes
 * predictable). D6 fixed the wall→half-cover order for that reason.
 */
export function spawnLayoutNeutrals(
  world: World,
  terrain: Pick<GeneratedTerrain, 'walls' | 'halfCovers' | 'rubble'>,
): void {
  // A neutral coord may carry extra keys (§40c wall `hp`, §40d rubble `size`/`hp`);
  // pass a CLEAN `{x,y}` as the position so those knobs don't leak onto `unit.position`
  // (which flows into snapshots + every occupancy query).
  for (const coord of terrain.walls) {
    // §40c — a wall coord carrying an `hp` spawns DESTRUCTIBLE; a bare coord
    // (every shipped layout + all procedural) spawns the indestructible default.
    spawnWall(world, { x: coord.x, y: coord.y }, coord.hp);
  }
  for (const coord of terrain.halfCovers) {
    spawnHalfCover(world, { x: coord.x, y: coord.y }, coord.hp);
  }
  // §40d — rubble is the first multi-tile neutral: `size` picks the N×N footprint
  // def (default 1×1); `hp` overrides the catalog pool. Absent `size` narrows to 1.
  for (const coord of terrain.rubble) {
    const size = coord.size === 2 ? 2 : coord.size === 3 ? 3 : 1;
    spawnRubble(world, { x: coord.x, y: coord.y }, size, coord.hp);
  }
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
