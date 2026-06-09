import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { Unit, type Team, type UnitStats } from '../Unit';
import { MovementBehavior } from './MovementBehavior';
import { AbilityBehavior } from './AbilityBehavior';
import { MeleeStrike } from '../abilities/strikes';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats, attackCooldownTicksFor } from '../stats';
import { ARCHETYPE_CONFIG } from '../archetypes';
import { ABILITIES } from '../../config/abilities';
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
    // I6 — the sword adds its `might` on top of the scaling stat (set to
    // attackDamage), so the strike lands `might + 5`. Derive from config so a
    // weapon re-tune can't break this cooldown-timing wiring test.
    expect(units[1]!.currentHp).toBe(50 - (ABILITIES.sword!.might + 5));
  });

  it('attacks immediately if already in range on tick 1', () => {
    const { world, attacks } = scene([
      {
        team: 'player',
        x: 5,
        y: 5,
        attackRange: 1,
        attackDamage: 3,
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
    // movement out until the attack cooldown elapses. attackCD is the
    // real sword cadence (config-derived) — the scene builds a mercenary at
    // the archetype's base speed, so this matches what MeleeStrike actually
    // proposes; deriving it keeps the test pinned through any cadence re-tune.
    const attackCD = attackCooldownTicksFor(
      ABILITIES.sword!.cooldownSeconds,
      ARCHETYPE_CONFIG.mercenary.baseStats.speed,
    );
    const { world, units, moves } = scene([
      {
        team: 'player',
        x: 5,
        y: 5,
        attackRange: 1,
        attackDamage: 999, // one-shot the adjacent enemy
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
    // E1: melee baseline + luck=0 (deterministic crit roll = always
    // false) + `strength` = test-knob attackDamage so the existing
    // exact-damage assertions hold.
    const baseStats = ARCHETYPE_CONFIG.mercenary.baseStats;
    const stats: UnitStats = {
      ...baseStats,
      luck: 0,
      // GP2 — cadence/shared-cooldown mechanic test; keep the target
      // defense-free so the new subtractive mitigation doesn't perturb the
      // explicit `attackDamage` assertions (baseStats now carries defense 4).
      defense: 0,
      strength: s.attackDamage ?? baseStats.strength,
    };
    const range = s.attackRange ?? 1;
    let derived = deriveStats(stats, range);
    if (s.moveCooldownTicks !== undefined) {
      derived = { ...derived, moveCooldownTicks: s.moveCooldownTicks };
    }
    const u = new Unit({
      id: nextId++,
      team: s.team,
      archetype: 'mercenary',
      glyph: 'M',
      stats,
      derived,
      position: { x: s.x, y: s.y },
    });
    if (s.hp !== undefined) u.currentHp = s.hp;
    if (s.behaviors === 'all') {
      u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
      u.abilities.push(new MeleeStrike('sword'));
    }
    world.units.push(u);
    return u;
  });
  return { world, units, moves, attacks };
}
