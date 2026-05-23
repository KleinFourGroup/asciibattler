/**
 * C1d follow-up: catch layout-driven pathfinding deadlocks before they
 * ship. Each registered layout (plus the procedural `null` path) drives
 * a headless battle from spawn through resolution. If a layout's
 * topology + the default spawn formation can starve `findPath` into
 * returning empty paths (the C1d Labyrinth softlock), the battle never
 * ends and the test trips the tick cap.
 *
 * Why this is its own test file (not just expanded layouts.test.ts):
 * the existing layout suite checks STATIC invariants (in-bounds, no
 * duplicate coords, spawn-row reservation, the simple BFS connectivity
 * mirror). Those all passed on Labyrinth even while the live battle
 * froze. Static connectivity isn't the same property as "an actual
 * battle from default spawn formations runs to completion" — units are
 * moving blockers, narrow corridors can mutual-block, and you only
 * notice when both sides try to traverse at once. So this is the
 * integration test for that dynamic property.
 *
 * Multiple seeds per layout. A single unlucky stat roll could mask the
 * bug; running across N seeds makes the failure deterministic and gives
 * us a tight reproduction case when one shows up.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { World } from '../../src/sim/World';
import { RNG } from '../../src/core/RNG';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import { GRID_SIZE } from '../../src/config';
import { LAYOUT_IDS } from '../../src/sim/layouts';
import type { GameEvents } from '../../src/core/events';
import type { BattleEncounter } from '../../src/run/Run';

// Each scenario runs across this many seeds. Bumping it widens the
// coverage net at the cost of test wall time; tick-cap is the dominant
// factor (most healthy battles end in 200-400 ticks, well under the cap).
const SEEDS_PER_LAYOUT = 3;

// Tick cap per battle. Healthy MVP battles end in ~200-400 ticks; the
// generous cap leaves room for very narrow layouts where units have to
// thread a maze before engaging.
const MAX_TICKS = 2000;

// Every registered layout plus the procedural path.
const SCENARIOS: ReadonlyArray<string | null> = [...LAYOUT_IDS, null];

describe('Layout deadlock regression (C1d follow-up)', () => {
  for (const layoutId of SCENARIOS) {
    const label = layoutId ?? 'procedural';
    it(`layout=${label} resolves across ${SEEDS_PER_LAYOUT} seeds`, () => {
      for (let i = 0; i < SEEDS_PER_LAYOUT; i++) {
        const seed = 100 + i;
        const { world, ticks } = runHeadlessBattle(seed, layoutId);
        expect(
          world.ended,
          `seed=${seed} layout=${label} did not resolve in ${MAX_TICKS} ticks (got ${ticks})`,
        ).toBe(true);
      }
    });
  }
});

function runHeadlessBattle(seed: number, layoutId: string | null): { world: World; ticks: number } {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(seed), GRID_SIZE);
  // Separate RNG for unit rolls so changing tick logic doesn't perturb
  // the team composition for the same seed.
  const teamRng = new RNG(seed * 31 + 7);
  const playerTeam = [
    rollUnit('melee', teamRng),
    rollUnit('melee', teamRng),
    rollUnit('melee', teamRng),
    rollUnit('ranged', teamRng),
    rollUnit('ranged', teamRng),
  ];
  const enemyTeam = [
    rollUnit('melee', teamRng),
    rollUnit('melee', teamRng),
    rollUnit('melee', teamRng),
    rollUnit('ranged', teamRng),
    rollUnit('ranged', teamRng),
  ];
  const encounter: BattleEncounter = {
    worldSeed: seed,
    terrainSeed: seed,
    layoutId,
    playerTeam,
    enemyTeam,
  };
  spawnEncounter(world, encounter);

  let ticks = 0;
  while (!world.ended && ticks < MAX_TICKS) {
    world.tick();
    ticks++;
  }
  return { world, ticks };
}
