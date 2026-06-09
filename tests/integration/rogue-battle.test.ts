import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/World';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import type { BattleEncounter } from '../../src/run/Run';

/**
 * E7.A — integration smoke for the rogue in a FULL tick loop (selector →
 * AbilityBehavior → GambitStrikeAction → World events). The unit-level
 * GambitStrikeAction.test.ts pins the strike + reposition mechanic in
 * isolation; this proves a rogue spawned through the real ability-wiring
 * path (`abilityIdsForArchetype('rogue')` → `createAbility('gambit_strike')`)
 * engages and the battle resolves without hanging or throwing — the thing a
 * playtest build needs to not crash on `?roster=rogue,...`.
 */

const TICK_CAP = 2000;

function runRogueBattle(seed: number): {
  resolved: boolean;
  rogueAttacked: boolean;
  rogueMoved: boolean;
} {
  const bus = new EventBus<GameEvents>();

  // Favorable matchup so the fragile rogue reliably lands a strike before
  // it can be focused down: 3 player units (incl. the rogue) vs 1 enemy.
  const encounter: BattleEncounter = {
    worldSeed: seed,
    terrainSeed: seed,
    layoutId: null,
    gridW: 12,
    gridH: 12,
    theme: 'rock',
    playerTeam: [
      rollUnit('rogue', new RNG(seed)),
      rollUnit('mercenary', new RNG(seed + 1)),
      rollUnit('mercenary', new RNG(seed + 2)),
    ],
    enemyTeam: [rollUnit('ranged', new RNG(seed + 10))],
  };

  const world = new World(bus, new RNG(seed));
  spawnEncounter(world, encounter);

  const rogue = world.units.find((u) => u.team === 'player' && u.archetype === 'rogue');
  expect(rogue, 'rogue should spawn into the world').toBeDefined();
  const rogueId = rogue!.id;
  expect(rogue!.abilities.map((a) => a.id)).toContain('gambit_strike');

  let rogueAttacked = false;
  let rogueMoved = false;
  bus.on('unit:attacked', (p) => {
    if (p.attackerId === rogueId) rogueAttacked = true;
  });
  bus.on('unit:moved', (p) => {
    if (p.unitId === rogueId) rogueMoved = true;
  });

  let resolved = false;
  bus.on('battle:ended', () => {
    resolved = true;
  });

  let ticks = 0;
  while (ticks < TICK_CAP) {
    world.tick();
    ticks++;
    if (resolved) break;
  }
  return { resolved, rogueAttacked, rogueMoved };
}

describe('E7.A — rogue runs through a full battle', () => {
  const SEEDS = [1, 7, 42];
  it('resolves every seed; the rogue moves + lands a gambit on at least one', () => {
    const results = SEEDS.map(runRogueBattle);
    // Core smoke: no hang / throw — every seed reaches battle:ended.
    SEEDS.forEach((seed, i) => {
      expect(results[i]!.resolved, `seed ${seed} resolves (no hang)`).toBe(true);
    });
    // The gambit-strike + movement WIRING fires through the real path. Which
    // seed the fragile range-1 rogue actually reaches the enemy on shifts with
    // combat tuning (I6's weapon `might` lets the carries finish faster), so we
    // assert "at least one seed" rather than pinning every seed — the wiring is
    // what this smoke proves, not a specific seed's trajectory.
    expect(
      results.some((r) => r.rogueAttacked),
      'rogue lands a gambit on ≥1 seed',
    ).toBe(true);
    expect(results.some((r) => r.rogueMoved), 'rogue moves on ≥1 seed').toBe(true);
  });
});
