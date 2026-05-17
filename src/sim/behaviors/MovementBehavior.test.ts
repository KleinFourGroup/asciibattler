import { describe, it, expect } from 'vitest';
import { MovementBehavior } from './MovementBehavior';
import { World } from '../World';
import { Unit, type Team, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';

describe('MovementBehavior', () => {
  it('does not move on the first tick when already in attack range', () => {
    const { world, units, moves } = scene([
      { team: 'player', x: 5, y: 5, attackRange: 1 },
      { team: 'enemy', x: 6, y: 5, inert: true },
    ]);
    world.tick();
    expect(units[0]!.position).toEqual({ x: 5, y: 5 });
    expect(moves).toHaveLength(0);
  });

  it('does not move when no enemies exist', () => {
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0 },
      { team: 'player', x: 5, y: 5 },
    ]);
    world.tick();
    expect(units[0]!.position).toEqual({ x: 0, y: 0 });
    expect(moves).toHaveLength(0);
  });

  it('steps one cell toward the target, emits unit:moved with correct fields, and sets the cooldown', () => {
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, moveCooldownTicks: 4 },
      { team: 'enemy', x: 5, y: 0, inert: true },
    ]);

    world.tick();

    expect(units[0]!.position).toEqual({ x: 1, y: 0 });
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({
      unitId: units[0]!.id,
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      durationTicks: 4,
    });
  });

  it('waits cooldownTicks after a move before moving again', () => {
    const { world, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, moveCooldownTicks: 3 },
      { team: 'enemy', x: 8, y: 0, inert: true },
    ]);

    world.tick(); // tick 1: moves
    expect(moves).toHaveLength(1);
    world.tick(); // tick 2: cooldown 3 → 2
    world.tick(); // tick 3: cooldown 2 → 1
    world.tick(); // tick 4: cooldown 1 → 0
    expect(moves).toHaveLength(1);
    world.tick(); // tick 5: cooldown 0 → moves
    expect(moves).toHaveLength(2);
  });

  it('retries every tick while blocked (no cooldown reset)', () => {
    const wall: SceneUnit[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        wall.push({ team: 'player', x: 5 + dx, y: 5 + dy, inert: true });
      }
    }
    const { world, units, moves } = scene([
      { team: 'player', x: 5, y: 5, attackRange: 1, moveCooldownTicks: 5 },
      ...wall,
      { team: 'enemy', x: 0, y: 0, inert: true },
    ]);

    for (let i = 0; i < 5; i++) world.tick();
    expect(moves).toHaveLength(0);
    expect(units[0]!.position).toEqual({ x: 5, y: 5 });
  });

  it('two opposing units converge until adjacent, then stop', () => {
    const { world, units } = scene([
      { team: 'player', x: 0, y: 5, attackRange: 1, moveCooldownTicks: 1 },
      { team: 'enemy', x: 5, y: 5, attackRange: 1, moveCooldownTicks: 1 },
    ]);

    // Tick until they touch or we hit a cap.
    for (let i = 0; i < 20; i++) {
      world.tick();
      const dist = Math.max(
        Math.abs(units[0]!.position.x - units[1]!.position.x),
        Math.abs(units[0]!.position.y - units[1]!.position.y),
      );
      if (dist <= 1) break;
    }

    const finalDist = Math.max(
      Math.abs(units[0]!.position.x - units[1]!.position.x),
      Math.abs(units[0]!.position.y - units[1]!.position.y),
    );
    expect(finalDist).toBe(1);

    // Now they shouldn't move any further.
    const before = [units[0]!.position, units[1]!.position];
    for (let i = 0; i < 10; i++) world.tick();
    expect(units[0]!.position).toEqual(before[0]);
    expect(units[1]!.position).toEqual(before[1]);
  });
});

interface SceneUnit {
  team: Team;
  x: number;
  y: number;
  attackRange?: number;
  moveCooldownTicks?: number;
  attackCooldownTicks?: number;
  /** Skip attaching MovementBehavior — for static targets and walls. */
  inert?: boolean;
}

function scene(specs: SceneUnit[]): {
  world: World;
  units: Unit[];
  moves: GameEvents['unit:moved'][];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const moves: GameEvents['unit:moved'][] = [];
  bus.on('unit:moved', (p) => moves.push(p));

  let nextId = 1;
  const units = specs.map((s) => {
    const stats: UnitStats = {
      maxHp: 50,
      attackDamage: 10,
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
    if (!s.inert) u.behaviors.push(new MovementBehavior());
    world.units.push(u);
    return u;
  });
  return { world, units, moves };
}
