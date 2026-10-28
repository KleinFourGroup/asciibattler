import { describe, it, expect, vi } from 'vitest';
import { World } from './World';
import { Unit, type Team, type UnitStats } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { ARCHETYPE_CONFIG } from './archetypes';
import { rollUnit } from './archetypes';
import { deriveStats } from './stats';
import type { GameEvents } from '../core/events';
import type { TriggerContextMap } from './triggers';

/**
 * The World fires combat/lifecycle triggers (`dealHit`/`takeHit`/`kill`/
 * `death`/`spawn`) to registered handlers, on a 2-unit duel. `dealMiss` and
 * `evade` stay unfired until there is a dodge: every strike lands.
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
  const attacker = mkUnit(1, 'player', {}, 0);
  const target = mkUnit(2, 'enemy', {}, 1);
  world.placeUnits(attacker, target);
  return { world, attacker, target };
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
    world.applyDamage(attacker.id, target, 10, { crit: false });
    expect(order).toEqual(['a', 'b']);
  });

  it('fires dealHit + takeHit on a landed hit', () => {
    const { world, attacker, target } = duel(7);
    const deal = vi.fn();
    const take = vi.fn();
    world.registerTrigger('dealHit', deal);
    world.registerTrigger('takeHit', take);
    world.applyDamage(attacker.id, target, 8, { crit: true });
    expect(deal).toHaveBeenCalledTimes(1);
    expect(take).toHaveBeenCalledTimes(1);
    const takeCtx = take.mock.calls[0]![0] as TriggerContextMap['takeHit'];
    expect(takeCtx.target).toBe(target);
    expect(takeCtx.attacker).toBe(attacker);
    expect(takeCtx.crit).toBe(true);
  });

  it('every strike lands: no draw, dealHit and takeHit, and never dealMiss or evade', () => {
    const { world, attacker, target } = duel(7);
    const fired: string[] = [];
    for (const name of ['dealHit', 'takeHit', 'dealMiss', 'evade'] as const) {
      world.registerTrigger(name, () => fired.push(name));
    }
    const before = JSON.stringify(world.combatRng.toJSON());
    for (let i = 0; i < 20; i++) {
      expect(world.applyDamage(attacker.id, target, 1, { crit: false })).toBe(true);
    }
    expect(JSON.stringify(world.combatRng.toJSON())).toBe(before);
    expect(fired.filter((n) => n === 'dealHit')).toHaveLength(20);
    expect(fired.filter((n) => n === 'takeHit')).toHaveLength(20);
    expect(fired).not.toContain('dealMiss');
    expect(fired).not.toContain('evade');
  });

  it('fires kill when the blow is lethal (after dealHit/takeHit)', () => {
    const { world, attacker, target } = duel(7);
    const kill = vi.fn();
    world.registerTrigger('kill', kill);
    target.currentHp = 5;
    world.applyDamage(attacker.id, target, 10, { crit: false });
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
    world.applyDamage(attacker.id, target, 10, { crit: false });
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
      world.applyDamage(attacker.id, target, 10, { crit: false }),
    ).not.toThrow();
    expect(target.currentHp).toBe(hp - 10);
  });
});
