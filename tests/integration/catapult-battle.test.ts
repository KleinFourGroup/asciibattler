import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/World';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import type { BattleEncounter } from '../../src/run/Run';

/**
 * E7.D — integration smoke for the catapult in a FULL tick loop (selector →
 * MovementBehavior / AbilityBehavior → the catapult-shot EffectAction wind-up →
 * applyEffect impact → World events). The unit-level tests pin the single-hit
 * mechanic + propose path in isolation; this proves a catapult spawned
 * through the real wiring (`abilityIdsForArchetype('catapult')` →
 * `createAbility('catapult_shot')`, plus the charging `MovementBehavior` in
 * the shared spawn path) closes to range, winds up, lands a shot on an enemy,
 * and the battle resolves without hanging or throwing — what a
 * `?roster=catapult,...` playtest build must not crash on.
 *
 * Like the mage it's a MULTI-TICK combat action, so this also guards that the
 * wind-up actually spans multiple ticks (activeAction held across ticks with
 * id 'catapult_shot') rather than collapsing to single-tick.
 */

const TICK_CAP = 2000;

function runCatapultBattle(seed: number): {
  resolved: boolean;
  charged: boolean;
  chargeSpannedTicks: boolean;
  shotHit: boolean;
} {
  const bus = new EventBus<GameEvents>();

  const encounter: BattleEncounter = {
    worldSeed: seed,
    terrainSeed: seed,
    layoutId: null,
    gridW: 12,
    gridH: 12,
    theme: 'barren',
    playerTeam: [
      rollUnit('catapult', new RNG(seed)),
      rollUnit('mercenary', new RNG(seed + 1)),
      rollUnit('mercenary', new RNG(seed + 2)),
    ],
    enemyTeam: [
      rollUnit('mercenary', new RNG(seed + 10)),
      rollUnit('mercenary', new RNG(seed + 11)),
    ],
  };

  const world = new World(bus, new RNG(seed));
  spawnEncounter(world, encounter);

  const cat = world.units.find((u) => u.team === 'player' && u.archetype === 'catapult');
  expect(cat, 'catapult should spawn into the world').toBeDefined();
  const catId = cat!.id;
  expect(cat!.abilities.map((a) => a.id)).toContain('catapult_shot');
  // Production spawn path wires the charging MovementBehavior (not the
  // healer's SupportMovementBehavior).
  expect(cat!.behaviors.map((b) => b.kind)).toEqual(['movement', 'ability']);

  // A shot impact is the catapult dealing damage to an enemy.
  let shotHit = false;
  bus.on('unit:attacked', (p) => {
    if (p.attackerId === catId) shotHit = true;
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
    const active = world.findUnit(catId)?.activeAction;
    if (active?.action.id === 'catapult_shot') {
      charged = true;
      // The same wind-up instance (same startTick) on >1 consecutive tick
      // proves the action is genuinely multi-tick, not single-tick.
      if (prevChargeStart === active.startTick) chargeSpannedTicks = true;
      prevChargeStart = active.startTick;
    } else {
      prevChargeStart = null;
    }
    if (resolved) break;
  }
  return { resolved, charged, chargeSpannedTicks, shotHit };
}

describe('E7.D — catapult runs through a full battle', () => {
  // 43a re-seed: seed 1's battle re-shaped under the straightness tie-break —
  // the catapult still winds up but its shot fizzles (target dies mid-flight)
  // before any impact lands. Seed 2 exercises the same full-loop contract.
  for (const seed of [2, 7, 42]) {
    it(`winds up + lands a shot and the battle resolves (seed ${seed})`, () => {
      const { resolved, charged, chargeSpannedTicks, shotHit } = runCatapultBattle(seed);
      expect(resolved).toBe(true);
      expect(charged).toBe(true);
      expect(chargeSpannedTicks).toBe(true);
      expect(shotHit).toBe(true);
    });
  }
});
