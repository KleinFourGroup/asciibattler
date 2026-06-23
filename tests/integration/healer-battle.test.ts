import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/World';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import type { BattleEncounter } from '../../src/run/Run';

/**
 * E7.B — integration smoke for the healer in a FULL tick loop (selector →
 * SupportMovementBehavior / AbilityBehavior → HealAction → World events).
 * The unit-level tests pin the heal mechanic + propose + movement ladder in
 * isolation; this proves a healer spawned through the real wiring
 * (`abilityIdsForArchetype('healer')` → `createAbility('heal_ally')`, plus
 * the archetype-aware `SupportMovementBehavior` in `spawnUnit`) positions,
 * casts a heal on a wounded ally, and the battle resolves without hanging or
 * throwing — what a `?roster=healer,...` playtest build must not crash on.
 *
 * Heal attribution is via the healer's own `activeAction` (id 'heal_ally' — the
 * Phase-Y3 data-driven EffectAction; was 'heal' under the legacy HealAction),
 * which is tile-independent — a healing tile would also emit `unit:healed`, but
 * it can't put a heal action on the healer's action slot.
 */

const TICK_CAP = 2000;

function runHealerBattle(seed: number): { resolved: boolean; healerCast: boolean } {
  const bus = new EventBus<GameEvents>();

  // Favorable matchup: the healer + a melee line that takes chip damage it
  // can mend, against a smaller enemy force, so the healer survives to cast.
  const encounter: BattleEncounter = {
    worldSeed: seed,
    terrainSeed: seed,
    layoutId: null,
    gridW: 12,
    gridH: 12,
    theme: 'rock',
    playerTeam: [
      rollUnit('healer', new RNG(seed)),
      rollUnit('mercenary', new RNG(seed + 1)),
      rollUnit('mercenary', new RNG(seed + 2)),
      rollUnit('mercenary', new RNG(seed + 3)),
    ],
    enemyTeam: [
      rollUnit('mercenary', new RNG(seed + 10)),
      rollUnit('mercenary', new RNG(seed + 11)),
    ],
  };

  const world = new World(bus, new RNG(seed));
  spawnEncounter(world, encounter);

  const healer = world.units.find((u) => u.team === 'player' && u.archetype === 'healer');
  expect(healer, 'healer should spawn into the world').toBeDefined();
  const healerId = healer!.id;
  expect(healer!.abilities.map((a) => a.id)).toContain('heal_ally');
  // Production spawn path (spawnEncounter → spawnFromQueue) wires the
  // archetype-aware movement: a healer gets SupportMovementBehavior, not the
  // enemy-charging MovementBehavior.
  expect(healer!.behaviors.map((b) => b.kind)).toEqual(['support_movement', 'ability']);

  let resolved = false;
  bus.on('battle:ended', () => {
    resolved = true;
  });

  let healerCast = false;
  let ticks = 0;
  while (ticks < TICK_CAP) {
    world.tick();
    ticks++;
    if (world.findUnit(healerId)?.activeAction?.action.id === 'heal_ally') healerCast = true;
    if (resolved) break;
  }
  return { resolved, healerCast };
}

describe('E7.B — healer runs through a full battle', () => {
  const SEEDS = [1, 7, 42];
  it('resolves every seed; the healer casts a heal on at least one', () => {
    const results = SEEDS.map(runHealerBattle);
    // Core smoke: no hang / throw — every seed reaches battle:ended.
    SEEDS.forEach((seed, i) => {
      expect(results[i]!.resolved, `seed ${seed} resolves (no hang)`).toBe(true);
    });
    // The heal WIRING fires (position → wounded ally → HealAction). Which seed
    // triggers a heal shifts with combat tuning (I6's weapon `might` changes how
    // much chip the line takes before someone mends it), so assert "at least one
    // seed" rather than pinning every seed — the wiring is what this smoke proves.
    expect(results.some((r) => r.healerCast), 'healer casts on ≥1 seed').toBe(true);
  });
});
