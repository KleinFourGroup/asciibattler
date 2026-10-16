/**
 * Battle setup: takes a Run's `BattleEncounter`, applies its terrain, picks
 * the spawn regions and places both teams into a fresh `World`. BattleScene,
 * the replays and the fuzz harness all set up through here, so the game and
 * the harness can't drift apart.
 *
 * A layout declares its own spawn regions; the procedural generator emits
 * two `'both'` bands on the top and bottom edges. Setup picks one region
 * for the player and a distinct one for the enemy, then places each team
 * on shuffled tiles of its region.
 *
 * Every setup stream is derived from `terrainSeed` by key: `'terrain'`
 * (generation), `'spawnSetup'` (the region pick and each team's shuffle),
 * `'campSetup'` (which camps, per encounter), `'enemyPull'` (per turn, by
 * the world seed). Keyed, the streams are independent by construction:
 * changing the wall density can't shift a spawn pick.
 */

import { RNG, deriveRng } from '../core/RNG';
import type { GridCoord } from '../core/types';
import type { World, CampInstance, CampPendingUnit } from './World';
import { getCamp } from '../config/camps';
import { createMovementBehavior } from './behaviors/registry';
import type { Team, UnitTemplate } from './Unit';
import type { BattleEncounter } from '../run/Run';
import { TERRAIN } from '../config/terrain';
import { generateTerrain, type GeneratedTerrain } from './terrainGen';
import { spawnHalfCover, spawnRubble, spawnWall } from './environment';
import type { SpawnRegion, CampRef } from './layouts';
import { SIM } from '../config/sim';

interface PickedSpawnRegions {
  readonly player: SpawnRegion;
  readonly enemy: SpawnRegion;
}

/**
 * The player picks first, from the regions open to `player` or `both`; the
 * enemy then picks from those open to `enemy` or `both`, less the player's.
 * Throws if either pool is empty: the layout schema
 * (`src/config/layouts.ts`) rules that out, and the throw catches a board
 * that slips past it.
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
 * Places a team, each unit on one of the region's tiles shuffled by `rng`,
 * and wires it (`World.wireSpawned`: its catalog movement, then its
 * abilities). The templates beyond the region's tiles are queued, and
 * `World.runOverflowScan` seats them as tiles empty. The region is
 * registered as the team's (`setTeamSpawnRegion`) in its stored order, not
 * the shuffled copy, since that order is the scan's, so a rerun of the seed
 * scans the same way.
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
  rng.shuffle(tiles);
  const n = Math.min(templates.length, tiles.length);
  for (let i = 0; i < n; i++) {
    const template = templates[i]!;
    // The roster slot `Run.beginTurn` stamped on a player's template (none
    // on an enemy's), carried into `xpAwards`.
    const u = world.spawnUnit(template, team, tiles[i]!, template.rosterIndex ?? null);
    world.wireSpawned(u, createMovementBehavior(template.archetype), true);
  }
  for (let i = n; i < templates.length; i++) {
    world.queueUnit(team, templates[i]!);
  }
}

/**
 * Applies the encounter's terrain to a fresh World: generates the tiles,
 * the scenery and the spawn regions from its terrain seed, copies the tile
 * kinds onto `world.tileGrid` in place (the grid is held by reference, so
 * handles to it stay valid), spawns the scenery and the camps, and returns
 * the regions for the caller to place the teams. Runs before any
 * `spawnTeam`: `spawnEncounter` keeps that order, and BattleScene keeps it
 * by hand.
 */
export function applyTerrain(
  world: World,
  encounter: BattleEncounter,
): readonly SpawnRegion[] {
  // Its own key, so the terrain stream is not the root's.
  const terrain = generateTerrain(
    deriveRng(encounter.terrainSeed, 'terrain'),
    world.gridW,
    world.gridH,
    TERRAIN,
    encounter.layoutId,
    // The sector's theme picks a procedural board's tiles; a layout keeps
    // its own.
    encounter.theme,
  );
  for (const cell of terrain.tileGrid.cells()) {
    world.tileGrid.setKind({ x: cell.x, y: cell.y }, cell.kind);
  }
  spawnLayoutNeutrals(world, terrain);
  // The world seed, per turn, feeds only the pull's roll; which camps
  // stand stays on the per-encounter terrain seed (`spawnCamps`). A boss
  // board has no pull: the boss's wave defends the pool rather than detour
  // onto a camp. A fixture without `kind` counts as no boss.
  spawnCamps(
    world,
    terrain.campSpawns,
    terrain.camps,
    encounter.terrainSeed,
    encounter.worldSeed,
    encounter.kind !== 'boss',
  );
  return terrain.spawnRegions;
}

/**
 * Rolls each camp-spawn tile's camp, then installs the camps and their
 * stream on the World (`installCamps`). A World is fresh each turn and this
 * runs inside `applyTerrain`, so every setup path gets its camps.
 *
 * The camp stream is `deriveRng(terrainSeed, 'campSetup')`. The selection
 * rolls draw on it here, and `installCamps` hands the advanced stream to the
 * World for the battle's draws (the drip's placement, the wander). No run
 * stream is touched.
 *
 * Which camps stand is per encounter, by a signed call: the key carries no
 * turn index, and `terrainSeed` is per encounter, so the selection replays
 * the same on every turn of one encounter. A per-turn stream would be
 * `deriveRng(terrainSeed, 'campSetup', turn)`; build it only if that call is
 * reopened, not as a fix.
 *
 * Its inputs are arguments, so a test can drive made-up camp spawns and
 * camps against a bare World.
 */
export function spawnCamps(
  world: World,
  campSpawns: readonly GridCoord[],
  campRefs: readonly CampRef[],
  terrainSeed: number,
  worldSeed: number,
  // False on a boss board: no pull, though the camps spawn and aggro as
  // ever. A parameter, not the encounter, so a test can pass it.
  pullEligible = true,
): void {
  if (campSpawns.length === 0) return;
  if (campRefs.length === 0) {
    // The layouts.ts schema rejects this pairing; a synthetic caller that
    // slips past it must fail loud, not roll from nothing.
    throw new Error('spawnCamps: campSpawns present but the camps list is empty');
  }
  const campRng = deriveRng(terrainSeed, 'campSetup');

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

  // Each camp's first member is seated at once, so it is there during the
  // countdown (`primeCampSpawns`). Its placement draws on `campRng` right
  // after the selection rolls.
  world.primeCampSpawns();

  // The enemy's pull: at `SIM.enemyPullChance`, the enemy team's objective
  // is pointed at one camp's seated member (the camp picked uniformly; one
  // camp draws nothing, gotcha #111). It is an ordered engage on a passive
  // neutral, on the rails the player's click-to-engage uses (the ordered
  // first blow in `currentTarget`, the revert when the target dies). The
  // camp is not marked hostile: hostility has one source, damage
  // (`dealDamage`), so a pulled camp is passive until the enemy strikes it,
  // then the whole camp aggroes. The command drains at tick 1, and it is
  // serialized.
  //
  // The stream is `deriveRng(terrainSeed, 'enemyPull', worldSeed)`: the
  // world seed makes it per turn, as signed, while which camps stand stays
  // on the turn-free key. Derived inside the branch, so a battle with no
  // pull derives nothing, a boss board included.
  //
  // A camp whose first member could not be seated (its anchor was blocked
  // at setup) is not pulled: there is no unit to order against, and a tile
  // order on a passive camp would only loiter.
  if (pullEligible && SIM.enemyPullChance > 0) {
    const pullRng = deriveRng(terrainSeed, 'enemyPull', worldSeed);
    if (pullRng.next() < SIM.enemyPullChance) {
      const camp =
        instances.length === 1
          ? instances[0]!
          : instances[Math.floor(pullRng.next() * instances.length)]!;
      const mark = world.units.find((u) => u.campId === camp.id && u.currentHp > 0);
      if (mark !== undefined) {
        world.enqueueCommand({
          kind: 'setObjective',
          team: 'enemy',
          objective: { mode: 'engage', target: { kind: 'neutral', unitId: mark.id } },
        });
      }
    }
  }
}

/**
 * The weighted camp pick, an absent weight counting 1 as in a sector's
 * pool. Local, since sim never imports run at runtime, but it matches
 * `run/sectorWalk`'s `pickWeighted`, a one-camp list drawing nothing
 * included (gotcha #111).
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
 * Spawns a `GeneratedTerrain`'s scenery (walls, half-cover, rubble) into
 * `world`. Apart from `applyTerrain`, so a test can wire a layout to a board
 * from a `generateFromLayout` fixture without registering it in `LAYOUTS`.
 * Walls, then half-cover, then rubble, a fixed order, so two on one cell,
 * which the schema forbids, would fail the same way every time.
 */
export function spawnLayoutNeutrals(
  world: World,
  terrain: Pick<GeneratedTerrain, 'walls' | 'halfCovers' | 'rubble'>,
): void {
  // A coord may carry more keys (`hp`, a rubble's `size`); the position is a
  // clean `{x, y}`, so they don't reach `unit.position`, which every
  // snapshot and occupancy query reads.
  for (const coord of terrain.walls) {
    // A coord with `hp` spawns destructible; a bare one, the indestructible
    // default.
    spawnWall(world, { x: coord.x, y: coord.y }, coord.hp);
  }
  for (const coord of terrain.halfCovers) {
    spawnHalfCover(world, { x: coord.x, y: coord.y }, coord.hp);
  }
  // `size` picks the N×N footprint's def, 1 when absent; `hp` overrides the
  // catalog's.
  for (const coord of terrain.rubble) {
    const size = coord.size === 2 ? 2 : coord.size === 3 ? 3 : 1;
    spawnRubble(world, { x: coord.x, y: coord.y }, size, coord.hp);
  }
}

/**
 * Sets up a whole `BattleEncounter` in a fresh world, for the replays and
 * the fuzz harness; BattleScene makes the same calls itself, with the
 * board's render setup between them. The terrain goes first, so the spawn regions are
 * clear of scenery, and one `setupRng` drives the region pick and both
 * shuffles, in the order: pick both regions, shuffle the player's tiles,
 * shuffle the enemy's.
 */
export function spawnEncounter(world: World, encounter: BattleEncounter): void {
  const spawnRegions = applyTerrain(world, encounter);
  const setupRng = setupRngFor(encounter);
  const { player, enemy } = pickSpawnRegions(spawnRegions, setupRng);
  spawnTeam(world, 'player', encounter.playerTeam, player, setupRng);
  spawnTeam(world, 'enemy', encounter.enemyTeam, enemy, setupRng);
}

/**
 * The setup stream, exported so BattleScene, which places the teams
 * itself, draws what `spawnEncounter` draws. It is on the terrain seed; the
 * battle's rolls are on `world.combatRng`, `rng`'s fork on the world seed,
 * so a roll more or less never shifts a spawn pick.
 */
export function setupRngFor(encounter: BattleEncounter): RNG {
  return deriveRng(encounter.terrainSeed, 'spawnSetup');
}
