/**
 * D3: variable map sizes. Sanity check that a headless procedural battle
 * resolves at each of the size endpoints + a midpoint. The roadmap
 * settled on a uniform `[10, 20]` procedural roll; this exercises the
 * boundaries directly to catch any off-by-one or row-reservation bug
 * that only surfaces on non-12 grids.
 *
 * The test does NOT go through Run (Run owns the roll); it constructs
 * the encounter manually so each size is hit deterministically rather
 * than relying on a seed search.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { World } from '../../src/sim/World';
import { RNG } from '../../src/core/RNG';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import type { GameEvents } from '../../src/core/events';
import type { BattleEncounter } from '../../src/run/Run';

const SIZES = [10, 15, 20] as const;
const SEEDS_PER_SIZE = 2;
const MAX_TICKS = 3000;

describe('D3 variable-size battles', () => {
  for (const size of SIZES) {
    it(`procedural ${size}x${size} resolves across ${SEEDS_PER_SIZE} seeds`, () => {
      for (let i = 0; i < SEEDS_PER_SIZE; i++) {
        const seed = 200 + size * 10 + i;
        const { world, ticks } = runBattle(seed, size);
        expect(
          world.ended,
          `${size}x${size} seed=${seed} did not resolve in ${MAX_TICKS} ticks (got ${ticks})`,
        ).toBe(true);
      }
    });
  }
});

function runBattle(seed: number, side: number): { world: World; ticks: number } {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(seed), side, side);
  const teamRng = new RNG(seed * 31 + 7);
  const playerTeam = [
    rollUnit('mercenary', teamRng),
    rollUnit('mercenary', teamRng),
    rollUnit('mercenary', teamRng),
    rollUnit('ranged', teamRng),
    rollUnit('ranged', teamRng),
  ];
  const enemyTeam = [
    rollUnit('mercenary', teamRng),
    rollUnit('mercenary', teamRng),
    rollUnit('mercenary', teamRng),
    rollUnit('ranged', teamRng),
    rollUnit('ranged', teamRng),
  ];
  const encounter: BattleEncounter = {
    worldSeed: seed,
    terrainSeed: seed,
    layoutId: null,
    gridW: side,
    gridH: side,
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
