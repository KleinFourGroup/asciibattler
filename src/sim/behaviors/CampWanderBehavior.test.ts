/**
 * §75f — CampWanderBehavior: the spawn-path slot-0 swap, the 'camp' registry
 * arm, and THE TWO PHASE EXIT INVARIANTS as standing tests:
 *
 *   1. LEASH BOUND — a passive camp member never idles outside its def's
 *      `leashRadius` of the camp anchor (config-derived, never hardcoded).
 *   2. SPAWN VACATED ≤N — a dripped member steps off the anchor fast enough
 *      that the whole pending queue materializes within a bound derived from
 *      the spawn lockout + move cadence (the 75c "drip cadence IS the tile
 *      vacating" fact).
 *
 * Plus the RNG discipline pins: wander rides `campRng` exclusively (the
 * primary + combat streams stay untouched — the presence-gate half the fuzz
 * suite can't see), same-seed worlds wander identically, and the hostile
 * delegate releases the leash (it bounds idling, not retaliation).
 */

import { describe, it, expect } from 'vitest';
import { World } from '../World';
import type { Unit, UnitStats, Team } from '../Unit';
import type { GridCoord } from '../../core/types';
import { spawnCamps } from '../battleSetup';
import { createBehavior } from './registry';
import { CampWanderBehavior } from './CampWanderBehavior';
import { getCamp } from '../../config/camps';
import { SPAWN } from '../../config/spawn';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

const ANCHOR: GridCoord = { x: 5, y: 5 };

function campWorld(seed = 1): World {
  const world = new World(new EventBus<GameEvents>(), new RNG(seed));
  spawnCamps(world, [ANCHOR], [{ campId: 'bandit-squatters' }], 42);
  return world;
}

function campUnits(world: World): Unit[] {
  return world.units.filter((u) => u.campId !== null && u.currentHp > 0);
}

function spawnAt(world: World, team: Team, pos: GridCoord): Unit {
  return world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
}

const chebyshev = (a: GridCoord, b: GridCoord): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe('§75f — wiring', () => {
  it("the registry rehydrates the 'camp' kind", () => {
    expect(createBehavior('camp')).toBeInstanceOf(CampWanderBehavior);
  });

  it('a dripped member carries CampWanderBehavior in slot 0', () => {
    const world = campWorld();
    world.tick();
    const [member] = campUnits(world);
    expect(member!.behaviors[0]!.kind).toBe('camp');
    expect(member!.behaviors[1]!.kind).toBe('ability');
  });
});

describe('§75f — EXIT INVARIANT: spawn vacated ≤N ticks (the drip keeps flowing)', () => {
  it('both bandit-squatters members materialize within the derived bound', () => {
    const world = campWorld();
    world.tick(); // member #1 drips onto the anchor
    const first = campUnits(world)[0]!;
    // The bound, derived (never hardcoded): the spawn lockout, then one move
    // whose logical flip frees the anchor, then the next drip tick — with a
    // step of slack for the scan ordering.
    const moveTicks = first.derived.moveCooldownTicks;
    const bound = SPAWN.durationTicks + 2 * moveTicks + 4;
    let materializedAt: number | null = null;
    for (let t = 0; t < bound && materializedAt === null; t++) {
      world.tick();
      if (campUnits(world).length === 2) materializedAt = t;
    }
    expect(materializedAt).not.toBeNull();
    expect(world.campById(1)!.pending.length).toBe(0);
  });
});

describe('§75f — EXIT INVARIANT: the leash bounds passive wander', () => {
  it('no member ever idles outside leashRadius, and the wander is actually live', () => {
    const world = campWorld();
    const leash = getCamp('bandit-squatters')!.leashRadius;
    const visited = new Set<string>();
    for (let t = 0; t < 400; t++) {
      world.tick();
      for (const u of campUnits(world)) {
        const anchor = world.campById(u.campId!)!.anchor;
        expect(chebyshev(u.position, anchor)).toBeLessThanOrEqual(leash);
        visited.add(`${u.id}:${u.position.x},${u.position.y}`);
      }
    }
    // Liveness: the members visited several distinct cells (not a statue
    // pair). 2 members × >2 cells each is a lax floor for 400 ticks.
    expect(visited.size).toBeGreaterThan(4);
  });

  it('a member displaced beyond the leash walks itself back', () => {
    const world = campWorld();
    world.tick();
    const member = campUnits(world)[0]!;
    member.activeAction = null;
    member.position = { x: 11, y: 11 }; // a shove-like displacement, leash 2
    const leash = getCamp('bandit-squatters')!.leashRadius;
    for (let t = 0; t < 300 && chebyshev(member.position, ANCHOR) > leash; t++) {
      world.tick();
    }
    expect(chebyshev(member.position, ANCHOR)).toBeLessThanOrEqual(leash);
  });
});

describe('§75f — RNG discipline', () => {
  it('passive wander draws touch NEITHER the primary nor the combat stream', () => {
    const world = campWorld();
    const rngBefore = JSON.stringify(world.rng.toJSON());
    const combatBefore = JSON.stringify(world.combatRng.toJSON());
    const campBefore = JSON.stringify(world.campRng!.toJSON());
    for (let t = 0; t < 100; t++) world.tick();
    expect(JSON.stringify(world.rng.toJSON())).toBe(rngBefore);
    expect(JSON.stringify(world.combatRng.toJSON())).toBe(combatBefore);
    // ...and the camp stream DID advance (the wander is really riding it).
    expect(JSON.stringify(world.campRng!.toJSON())).not.toBe(campBefore);
  });

  it('same-seed worlds wander identically', () => {
    const a = campWorld(7);
    const b = campWorld(7);
    for (let t = 0; t < 150; t++) {
      a.tick();
      b.tick();
    }
    const positions = (w: World) => campUnits(w).map((u) => `${u.position.x},${u.position.y}`);
    expect(positions(a)).toEqual(positions(b));
  });
});

describe('§75f — the hostile delegate', () => {
  it('an aggroed member pursues past the leash and lands damage (leash bounds idling only)', () => {
    const world = campWorld();
    // Drip both members out before any faction unit exists (one-army boards
    // trip checkBattleEnd).
    world.tick();
    campUnits(world)[0]!.position = { x: 4, y: 4 };
    world.tick();
    for (const u of campUnits(world)) u.activeAction = null;
    const leash = getCamp('bandit-squatters')!.leashRadius;
    const dummy = spawnAt(world, 'player', { x: 11, y: 5 }); // outside the leash
    spawnAt(world, 'enemy', { x: 0, y: 11 }); // keeps the battle running
    world.markCampHostile(1, 'player');
    let leftLeash = false;
    for (let t = 0; t < 300 && dummy.currentHp === dummy.derived.maxHp; t++) {
      world.tick();
      if (campUnits(world).some((u) => chebyshev(u.position, ANCHOR) > leash)) leftLeash = true;
    }
    expect(dummy.currentHp).toBeLessThan(dummy.derived.maxHp);
    expect(leftLeash).toBe(true);
  });
});
