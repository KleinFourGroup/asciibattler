import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/World';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import type { BattleEncounter } from '../../src/run/Run';

/**
 * §29c — integration smoke for the stormcaller's CHAIN in a FULL tick loop
 * (selector → MovementBehavior / AbilityBehavior → the chain_lightning charge →
 * applyEffect → the interpreter's `executeChain` → World events). The unit-level
 * tests pin the chain geometry / falloff / propose-capture in isolation; this
 * proves a stormcaller spawned through the REAL wiring
 * (`abilityIdsForArchetype('stormcaller')` → `createAbility('chain_lightning')`)
 * approaches, charges, and detonates a chain that ARCS — i.e. damages MORE THAN
 * ONE enemy from a single cast (the hops fire in one tick at the impact boundary),
 * and the battle resolves without hanging or throwing. A `?roster=stormcaller,...`
 * playtest build must not crash on it.
 */

const TICK_CAP = 3000;

function runStormcallerBattle(seed: number): {
  resolved: boolean;
  charged: boolean;
  chargeSpannedTicks: boolean;
  maxVictimsInOneCast: number;
} {
  const bus = new EventBus<GameEvents>();

  const encounter: BattleEncounter = {
    worldSeed: seed,
    terrainSeed: seed,
    layoutId: null,
    gridW: 14,
    gridH: 14,
    theme: 'rock',
    // Melee bodyguards keep the stormcaller alive long enough to cast; a dense
    // enemy melee blob gives the chain adjacent targets to arc between.
    playerTeam: [
      rollUnit('stormcaller', new RNG(seed)),
      rollUnit('mercenary', new RNG(seed + 1)),
      rollUnit('mercenary', new RNG(seed + 2)),
      rollUnit('mercenary', new RNG(seed + 3)),
    ],
    enemyTeam: [
      rollUnit('mercenary', new RNG(seed + 10)),
      rollUnit('mercenary', new RNG(seed + 11)),
      rollUnit('mercenary', new RNG(seed + 12)),
      rollUnit('mercenary', new RNG(seed + 13)),
      rollUnit('mercenary', new RNG(seed + 14)),
    ],
  };

  const world = new World(bus, new RNG(seed));
  spawnEncounter(world, encounter);

  const caster = world.units.find((u) => u.team === 'player' && u.archetype === 'stormcaller');
  expect(caster, 'stormcaller should spawn into the world').toBeDefined();
  const casterId = caster!.id;
  expect(caster!.abilities.map((a) => a.id)).toContain('chain_lightning');
  expect(caster!.behaviors.map((b) => b.kind)).toEqual(['movement', 'ability']);

  // Bucket the stormcaller's hits by the tick they fired on: a chain's hops all
  // land in ONE tick (the impact boundary), so the max distinct victims seen in a
  // single tick is the longest arc the caster pulled off across the battle.
  let maxVictimsInOneCast = 0;
  let bucketTick = -1;
  let victimsThisTick = new Set<number>();
  bus.on('unit:attacked', (p) => {
    if (p.attackerId !== casterId) return;
    if (world.currentTick !== bucketTick) {
      bucketTick = world.currentTick;
      victimsThisTick = new Set<number>();
    }
    victimsThisTick.add(p.targetId);
    maxVictimsInOneCast = Math.max(maxVictimsInOneCast, victimsThisTick.size);
  });

  let resolved = false;
  bus.on('battle:ended', () => {
    resolved = true;
  });

  let charged = false;
  let chargeSpannedTicks = false;
  let prevChargeStart: number | null = null;
  let ticks = 0;
  while (ticks < TICK_CAP) {
    world.tick();
    ticks++;
    const active = world.findUnit(casterId)?.activeAction;
    if (active?.action.id === 'chain_lightning') {
      charged = true;
      if (prevChargeStart === active.startTick) chargeSpannedTicks = true;
      prevChargeStart = active.startTick;
    } else {
      prevChargeStart = null;
    }
    if (resolved) break;
  }
  return { resolved, charged, chargeSpannedTicks, maxVictimsInOneCast };
}

describe('§29c — stormcaller runs a full battle and its chain arcs', () => {
  const seeds = [1, 7, 42];
  const results = seeds.map((s) => ({ seed: s, ...runStormcallerBattle(s) }));

  for (const r of results) {
    it(`charges a chain and the battle resolves (seed ${r.seed})`, () => {
      expect(r.resolved).toBe(true);
      expect(r.charged).toBe(true);
      expect(r.chargeSpannedTicks).toBe(true); // the charge genuinely spans ticks
    });
  }

  it('the chain demonstrably ARCS — a single cast hits more than one enemy', () => {
    // Across the sampled battles, at least one cast landed on ≥2 distinct enemies
    // in one tick (the multi-hop chain). A non-chaining single-target attacker
    // could never put two victims in the same tick bucket.
    const best = Math.max(...results.map((r) => r.maxVictimsInOneCast));
    expect(best).toBeGreaterThanOrEqual(2);
  });
});
