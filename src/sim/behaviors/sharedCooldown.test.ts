import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { Unit, type Team, type UnitStats } from '../Unit';
import { MovementBehavior } from './MovementBehavior';
import { AttackBehavior } from './AttackBehavior';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';

/**
 * Cross-behavior tests for the shared `unit.actionCooldown`. A unit takes
 * exactly one action per "decision" — moving locks out attacks (and vice
 * versa) for the corresponding cooldown.
 */
describe('shared actionCooldown', () => {
  it('attack after move waits the full moveCooldownTicks before firing', () => {
    // Player at (0,0) with melee range 1; enemy 2 cells away. Tick 1 should
    // move (now in range), and the first attack should only land
    // moveCooldownTicks later.
    const moveCD = 3;
    const { world, units, moves, attacks } = scene([
      {
        team: 'player',
        x: 0,
        y: 0,
        attackRange: 1,
        attackDamage: 5,
        attackCooldownTicks: 8,
        moveCooldownTicks: moveCD,
        behaviors: 'all',
      },
      { team: 'enemy', x: 2, y: 0, hp: 50, behaviors: 'none' },
    ]);

    world.tick(); // tick 1: move (now adjacent), attack blocked by shared CD
    expect(units[0]!.position).toEqual({ x: 1, y: 0 });
    expect(moves).toHaveLength(1);
    expect(attacks).toHaveLength(0);

    // Ticks 2 .. moveCD: no actions; cooldown counts down.
    for (let i = 2; i <= moveCD; i++) {
      world.tick();
      expect(attacks).toHaveLength(0);
    }

    // Tick moveCD + 1: cooldown is 0, in range — attack fires.
    world.tick();
    expect(attacks).toHaveLength(1);
    expect(units[1]!.currentHp).toBe(45);
  });

  it('attacks immediately if already in range on tick 1', () => {
    const { world, attacks } = scene([
      {
        team: 'player',
        x: 5,
        y: 5,
        attackRange: 1,
        attackDamage: 3,
        attackCooldownTicks: 6,
        moveCooldownTicks: 4,
        behaviors: 'all',
      },
      { team: 'enemy', x: 6, y: 5, hp: 50, behaviors: 'none' },
    ]);

    world.tick();
    expect(attacks).toHaveLength(1);
  });

  it('cannot move during the attack cooldown that follows an attack', () => {
    // Adjacent on tick 1: unit attacks (sets CD to attackCD). Even though it
    // could otherwise step toward a different target, the shared CD locks
    // movement out until the attack cooldown elapses.
    const attackCD = 5;
    const { world, units, moves } = scene([
      {
        team: 'player',
        x: 5,
        y: 5,
        attackRange: 1,
        attackDamage: 999, // one-shot the adjacent enemy
        attackCooldownTicks: attackCD,
        moveCooldownTicks: 1,
        behaviors: 'all',
      },
      { team: 'enemy', x: 6, y: 5, hp: 50, behaviors: 'none' },
      // A second enemy far away — after the first dies, the unit would
      // *want* to start moving, but must wait out the attack cooldown.
      { team: 'enemy', x: 5, y: 0, hp: 50, behaviors: 'none' },
    ]);

    world.tick(); // tick 1: attack kills enemy #1
    expect(units[1]!.currentHp).toBeLessThanOrEqual(0);
    expect(moves).toHaveLength(0);

    // Should not move during the attack cooldown.
    for (let i = 0; i < attackCD - 1; i++) {
      world.tick();
      expect(moves).toHaveLength(0);
    }

    // After the cooldown elapses, the unit can start chasing the survivor.
    world.tick();
    expect(moves.length).toBeGreaterThanOrEqual(1);
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
  moveCooldownTicks?: number;
  behaviors: 'all' | 'none';
}

function scene(specs: SceneUnit[]): {
  world: World;
  units: Unit[];
  moves: GameEvents['unit:moved'][];
  attacks: GameEvents['unit:attacked'][];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const moves: GameEvents['unit:moved'][] = [];
  const attacks: GameEvents['unit:attacked'][] = [];
  bus.on('unit:moved', (p) => moves.push(p));
  bus.on('unit:attacked', (p) => attacks.push(p));

  let nextId = 1;
  const units = specs.map((s) => {
    const stats: UnitStats = {
      maxHp: s.hp ?? 50,
      attackDamage: s.attackDamage ?? 10,
      attackRange: s.attackRange ?? 1,
      attackCooldownTicks: s.attackCooldownTicks ?? 8,
      moveCooldownTicks: s.moveCooldownTicks ?? 5,
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
      u.behaviors.push(new MovementBehavior(), new AttackBehavior());
    }
    world.units.push(u);
    return u;
  });
  return { world, units, moves, attacks };
}
