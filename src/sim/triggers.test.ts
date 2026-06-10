import { describe, it, expect, vi } from 'vitest';
import { World } from './World';
import { Unit, type Team, type UnitStats } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { ARCHETYPE_CONFIG } from './archetypes';
import { rollUnit } from './archetypes';
import { deriveStats, hitChanceFor } from './stats';
import { STATS } from '../config/stats';
import type { GameEvents } from '../core/events';
import type { TriggerContextMap } from './triggers';

/**
 * K1 — the World fires combat/lifecycle triggers (`dealHit`/`takeHit`/
 * `dealMiss`/`evade`/`kill`/`death`/`spawn`) to registered handlers. These
 * mirror the I2 `evadeDuel` harness: a 2-unit duel with an explicitly-seeded
 * `combatRng` so the to-hit roll is controllable.
 */

function mkUnit(id: number, team: Team, over: Partial<UnitStats>, x: number): Unit {
  const stats: UnitStats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, defense: 0, ...over };
  return new Unit({
    id,
    team,
    archetype: 'mercenary',
    glyph: 'M',
    stats,
    derived: deriveStats(stats, 1),
    position: { x, y: 0 },
  });
}

function duel(combatSeed: number): { world: World; attacker: Unit; target: Unit } {
  const world = new World(new EventBus<GameEvents>(), new RNG(1), 12, 12, undefined, new RNG(combatSeed));
  const attacker = mkUnit(1, 'player', { precision: 0, evasion: 0 }, 0);
  const target = mkUnit(2, 'enemy', { precision: 0, evasion: 0 }, 1);
  world.units.push(attacker, target);
  return { world, attacker, target };
}

/** Smallest seed whose first combatRng draw clears `hitChance` (a guaranteed
 *  miss). Deterministic search, not a hand-computed value. */
function seedThatMisses(hitChance: number): number {
  for (let s = 1; s < 100_000; s++) {
    if (new RNG(s).next() >= hitChance) return s;
  }
  throw new Error('no missing seed found');
}

describe('World trigger dispatch', () => {
  it('runs registered handlers in registration order with the right context', () => {
    const { world, attacker, target } = duel(7);
    const order: string[] = [];
    world.registerTrigger('dealHit', (ctx) => {
      order.push('a');
      expect(ctx.attacker).toBe(attacker);
      expect(ctx.target).toBe(target);
      expect(ctx.damage).toBe(10);
      expect(ctx.crit).toBe(false);
    });
    world.registerTrigger('dealHit', () => order.push('b'));
    // Unmissable strike → a guaranteed hit, no combatRng dependence.
    world.applyDamage(attacker.id, target, 10, { crit: false, evadable: false });
    expect(order).toEqual(['a', 'b']);
  });

  it('fires dealHit + takeHit on a landed hit', () => {
    const { world, attacker, target } = duel(7);
    const deal = vi.fn();
    const take = vi.fn();
    world.registerTrigger('dealHit', deal);
    world.registerTrigger('takeHit', take);
    world.applyDamage(attacker.id, target, 8, { crit: true, evadable: false });
    expect(deal).toHaveBeenCalledTimes(1);
    expect(take).toHaveBeenCalledTimes(1);
    const takeCtx = take.mock.calls[0]![0] as TriggerContextMap['takeHit'];
    expect(takeCtx.target).toBe(target);
    expect(takeCtx.attacker).toBe(attacker);
    expect(takeCtx.crit).toBe(true);
  });

  it('fires dealMiss + evade on an evaded strike (and not dealHit/takeHit)', () => {
    const floor = hitChanceFor(0.6, 0, 99);
    expect(floor).toBe(STATS.hitChanceFloor);
    const world = new World(
      new EventBus<GameEvents>(),
      new RNG(1),
      12,
      12,
      undefined,
      new RNG(seedThatMisses(floor)),
    );
    const attacker = mkUnit(1, 'player', { precision: 0, evasion: 0 }, 0);
    const target = mkUnit(2, 'enemy', { precision: 0, evasion: 99 }, 1);
    world.units.push(attacker, target);
    const dealMiss = vi.fn();
    const evade = vi.fn();
    const dealHit = vi.fn();
    world.registerTrigger('dealMiss', dealMiss);
    world.registerTrigger('evade', evade);
    world.registerTrigger('dealHit', dealHit);
    world.applyDamage(attacker.id, target, 10, { crit: false, evadable: true, accuracy: 0.6 });
    expect(dealMiss).toHaveBeenCalledTimes(1);
    expect(evade).toHaveBeenCalledTimes(1);
    expect(dealHit).not.toHaveBeenCalled();
    const evadeCtx = evade.mock.calls[0]![0] as TriggerContextMap['evade'];
    expect(evadeCtx.target).toBe(target); // the dodger is the subject
    expect(evadeCtx.attacker).toBe(attacker);
  });

  it('fires kill when the blow is lethal (after dealHit/takeHit)', () => {
    const { world, attacker, target } = duel(7);
    const kill = vi.fn();
    world.registerTrigger('kill', kill);
    target.currentHp = 5;
    world.applyDamage(attacker.id, target, 10, { crit: false, evadable: false });
    expect(kill).toHaveBeenCalledTimes(1);
    const ctx = kill.mock.calls[0]![0] as TriggerContextMap['kill'];
    expect(ctx.attacker).toBe(attacker);
    expect(ctx.victim).toBe(target);
  });

  it('does NOT fire kill on a non-lethal hit', () => {
    const { world, attacker, target } = duel(7);
    const kill = vi.fn();
    world.registerTrigger('kill', kill);
    target.currentHp = 100;
    world.applyDamage(attacker.id, target, 10, { crit: false, evadable: false });
    expect(kill).not.toHaveBeenCalled();
  });

  it('fires death at the death-removal site (via tick)', () => {
    const world = new World(new EventBus<GameEvents>(), new RNG(1));
    const rng = new RNG(42);
    const u = world.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 1, y: 1 });
    const death = vi.fn();
    world.registerTrigger('death', death);
    u.currentHp = 0;
    world.tick();
    expect(death).toHaveBeenCalledTimes(1);
    const ctx = death.mock.calls[0]![0] as TriggerContextMap['death'];
    expect(ctx.unit).toBe(u);
    expect(ctx.team).toBe('player');
  });

  it('fires spawn when a unit enters the grid', () => {
    const world = new World(new EventBus<GameEvents>(), new RNG(1));
    const spawn = vi.fn();
    world.registerTrigger('spawn', spawn);
    const rng = new RNG(42);
    const u = world.spawnUnit(rollUnit('mercenary', rng), 'player', { x: 1, y: 1 });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect((spawn.mock.calls[0]![0] as TriggerContextMap['spawn']).unit).toBe(u);
  });

  it('is a no-op with no handler registered (combat resolves normally)', () => {
    const { world, attacker, target } = duel(7);
    const hp = target.currentHp;
    expect(() =>
      world.applyDamage(attacker.id, target, 10, { crit: false, evadable: false }),
    ).not.toThrow();
    expect(target.currentHp).toBe(hp - 10);
  });

  it('end-to-end: an on-evade handler applying a +speed effect buffs the dodger', () => {
    const floor = hitChanceFor(0.6, 0, 99);
    const world = new World(
      new EventBus<GameEvents>(),
      new RNG(1),
      12,
      12,
      undefined,
      new RNG(seedThatMisses(floor)),
    );
    const attacker = mkUnit(1, 'player', { precision: 0, evasion: 0 }, 0);
    const target = mkUnit(2, 'enemy', { precision: 0, evasion: 99, speed: 5 }, 1);
    world.units.push(attacker, target);
    // The L dodge-buff, in miniature: on evade, the dodger gains +1 speed.
    world.registerTrigger('evade', (ctx) => {
      ctx.target.addEffect({
        key: 'nimble',
        magnitude: 1,
        mods: { speed: { add: 1 } },
        lifetime: { kind: 'ticks', expiresAtTick: world.currentTick + 200 },
        merge: 'add',
      });
    });
    expect(target.effectiveStats.speed).toBe(5);
    world.applyDamage(attacker.id, target, 10, { crit: false, evadable: true, accuracy: 0.6 });
    expect(target.effectiveStats.speed).toBe(6);
  });
});
