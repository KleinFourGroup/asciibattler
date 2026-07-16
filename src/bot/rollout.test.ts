/**
 * 57d — the clone seam's load-bearing contracts, foresee-the-rolls FIRST:
 *
 * 1. THE CLAIRVOYANCE GUARD — a rollout clone must NOT share the live
 *    battle's future rolls. The control case documents the hazard the
 *    seam exists for: a plain toJSON→fromJSON clone DOES share them
 *    (v34 serializes both streams by design — the A2 contract).
 * 2. LIVE-WORLD PURITY — cloning and ticking a clone never perturbs the
 *    live world (byte-identical snapshot before/after).
 * 3. DETERMINISM / CRN — same rolloutSeed ⇒ byte-identical rollout
 *    (the common-random-numbers contract rests on this); different
 *    seeds ⇒ diverged combat outcomes.
 * 4. BUS ISOLATION — rollout events never reach the live bus.
 */

import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { RNG } from '../core/RNG';
import { World } from '../sim/World';
import { rollUnit } from '../sim/archetypes';
import { MovementBehavior } from '../sim/behaviors/MovementBehavior';
import { AbilityBehavior } from '../sim/behaviors/AbilityBehavior';
import { createAbility } from '../sim/abilities/registry';
import { cloneForRollout } from './rollout';

/** A small live battle already in contact, so combat rolls flow fast. */
function liveBattle(seed: number): World {
  const world = new World(new EventBus<GameEvents>(), new RNG(seed));
  for (const x of [2, 4, 6]) {
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'player', { x, y: 4 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(createAbility('sword'));
  }
  for (const x of [2, 4, 6]) {
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'enemy', { x, y: 5 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(createAbility('sword'));
  }
  for (let i = 0; i < 30; i++) world.tick();
  return world;
}

describe('cloneForRollout (57d — the clairvoyance guard)', () => {
  it('foresee-the-rolls: the clone cannot see the live future; a plain clone CAN (the control)', () => {
    const live = liveBattle(4242);

    // The control documents the hazard: an undiverged round-trip clone
    // carries the live streams verbatim.
    const plain = World.fromJSON(
      JSON.parse(JSON.stringify(live.toJSON())),
      new EventBus<GameEvents>(),
    );
    expect(plain.rng.toJSON()).toEqual(live.rng.toJSON());
    expect(plain.combatRng.toJSON()).toEqual(live.combatRng.toJSON());

    // The seam diverges BOTH streams — from the live world AND from
    // each other.
    const clone = cloneForRollout(live, 777);
    expect(clone.rng.toJSON()).not.toEqual(live.rng.toJSON());
    expect(clone.combatRng.toJSON()).not.toEqual(live.combatRng.toJSON());
    expect(clone.rng.toJSON()).not.toEqual(clone.combatRng.toJSON());
  });

  it('cloning and ticking a clone never perturbs the live world', () => {
    const live = liveBattle(9001);
    const before = JSON.stringify(live.toJSON());

    const clone = cloneForRollout(live, 123);
    for (let i = 0; i < 50 && !clone.ended; i++) clone.tick();

    expect(JSON.stringify(live.toJSON())).toBe(before);
  });

  it('same rolloutSeed ⇒ byte-identical rollout (the CRN contract)', () => {
    const live = liveBattle(31337);
    const a = cloneForRollout(live, 555);
    const b = cloneForRollout(live, 555);
    for (let i = 0; i < 60 && !a.ended; i++) a.tick();
    for (let i = 0; i < 60 && !b.ended; i++) b.tick();
    expect(JSON.stringify(a.toJSON())).toBe(JSON.stringify(b.toJSON()));
  });

  it('different rolloutSeeds ⇒ diverged combat outcomes', () => {
    const live = liveBattle(31337);
    const a = cloneForRollout(live, 555);
    const b = cloneForRollout(live, 556);
    for (let i = 0; i < 60 && !a.ended; i++) a.tick();
    for (let i = 0; i < 60 && !b.ended; i++) b.tick();
    expect(JSON.stringify(a.toJSON())).not.toBe(JSON.stringify(b.toJSON()));
  });

  it('rollout events never reach the live bus', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(7));
    for (const x of [3, 5]) {
      const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'player', { x, y: 4 });
      u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
      u.abilities.push(createAbility('sword'));
    }
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'enemy', { x: 4, y: 5 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(createAbility('sword'));
    for (let i = 0; i < 10; i++) world.tick();

    let liveEvents = 0;
    bus.on('tick', () => liveEvents++);
    const clone = cloneForRollout(world, 42);
    for (let i = 0; i < 20 && !clone.ended; i++) clone.tick();
    expect(liveEvents).toBe(0);
  });
});
