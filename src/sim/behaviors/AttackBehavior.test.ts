import { describe, it, expect } from 'vitest';
import { AttackBehavior } from './AttackBehavior';
import { World } from '../World';
import { Unit, type Team, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';

describe('AttackBehavior', () => {
  it('does not attack when no enemy is in range', () => {
    const { world, units, attacks } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1 },
      { team: 'enemy', x: 5, y: 0, hp: 30, inert: true },
    ]);
    world.tick();
    expect(units[1]!.currentHp).toBe(30);
    expect(attacks).toHaveLength(0);
  });

  it('attacks an adjacent enemy, deals damage, and emits unit:attacked', () => {
    const { world, units, attacks } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, attackDamage: 7, attackCooldownTicks: 5 },
      { team: 'enemy', x: 1, y: 0, hp: 30, inert: true },
    ]);
    world.tick();
    expect(units[1]!.currentHp).toBe(23);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toEqual({
      attackerId: units[0]!.id,
      targetId: units[1]!.id,
      damage: 7,
    });
  });

  it('attacks at attackCooldownTicks cadence (action ticks exactly N apart)', () => {
    const { world, attacks } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, attackDamage: 1, attackCooldownTicks: 3 },
      { team: 'enemy', x: 1, y: 0, hp: 100, inert: true },
    ]);

    world.tick(); // tick 1: attacks
    expect(attacks).toHaveLength(1);
    world.tick(); // tick 2: cooldown 2 → 1
    world.tick(); // tick 3: cooldown 1 → 0
    expect(attacks).toHaveLength(1);
    world.tick(); // tick 4: attacks
    expect(attacks).toHaveLength(2);
  });

  it('stops attacking once the target is dead', () => {
    const { world, units, attacks } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, attackDamage: 10, attackCooldownTicks: 1 },
      { team: 'enemy', x: 1, y: 0, hp: 15, inert: true },
    ]);

    world.tick(); // hits for 10 (hp=5)
    world.tick(); // cooldown 0 → hits for 10 (hp=-5, target now "dead")
    const attackCountAfterKill = attacks.length;
    expect(units[1]!.currentHp).toBeLessThanOrEqual(0);

    for (let i = 0; i < 5; i++) world.tick();
    expect(attacks).toHaveLength(attackCountAfterKill);
  });

  it('does not attack a unit on the same team', () => {
    const { world, units, attacks } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, attackDamage: 5 },
      { team: 'player', x: 1, y: 0, hp: 30, inert: true },
    ]);
    world.tick();
    expect(units[1]!.currentHp).toBe(30);
    expect(attacks).toHaveLength(0);
  });
});

interface SceneUnit {
  team: Team;
  x: number;
  y: number;
  hp?: number;
  attackRange?: number;
  attackDamage?: number;
  attackCooldownTicks?: number;
  inert?: boolean;
}

function scene(specs: SceneUnit[]): {
  world: World;
  units: Unit[];
  attacks: GameEvents['unit:attacked'][];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const attacks: GameEvents['unit:attacked'][] = [];
  bus.on('unit:attacked', (p) => attacks.push(p));

  let nextId = 1;
  const units = specs.map((s) => {
    const stats: UnitStats = {
      maxHp: s.hp ?? 50,
      attackDamage: s.attackDamage ?? 10,
      attackRange: s.attackRange ?? 1,
      attackCooldownTicks: s.attackCooldownTicks ?? 8,
      moveCooldownTicks: 5,
    };
    const u = new Unit({
      id: nextId++,
      team: s.team,
      glyph: 'M',
      stats,
      position: { x: s.x, y: s.y },
    });
    if (s.hp !== undefined) u.currentHp = s.hp;
    if (!s.inert) u.behaviors.push(new AttackBehavior());
    world.units.push(u);
    return u;
  });
  return { world, units, attacks };
}
