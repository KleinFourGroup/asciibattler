import { describe, it, expect } from 'vitest';
import { AttackBehavior } from './AttackBehavior';
import { World } from '../World';
import type { Unit, Team, UnitStats, UnitTemplate } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { spawnHalfCover, spawnWall } from '../environment';
import { ARCHETYPE_CONFIG } from '../archetypes';
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
      crit: false,
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

  it('abstains when a wall is on the line to a ranged target', () => {
    const { world, units, attacks } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 5, attackDamage: 5, attackCooldownTicks: 5 },
      { team: 'enemy', x: 5, y: 0, hp: 30, inert: true },
    ]);
    spawnWall(world, { x: 3, y: 0 });
    world.tick();
    expect(units[1]!.currentHp).toBe(30);
    expect(attacks).toHaveLength(0);
  });

  it('still fires on a ranged target when the wall is off the line', () => {
    const { world, units, attacks } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 5, attackDamage: 5, attackCooldownTicks: 5 },
      { team: 'enemy', x: 5, y: 0, hp: 30, inert: true },
    ]);
    spawnWall(world, { x: 3, y: 3 });
    world.tick();
    expect(units[1]!.currentHp).toBe(25);
    expect(attacks).toHaveLength(1);
  });

  it('melee attack against an adjacent target is unaffected by surrounding walls', () => {
    const { world, units, attacks } = scene([
      { team: 'player', x: 1, y: 1, attackRange: 1, attackDamage: 5, attackCooldownTicks: 5 },
      { team: 'enemy', x: 2, y: 1, hp: 30, inert: true },
    ]);
    // Surround both units with walls — adjacent attack has no intermediate cells.
    spawnWall(world, { x: 0, y: 1 });
    spawnWall(world, { x: 1, y: 0 });
    spawnWall(world, { x: 2, y: 2 });
    spawnWall(world, { x: 3, y: 1 });
    world.tick();
    expect(units[1]!.currentHp).toBe(25);
    expect(attacks).toHaveLength(1);
  });

  it('D6: ranged attack passes through half-cover (LOS-transparent)', () => {
    const { world, units, attacks } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 5, attackDamage: 5, attackCooldownTicks: 5 },
      { team: 'enemy', x: 5, y: 0, hp: 30, inert: true },
    ]);
    // Same geometry as the "wall blocks" test above, but with half-cover
    // instead. Should fire through.
    spawnHalfCover(world, { x: 3, y: 0 });
    world.tick();
    expect(units[1]!.currentHp).toBe(25);
    expect(attacks).toHaveLength(1);
  });

  it('D6: wall + half-cover mix — wall blocks, half-cover does not contribute', () => {
    const { world, units, attacks } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 5, attackDamage: 5, attackCooldownTicks: 5 },
      { team: 'enemy', x: 5, y: 0, hp: 30, inert: true },
    ]);
    spawnHalfCover(world, { x: 2, y: 0 }); // on line, ignored
    spawnWall(world, { x: 3, y: 0 }); // on line, blocks
    world.tick();
    expect(units[1]!.currentHp).toBe(30);
    expect(attacks).toHaveLength(0);
  });

  it('D7.A: chasm tile between attacker and target does NOT block ranged LOS', () => {
    // Chasm is a TILE, not a unit-blocker — never enters the LOS
    // pipeline. A ranged attacker should fire straight through a chasm
    // column with no wall on the line. Geometry mirrors the wall-block
    // case at line 76 above.
    const { world, units, attacks } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 5, attackDamage: 5, attackCooldownTicks: 5 },
      { team: 'enemy', x: 5, y: 0, hp: 30, inert: true },
    ]);
    world.tileGrid.setKind({ x: 3, y: 0 }, 'chasm');
    world.tick();
    expect(units[1]!.currentHp).toBe(25);
    expect(attacks).toHaveLength(1);
  });

  it('fires once the blocking wall is destroyed (HP forced to 0)', () => {
    const { world, units, attacks } = scene([
      { team: 'player', x: 0, y: 0, attackRange: 5, attackDamage: 5, attackCooldownTicks: 1 },
      { team: 'enemy', x: 5, y: 0, hp: 30, inert: true },
    ]);
    const wall = spawnWall(world, { x: 3, y: 0 });

    world.tick(); // blocked
    expect(attacks).toHaveLength(0);

    wall.currentHp = 0; // simulate destruction (C2 AoE will do this for real)
    world.tick(); // World removes the wall, then runs the selector — but
                  // the death short-circuit happens before selector, so the
                  // attack fires next tick.
    world.tick();
    expect(attacks.length).toBeGreaterThanOrEqual(1);
    expect(units[1]!.currentHp).toBeLessThan(30);
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

  const units = specs.map((s) => {
    // E1: pick the archetype that gives the right attackRange (melee=1,
    // ranged=3+). Tests pass `attackRange: 5` etc. to force ranged-style
    // shots — we honor that by overriding `derived.attackRange` after
    // spawnUnit, since attackRange is a per-archetype primitive at the
    // config layer.
    const archetype = (s.attackRange ?? 1) > 1 ? 'ranged' : 'melee';
    const baseStats = ARCHETYPE_CONFIG[archetype].baseStats;
    // luck=0 keeps the crit roll deterministically false so the per-test
    // exact damage assertions hold. Damage source is strength (melee) or
    // ranged (ranged stat) — we set both to `s.attackDamage` so either
    // archetype produces the requested damage. Constitution drives maxHp
    // via deriveStats (con=20 → 50 hp for melee, con=12 → 30 for ranged).
    const stats: UnitStats = {
      ...baseStats,
      luck: 0,
      strength: s.attackDamage ?? baseStats.strength,
      ranged: s.attackDamage ?? baseStats.ranged,
    };
    const template: UnitTemplate = { archetype, stats };
    // Spawn through World so id allocation is consistent with any
    // subsequent spawnWall / spawnEnvironment calls in the test body.
    const u = world.spawnUnit(template, s.team, { x: s.x, y: s.y });
    // Override per-test knobs on top of the spawn-time derived values.
    if (s.attackRange !== undefined || s.attackCooldownTicks !== undefined) {
      const mutDerived = u as unknown as { derived: { -readonly [K in keyof typeof u.derived]: number } };
      if (s.attackRange !== undefined) mutDerived.derived.attackRange = s.attackRange;
      if (s.attackCooldownTicks !== undefined) {
        mutDerived.derived.attackCooldownTicks = s.attackCooldownTicks;
      }
    }
    if (s.hp !== undefined) u.currentHp = s.hp;
    if (!s.inert) u.behaviors.push(new AttackBehavior());
    return u;
  });
  return { world, units, attacks };
}
