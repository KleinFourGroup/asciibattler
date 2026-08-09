/**
 * §75b — the World camp registry: install semantics (the presence gate that
 * carries the byte-identity exit gate), hostility reads/writes, and the
 * active-neutral predicate. Serialization round-trips live in
 * tests/integration/snapshot-roundtrip.test.ts (the A2 home).
 */

import { describe, it, expect } from 'vitest';
import { World, type CampInstance } from './World';
import { isActiveNeutral } from './Unit';
import { spawnCamps } from './battleSetup';
import { spawnWall } from './environment';
import { getCamp } from '../config/camps';
import { SPAWN } from '../config/spawn';
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

describe('§75c — spawnCamps (the setup-time roll)', () => {
  it('registers one instance per spawn tile: ids 1..n, anchors, count-expanded pending', () => {
    const world = freshWorld();
    spawnCamps(world, [{ x: 3, y: 3 }, { x: 8, y: 8 }], [{ campId: 'ghoul-nest' }], 42);
    expect(world.campRng).not.toBeNull();
    const camps = world.campsList();
    expect(camps.map((c) => c.id)).toEqual([1, 2]);
    expect(camps[0]!.anchor).toEqual({ x: 3, y: 3 });
    expect(camps[1]!.anchor).toEqual({ x: 8, y: 8 });
    // Pending derives from the catalog def (balance-proof: computed, not
    // hardcoded — count expands, absent level defaults to 1). §75h2 — the
    // HEAD of each expansion is PRIMED onto the grid at setup, so pending
    // holds the tail; the primed member stands on the anchor.
    const def = getCamp('ghoul-nest')!;
    const expected = def.units.flatMap((u) =>
      Array.from({ length: u.count ?? 1 }, () => ({
        archetype: u.archetype,
        level: u.level ?? 1,
      })),
    );
    expect(camps[0]!.pending).toEqual(expected.slice(1));
    const primed = world.units.filter((u) => u.campId === 1);
    expect(primed).toHaveLength(1);
    expect(primed[0]!.archetype).toBe(expected[0]!.archetype);
    expect(primed[0]!.position).toEqual({ x: 3, y: 3 });
    expect(camps[0]!.hostileTo.size).toBe(0);
    expect(camps[0]!.killedBy).toBeNull();
  });

  it('is deterministic per terrainSeed (the weighted roll included)', () => {
    const refs = [{ campId: 'bandit-squatters' }, { campId: 'ghoul-nest', weight: 3 }];
    const tiles = [{ x: 2, y: 2 }, { x: 9, y: 9 }, { x: 5, y: 9 }];
    const a = freshWorld();
    const b = freshWorld();
    spawnCamps(a, tiles, refs, 1234);
    spawnCamps(b, tiles, refs, 1234);
    expect(a.campsList().map((c) => c.defId)).toEqual(b.campsList().map((c) => c.defId));
  });

  it('empty campSpawns is a free no-op; spawns without a camps list throw loud', () => {
    const world = freshWorld();
    spawnCamps(world, [], [], 42);
    expect(world.campRng).toBeNull();
    expect(() => spawnCamps(freshWorld(), [{ x: 3, y: 3 }], [], 42)).toThrow(
      /camps list is empty/,
    );
    expect(() =>
      spawnCamps(freshWorld(), [{ x: 3, y: 3 }], [{ campId: 'no-such-camp' }], 42),
    ).toThrow(/unknown camp/);
  });
});

describe('§75c — the portal-drip drain', () => {
  const dripWorld = (): World => {
    const world = freshWorld();
    // bandit-squatters: 2×1×1 bandits — the pure single-tile drip case.
    spawnCamps(world, [{ x: 5, y: 5 }], [{ campId: 'bandit-squatters' }], 42);
    return world;
  };

  it('§75h2 — the FIRST member is PRIMED at setup: instant, no lockout, targetable pre-countdown', () => {
    const world = dripWorld();
    // Before any tick: the head-of-queue member already stands on the anchor
    // (like the initial teams — the user's 75h eyeball feedback).
    const spawned = world.units.filter((u) => u.campId !== null);
    expect(spawned.length).toBe(1);
    const u = spawned[0]!;
    expect(u.team).toBe('neutral');
    expect(u.campId).toBe(1);
    expect(u.position).toEqual({ x: 5, y: 5 });
    expect(isActiveNeutral(u)).toBe(true);
    // The spawnFromQueue mirror: real stats + behaviors — but NO spawn
    // lockout (instant, exactly like a setup-time team placement).
    expect(u.derived.maxHp).toBeGreaterThan(0);
    expect(u.behaviors.length).toBe(2);
    expect(u.abilities.length).toBeGreaterThan(0);
    expect(u.activeAction).toBeNull();
    expect(world.campById(1)!.pending.length).toBe(1);
  });

  it('the SECOND member still drips through the portal: lockout + fade, one per free-anchor tick', () => {
    const world = dripWorld();
    const first = world.units.find((u) => u.campId !== null)!;
    first.position = { x: 1, y: 1 }; // vacate the portal
    world.tick();
    const second = world.units.find((u) => u.campId !== null && u.id !== first.id)!;
    expect(second.position).toEqual({ x: 5, y: 5 });
    expect(second.activeAction?.action.id).toBe('spawn');
    expect(second.activeAction?.finishTick).toBe(world.currentTick + SPAWN.durationTicks);
    expect(world.campById(1)!.pending.length).toBe(0);
  });

  it('an occupied anchor waits; vacating it drips the next member', () => {
    const world = dripWorld();
    world.tick();
    const first = world.units.find((u) => u.campId !== null)!;
    // The anchor is occupied by the first member — the queue holds.
    world.tick();
    expect(world.units.filter((u) => u.campId !== null).length).toBe(1);
    expect(world.campById(1)!.pending.length).toBe(1);
    // Vacate (the wander's job from 75f; teleported here) → the drip resumes.
    first.position = { x: 1, y: 1 };
    world.tick();
    expect(world.units.filter((u) => u.campId !== null).length).toBe(2);
    expect(world.campById(1)!.pending.length).toBe(0);
    // Drained: further ticks spawn nothing more.
    world.units.find((u) => u.campId !== null)!.position = { x: 2, y: 2 };
    world.tick();
    expect(world.units.filter((u) => u.campId !== null).length).toBe(2);
  });

  it('a blocked anchor (wall) spawns nothing and keeps pending intact', () => {
    const world = freshWorld();
    spawnWall(world, { x: 5, y: 5 });
    spawnCamps(world, [{ x: 5, y: 5 }], [{ campId: 'bandit-squatters' }], 42);
    for (let i = 0; i < 5; i++) world.tick();
    expect(world.units.filter((u) => u.campId !== null).length).toBe(0);
    expect(world.campById(1)!.pending.length).toBe(2);
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
