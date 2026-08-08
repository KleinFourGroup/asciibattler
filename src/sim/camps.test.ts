/**
 * §75b — the World camp registry: install semantics (the presence gate that
 * carries the byte-identity exit gate), hostility reads/writes, and the
 * active-neutral predicate. Serialization round-trips live in
 * tests/integration/snapshot-roundtrip.test.ts (the A2 home).
 */

import { describe, it, expect } from 'vitest';
import { World, type CampInstance } from './World';
import { isActiveNeutral } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';

const freshWorld = (): World => new World(new EventBus<GameEvents>(), new RNG(1));

const instance = (id: number, patch: Partial<CampInstance> = {}): CampInstance => ({
  id,
  defId: 'bandit-squatters',
  anchor: { x: 4, y: 4 },
  hostileTo: new Set(),
  pending: [{ archetype: 'bandit', level: 1 }],
  killedBy: null,
  ...patch,
});

describe('§75b — installCamps (the presence gate)', () => {
  it('an empty install is a free no-op: nothing stored, campRng stays null', () => {
    const world = freshWorld();
    world.installCamps([], new RNG(99));
    expect(world.campRng).toBeNull();
    expect(world.campsList()).toEqual([]);
    const wire = world.toJSON();
    expect(wire.camps).toEqual([]);
    expect(wire.campRng).toBeNull();
  });

  it('a naked World never creates a campRng (no unconditional fork — the stream guard)', () => {
    // The load-bearing half of the presence gate: constructing a World must
    // not advance `rng` for a camp stream. Two same-seeded worlds, one of
    // which never hears about camps, keep identical primary streams.
    const a = new World(new EventBus<GameEvents>(), new RNG(7));
    const b = new World(new EventBus<GameEvents>(), new RNG(7));
    b.installCamps([], new RNG(99));
    expect(a.rng.toJSON()).toEqual(b.rng.toJSON());
    expect(a.combatRng.toJSON()).toEqual(b.combatRng.toJSON());
  });

  it('stores instances + the stream; campById/campsList resolve in id order', () => {
    const world = freshWorld();
    world.installCamps([instance(2), instance(1, { defId: 'ghoul-nest' })], new RNG(5));
    expect(world.campRng).not.toBeNull();
    expect(world.campById(1)?.defId).toBe('ghoul-nest');
    expect(world.campById(2)?.defId).toBe('bandit-squatters');
    expect(world.campById(3)).toBeUndefined();
    expect(world.campsList().map((c) => c.id)).toEqual([1, 2]);
  });

  it('a second install throws; duplicate instance ids throw', () => {
    const world = freshWorld();
    world.installCamps([instance(1)], new RNG(5));
    expect(() => world.installCamps([instance(2)], new RNG(6))).toThrow(/already installed/);
    const fresh = freshWorld();
    expect(() => fresh.installCamps([instance(1), instance(1)], new RNG(5))).toThrow(
      /duplicate camp instance/,
    );
  });
});

describe('§75b — hostility reads/writes', () => {
  it('markCampHostile is camp-wide, per-faction, idempotent; reads degrade false', () => {
    const world = freshWorld();
    world.installCamps([instance(1)], new RNG(5));
    expect(world.campHostileTo(1, 'player')).toBe(false);
    world.markCampHostile(1, 'player');
    world.markCampHostile(1, 'player'); // idempotent by Set semantics
    expect(world.campHostileTo(1, 'player')).toBe(true);
    expect(world.campHostileTo(1, 'enemy')).toBe(false);
    // Unknown ids: reads degrade to passive, writes throw (a wiring bug).
    expect(world.campHostileTo(9, 'player')).toBe(false);
    expect(() => world.markCampHostile(9, 'player')).toThrow(/unknown camp instance/);
  });
});

describe('§75b — isActiveNeutral (THE widening predicate)', () => {
  it('true only for a neutral WITH a campId', () => {
    expect(isActiveNeutral({ team: 'neutral', campId: 1 })).toBe(true);
    expect(isActiveNeutral({ team: 'neutral', campId: null })).toBe(false);
    expect(isActiveNeutral({ team: 'player', campId: null })).toBe(false);
    expect(isActiveNeutral({ team: 'enemy', campId: null })).toBe(false);
  });
});
