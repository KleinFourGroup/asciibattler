import { describe, it, expect } from 'vitest';
import { MovementBehavior } from './MovementBehavior';
import { World } from '../World';
import { Unit, type Team, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { spawnHalfCover } from '../environment';
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

  it('waits exactly moveCooldownTicks between consecutive moves', () => {
    // Action ticks must be N apart so the sprite lerp (durationTicks=N)
    // dovetails into the next move with no idle frame in between.
    const { world, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, moveCooldownTicks: 3 },
      { team: 'enemy', x: 8, y: 0, inert: true },
    ]);

    world.tick(); // tick 1: moves
    expect(moves).toHaveLength(1);
    world.tick(); // tick 2: cooldown 2 → 1
    world.tick(); // tick 3: cooldown 1 → 0
    expect(moves).toHaveLength(1);
    world.tick(); // tick 4: cooldown 0 → moves
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

  it('moves toward a target whose attack-range neighbors are all walls + allies (C1d Labyrinth regression)', () => {
    // C1d Labyrinth softlock: pre-fix MovementBehavior picked a goal cell
    // within attackRange of target, then pathed there. When every in-range
    // cell was a wall (e.g. row 8 of the Labyrinth) or an ally (rest of
    // the team packed on the spawn row), the goal-picker returned null
    // and the unit froze — even though target was reachable through a
    // diagonal squeeze. The fix paths to target's cell directly, with
    // target excluded from blockers.
    //
    // Setup on a 5x5 grid:
    //   row 0: P . . . .       <- player at (0,0)
    //   row 1: . . . . .
    //   row 2: . . . . .
    //   row 3: # # . # #       <- walls at x=0,1,3,4 ; gap at (2,3)
    //   row 4: . . A T A       <- allies at (2,4),(4,4) ; target T at (3,4)
    // Target T's 5 in-bounds neighbors are: (2,3) wall, (3,3) wall,
    // (4,3) wall, (2,4) ally, (4,4) ally. All blocked → pre-fix freezes.
    // Post-fix steps from (0,0) toward (3,4) via (2,3).
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, moveCooldownTicks: 1 },
      // Target first so it gets the lowest enemy id and wins the
      // chebyshev tie at distance 4 against the two allies.
      { team: 'enemy', x: 3, y: 4, inert: true },
      { team: 'enemy', x: 2, y: 4, inert: true },
      { team: 'enemy', x: 4, y: 4, inert: true },
      { team: 'player', x: 0, y: 3, inert: true },
      { team: 'player', x: 1, y: 3, inert: true },
      { team: 'player', x: 3, y: 3, inert: true },
      { team: 'player', x: 4, y: 3, inert: true },
    ]);

    world.tick();

    expect(moves).toHaveLength(1);
    // Step must approach (3,4). Pre-fix this would be 0 moves.
    const newPos = units[0]!.position;
    expect(newPos).not.toEqual({ x: 0, y: 0 });
    const distAfter = Math.max(Math.abs(newPos.x - 3), Math.abs(newPos.y - 4));
    expect(distAfter).toBeLessThan(4);
  });

  it('D6: paths AROUND a half-cover (pathfinding still treats it as a blocker)', () => {
    // Straight line player→enemy passes through (3,0); half-cover sits there.
    // Player should detour rather than walking through.
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 1, moveCooldownTicks: 1 },
      { team: 'enemy', x: 5, y: 0, inert: true },
    ]);
    spawnHalfCover(world, { x: 3, y: 0 });

    world.tick();
    expect(moves).toHaveLength(1);
    // First step should be a valid neighbor of (0,0) other than (3,0).
    const newPos = units[0]!.position;
    expect(newPos).not.toEqual({ x: 3, y: 0 });
    // Chebyshev distance to (3,0) should be > 0 after one step (didn't land on it).
    const distToHC = Math.max(Math.abs(newPos.x - 3), Math.abs(newPos.y - 0));
    expect(distToHC).toBeGreaterThan(0);
  });

  it('D6: ranged unit with half-cover on the LOS line still abstains in-range (lets AttackBehavior fire)', () => {
    // The pre-D6 MovementBehavior treated half-cover as an LOS blocker,
    // so a ranged unit in range with a half-cover between it and target
    // would keep stepping forward (LOS-gated in-range abstain failed).
    // Post-D6 the LOS check ignores half-cover, so movement abstains and
    // AttackBehavior is free to fire.
    const { world, units, moves } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 5, moveCooldownTicks: 1 },
      { team: 'enemy', x: 4, y: 0, inert: true },
    ]);
    spawnHalfCover(world, { x: 2, y: 0 });

    world.tick();
    expect(moves).toHaveLength(0);
    expect(units[0]!.position).toEqual({ x: 0, y: 0 });
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
