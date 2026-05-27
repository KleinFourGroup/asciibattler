import { describe, it, expect } from 'vitest';
import { AbilityBehavior } from './AbilityBehavior';
import { World } from '../World';
import { Unit, type Team, type UnitStats, type UnitTemplate } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { spawnHalfCover, spawnWall } from '../environment';
import { ARCHETYPE_CONFIG } from '../archetypes';
import { MeleeStrike, RangedShot } from '../abilities/strikes';
import type { Ability } from '../abilities/Ability';
import type { ActionProposal } from '../Action';
import type { GameEvents } from '../../core/events';
import { AttackAction } from '../actions/AttackAction';

describe('AbilityBehavior', () => {
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
    spawnHalfCover(world, { x: 2, y: 0 });
    spawnWall(world, { x: 3, y: 0 });
    world.tick();
    expect(units[1]!.currentHp).toBe(30);
    expect(attacks).toHaveLength(0);
  });

  it('D7.A: chasm tile between attacker and target does NOT block ranged LOS', () => {
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

    wall.currentHp = 0;
    world.tick();
    world.tick();
    expect(attacks.length).toBeGreaterThanOrEqual(1);
    expect(units[1]!.currentHp).toBeLessThan(30);
  });

  // ─── E2 — multi-ability scoring + per-ability cooldown ───────────────────

  it('E2: picks the higher-scoring ability when both fire on the same tick', () => {
    // Synthetic unit with two abilities: a low-score one and a high-score
    // one, both proposing on every tick. AbilityBehavior should always
    // pick the high-score ability. Wraps AttackAction so the existing
    // damage path lights up — the test reads damage to verify which
    // ability fired (low: 3 damage, high: 9).
    const { world, units, attacks } = sceneWithAbilities(
      [
        { team: 'player', x: 0, y: 0, hp: 50 },
        { team: 'enemy', x: 1, y: 0, hp: 100, inert: true },
      ],
      [new LowScoreStrike(3), new HighScoreStrike(9)],
    );

    world.tick();
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.damage).toBe(9);
    expect(units[1]!.currentHp).toBe(91);
  });

  it('E2: ties go to the first ability in config order (array order)', () => {
    // Two abilities, same score, different damage. AbilityBehavior uses
    // strict `>` against `best.score`, so the FIRST proposer wins.
    const { world, attacks } = sceneWithAbilities(
      [
        { team: 'player', x: 0, y: 0, hp: 50 },
        { team: 'enemy', x: 1, y: 0, hp: 100, inert: true },
      ],
      [new TaggedStrike('first', 4), new TaggedStrike('second', 7)],
    );

    world.tick();
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.damage).toBe(4);
  });

  it('E2: per-ability cooldown — sibling fires while a higher-scoring ability cools', () => {
    // Two abilities on one unit:
    //   slow — damage 11, score 10, cooldown 10, duration 1.
    //          Single-tick "execute" but can't be reused for 10 ticks.
    //   fast — damage 3,  score 9,  cooldown 1,  duration 1.
    //          Plinks every tick.
    // Tick 1: slow fires (its cd -> 10, duration 1 so unit is free
    // immediately next tick). Tick 2: slow's cd filter blocks it, fast
    // wins by default. Without per-ability cooldown isolation (both
    // keyed off AttackAction.id), tick 2 would skip fast too — pinning
    // the contract.
    const { world, attacks } = sceneWithAbilities(
      [
        { team: 'player', x: 0, y: 0, hp: 50 },
        { team: 'enemy', x: 1, y: 0, hp: 500, inert: true },
      ],
      [
        new ConfigurableStrike({ id: 'slow', score: 10, damage: 11, cooldown: 10, duration: 1 }),
        new ConfigurableStrike({ id: 'fast', score: 9, damage: 3, cooldown: 1, duration: 1 }),
      ],
    );

    world.tick(); // slow fires (damage 11)
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.damage).toBe(11);

    world.tick(); // slow cooling → fast fires (damage 3)
    expect(attacks).toHaveLength(2);
    expect(attacks[1]!.damage).toBe(3);

    world.tick(); // slow still cooling → fast fires again
    expect(attacks).toHaveLength(3);
    expect(attacks[2]!.damage).toBe(3);
  });
});

// ─── helpers ─────────────────────────────────────────────────────────────

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

function buildStats(s: SceneUnit, archetype: 'melee' | 'ranged'): UnitStats {
  const baseStats = ARCHETYPE_CONFIG[archetype].baseStats;
  return {
    ...baseStats,
    luck: 0,
    strength: s.attackDamage ?? baseStats.strength,
    ranged: s.attackDamage ?? baseStats.ranged,
  };
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
    const archetype = (s.attackRange ?? 1) > 1 ? 'ranged' : 'melee';
    const stats = buildStats(s, archetype);
    const template: UnitTemplate = { archetype, stats };
    const u = world.spawnUnit(template, s.team, { x: s.x, y: s.y });
    if (s.attackRange !== undefined || s.attackCooldownTicks !== undefined) {
      const mutDerived = u as unknown as { derived: { -readonly [K in keyof typeof u.derived]: number } };
      if (s.attackRange !== undefined) mutDerived.derived.attackRange = s.attackRange;
      if (s.attackCooldownTicks !== undefined) {
        mutDerived.derived.attackCooldownTicks = s.attackCooldownTicks;
      }
    }
    if (s.hp !== undefined) u.currentHp = s.hp;
    if (!s.inert) {
      u.behaviors.push(new AbilityBehavior());
      u.abilities.push(archetype === 'melee' ? new MeleeStrike() : new RangedShot());
    }
    return u;
  });
  return { world, units, attacks };
}

/**
 * E2 multi-ability scene: place units exactly as `scene` would, but
 * attach the caller-provided ability list onto the first unit. The
 * second unit is always the target. Used to pin AbilityBehavior's
 * scoring + per-ability cooldown contracts without relying on the
 * archetype config.
 */
function sceneWithAbilities(
  specs: SceneUnit[],
  abilities: Ability[],
): {
  world: World;
  units: Unit[];
  attacks: GameEvents['unit:attacked'][];
} {
  const result = scene(specs);
  const attacker = result.units[0]!;
  // Replace whatever scene() set up — synthetic abilities only.
  attacker.abilities.length = 0;
  for (const a of abilities) attacker.abilities.push(a);
  return result;
}

/** A synthetic ability that always proposes against any in-range enemy. */
class ConfigurableStrike implements Ability {
  readonly id: string;
  private readonly score: number;
  private readonly damage: number;
  private readonly cooldown: number;
  private readonly duration: number;
  constructor(opts: {
    id: string;
    score: number;
    damage: number;
    cooldown: number;
    /** Defaults to 1 — most of these synthetic tests want a single-tick
     *  action so the unit is free to re-propose next tick. The per-ability
     *  cooldown test uses cooldown > duration to keep the unit acting
     *  while the slow ability recharges. */
    duration?: number;
  }) {
    this.id = opts.id;
    this.score = opts.score;
    this.damage = opts.damage;
    this.cooldown = opts.cooldown;
    this.duration = opts.duration ?? 1;
  }
  propose(unit: Unit, world: World): ActionProposal | null {
    const target = world.units.find((u) => u.team !== unit.team && u.team !== 'neutral');
    if (!target) return null;
    return {
      action: new AttackAction(target, this.damage, 0),
      score: this.score,
      cooldown: this.cooldown,
      duration: this.duration,
      cooldownKey: this.id,
    };
  }
}

class LowScoreStrike extends ConfigurableStrike {
  constructor(damage: number) {
    super({ id: 'low', score: 5, damage, cooldown: 1 });
  }
}

class HighScoreStrike extends ConfigurableStrike {
  constructor(damage: number) {
    super({ id: 'high', score: 15, damage, cooldown: 1 });
  }
}

class TaggedStrike extends ConfigurableStrike {
  constructor(id: string, damage: number) {
    super({ id, score: 7, damage, cooldown: 1 });
  }
}
