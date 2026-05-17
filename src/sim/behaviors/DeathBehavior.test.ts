import { describe, it, expect } from 'vitest';
import { DeathBehavior } from './DeathBehavior';
import { MovementBehavior } from './MovementBehavior';
import { AttackBehavior } from './AttackBehavior';
import { World } from '../World';
import { Unit, type Team, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';

describe('DeathBehavior', () => {
  it('removes the unit and emits unit:died when currentHp reaches 0', () => {
    const { world, units, deaths } = scene([
      { team: 'player', x: 0, y: 0, hp: 0, behaviors: 'death-only' },
    ]);

    expect(world.units).toHaveLength(1);
    world.tick();
    expect(world.units).toHaveLength(0);
    expect(deaths).toEqual([{ unitId: units[0]!.id }]);
  });

  it('removes units with negative HP (overkill)', () => {
    const { world, deaths } = scene([
      { team: 'player', x: 0, y: 0, hp: -42, behaviors: 'death-only' },
    ]);
    world.tick();
    expect(world.units).toHaveLength(0);
    expect(deaths).toHaveLength(1);
  });

  it('does nothing while currentHp > 0', () => {
    const { world, deaths } = scene([
      { team: 'player', x: 0, y: 0, hp: 30, behaviors: 'death-only' },
    ]);
    world.tick();
    world.tick();
    expect(world.units).toHaveLength(1);
    expect(deaths).toHaveLength(0);
  });

  it('dead units do not move or attack the tick they die', () => {
    // Player and enemy adjacent. Player one-shots enemy. Enemy then
    // shouldn't get a posthumous swing back at the player even though its
    // own behaviors run later in the same tick.
    const { world, units, attacks } = scene([
      {
        team: 'player',
        x: 0,
        y: 0,
        hp: 50,
        attackDamage: 999,
        attackCooldownTicks: 5,
        attackRange: 1,
        behaviors: 'all',
      },
      {
        team: 'enemy',
        x: 1,
        y: 0,
        hp: 30,
        attackDamage: 999,
        attackCooldownTicks: 5,
        attackRange: 1,
        behaviors: 'all',
      },
    ]);

    world.tick(); // player kills enemy; enemy must not counter-attack
    expect(attacks).toHaveLength(1);
    expect(attacks[0]?.attackerId).toBe(units[0]!.id);
    expect(units[0]!.currentHp).toBe(50);
    expect(world.findUnit(units[1]!.id)).toBeUndefined();
  });
});

interface SceneUnit {
  team: Team;
  x: number;
  y: number;
  hp?: number;
  attackDamage?: number;
  attackRange?: number;
  attackCooldownTicks?: number;
  behaviors: 'all' | 'death-only' | 'none';
}

function scene(specs: SceneUnit[]): {
  world: World;
  units: Unit[];
  deaths: GameEvents['unit:died'][];
  attacks: GameEvents['unit:attacked'][];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const deaths: GameEvents['unit:died'][] = [];
  const attacks: GameEvents['unit:attacked'][] = [];
  bus.on('unit:died', (p) => deaths.push(p));
  bus.on('unit:attacked', (p) => attacks.push(p));

  let nextId = 1;
  const units = specs.map((s) => {
    const stats: UnitStats = {
      maxHp: 50,
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
    if (s.behaviors === 'all') {
      u.behaviors.push(new MovementBehavior(), new AttackBehavior(), new DeathBehavior());
    } else if (s.behaviors === 'death-only') {
      u.behaviors.push(new DeathBehavior());
    }
    world.units.push(u);
    return u;
  });
  return { world, units, deaths, attacks };
}
