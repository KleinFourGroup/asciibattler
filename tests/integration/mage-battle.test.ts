import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/World';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import type { BattleEncounter } from '../../src/run/Run';

/**
 * E7.C — integration smoke for the mage in a FULL tick loop (selector →
 * MovementBehavior / AbilityBehavior → MagicBoltAction charge → applyEffect
 * detonation → World events). The unit-level tests pin the blast mechanic +
 * propose path in isolation; this proves a mage spawned through the real
 * wiring (`abilityIdsForArchetype('mage')` → `createAbility('magic_bolt')`,
 * plus the charging `MovementBehavior` in the shared spawn path) approaches,
 * charges, detonates a bolt that damages an enemy, and the battle resolves
 * without hanging or throwing — what a `?roster=mage,...` playtest build
 * must not crash on.
 *
 * The mage is the first MULTI-TICK combat action in the game, so this also
 * guards that the charge actually spans multiple ticks (activeAction held
 * across ticks with id 'magic_bolt') rather than collapsing to single-tick.
 */

const TICK_CAP = 2000;

function runMageBattle(seed: number): {
  resolved: boolean;
  mageCharged: boolean;
  chargeSpannedTicks: boolean;
  boltHit: boolean;
} {
  const bus = new EventBus<GameEvents>();

  const encounter: BattleEncounter = {
    worldSeed: seed,
    terrainSeed: seed,
    layoutId: null,
    gridW: 12,
    gridH: 12,
    theme: 'rock',
    playerTeam: [
      rollUnit('mage', new RNG(seed)),
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

  const mage = world.units.find((u) => u.team === 'player' && u.archetype === 'mage');
  expect(mage, 'mage should spawn into the world').toBeDefined();
  const mageId = mage!.id;
  expect(mage!.abilities.map((a) => a.id)).toContain('magic_bolt');
  // Production spawn path wires the charging MovementBehavior (not the
  // healer's SupportMovementBehavior).
  expect(mage!.behaviors.map((b) => b.kind)).toEqual(['movement', 'ability']);

  // A bolt impact is the mage dealing damage to an enemy (unit:attacked with
  // the mage as attacker, against a non-player target).
  let boltHit = false;
  bus.on('unit:attacked', (p) => {
    if (p.attackerId === mageId) boltHit = true;
  });

  let resolved = false;
  bus.on('battle:ended', () => {
    resolved = true;
  });

  let mageCharged = false;
  let chargeSpannedTicks = false;
  let prevChargeStart: number | null = null;
  let ticks = 0;
  while (ticks < TICK_CAP) {
    world.tick();
    ticks++;
    const active = world.findUnit(mageId)?.activeAction;
    if (active?.action.id === 'magic_bolt') {
      mageCharged = true;
      // The same charge instance (same startTick) seen on >1 consecutive
      // tick proves the action is genuinely multi-tick, not single-tick.
      if (prevChargeStart === active.startTick) chargeSpannedTicks = true;
      prevChargeStart = active.startTick;
    } else {
      prevChargeStart = null;
    }
    if (resolved) break;
  }
  return { resolved, mageCharged, chargeSpannedTicks, boltHit };
}

describe('E7.C — mage runs through a full battle', () => {
  for (const seed of [1, 7, 42]) {
    it(`charges + detonates a bolt and the battle resolves (seed ${seed})`, () => {
      const { resolved, mageCharged, chargeSpannedTicks, boltHit } = runMageBattle(seed);
      expect(resolved).toBe(true);
      expect(mageCharged).toBe(true);
      expect(chargeSpannedTicks).toBe(true);
      expect(boltHit).toBe(true);
    });
  }
});
