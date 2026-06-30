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
 * AbilityBehavior → the gambit EffectAction → World events). The data-driven
 * effects/EffectAction.test.ts pins the strike + reposition firing in isolation;
 * this proves a rogue spawned through the real ability-wiring path
 * (`abilityIdsForArchetype('rogue')` → `createAbility('gambit_strike')`)
 * engages and the battle resolves without hanging or throwing — the thing a
 * playtest build needs to not crash on `?roster=rogue,...`.
 *
 * N1 — the rogue now also carries the `dash` (`createAbility('dash')`), so this
 * additionally proves the gap-closer fires end-to-end through the selector via
 * the first-class `unit:dashed` event (the move op emits it on the leap). The
 * propose-bridge gates (effects/propose.test.ts) + EffectAction firing pin the
 * dash in isolation; here we confirm AbilityBehavior actually PICKS the dash
 * (score 5) over a walk (1) when the rogue is out of strike range at the start.
 */

const TICK_CAP = 2000;

function runRogueBattle(seed: number): {
  resolved: boolean;
  rogueAttacked: boolean;
  rogueMoved: boolean;
  rogueDashed: boolean;
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
    theme: 'barren',
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
  const abilityIds = rogue!.abilities.map((a) => a.id);
  expect(abilityIds).toContain('gambit_strike');
  expect(abilityIds).toContain('dash');

  let rogueAttacked = false;
  let rogueMoved = false;
  let rogueDashed = false;
  bus.on('unit:attacked', (p) => {
    if (p.attackerId === rogueId) rogueAttacked = true;
  });
  bus.on('unit:moved', (p) => {
    if (p.unitId === rogueId) rogueMoved = true;
  });
  // N1 — the first-class dash signal: catches every leap, including a 1-cell
  // dash (closing on an enemy 2 cells away) that a move-distance check misses.
  bus.on('unit:dashed', (p) => {
    if (p.unitId === rogueId) rogueDashed = true;
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
  return { resolved, rogueAttacked, rogueMoved, rogueDashed };
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
    // N1 — the gap-closer fires end-to-end: out of strike range at the start,
    // the selector picks the dash (a >1-cell leap) over a walk on ≥1 seed.
    expect(results.some((r) => r.rogueDashed), 'rogue dashes on ≥1 seed').toBe(true);
  });
});
