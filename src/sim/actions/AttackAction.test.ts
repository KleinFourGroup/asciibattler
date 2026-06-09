import { describe, it, expect } from 'vitest';
import { AttackAction } from './AttackAction';
import { World } from '../World';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { UnitStats, UnitTemplate } from '../Unit';
import type { GameEvents } from '../../core/events';
import { STATS } from '../../config/stats';

/**
 * Mechanic-level pins for AttackAction's damage resolution. These use
 * EXPLICIT inputs (baseDamage, critChance, damageMultiplier passed to the
 * constructor) and never read a balance-tuning JSON, so re-tuning any
 * config value can't break them. They pin the *primitive* — that a
 * multiplier < 1 attenuates damage, that crit + multiplier stack, that
 * the multiplier defaults to 1. The *wiring* of the half-cover knob into
 * this primitive lives in AbilityBehavior.test.ts and derives its
 * expectation from `LEVELING.halfCoverDamageMult`.
 */

// constitution → maxHp at hpPerConstitution=1.0; set high so the target
// survives the hit and we can read the post-damage HP directly.
const STATS_BLOCK: UnitStats = {
  constitution: 100,
  strength: 0,
  ranged: 0,
  magic: 0,
  luck: 0,
  defense: 0,
  // I2 — AttackAction is now `evadable`, so every `start()` rolls to-hit. These
  // pins are about DAMAGE resolution (multiplier/crit/rounding), not dodge, so
  // max precision parks the hit chance at the cap (always lands) and isolates
  // them from the roll. The to-hit roll itself is pinned in World.applyDamage's
  // I2 tests + the hitChanceFor balance-proofs.
  precision: 100,
  evasion: 0,
  speed: 0,
  mobility: 0,
  power: 1,
};

function twoUnits(): {
  world: World;
  attacker: ReturnType<World['spawnUnit']>;
  target: ReturnType<World['spawnUnit']>;
  attacks: GameEvents['unit:attacked'][];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const attacks: GameEvents['unit:attacked'][] = [];
  bus.on('unit:attacked', (p) => attacks.push(p));
  const tmpl: UnitTemplate = { archetype: 'mercenary', level: 1, stats: STATS_BLOCK, xp: 0 };
  const attacker = world.spawnUnit(tmpl, 'player', { x: 0, y: 0 });
  const target = world.spawnUnit(tmpl, 'enemy', { x: 1, y: 0 });
  return { world, attacker, target, attacks };
}

describe('AttackAction damage resolution', () => {
  it('applies an explicit damageMultiplier < 1 (no crit)', () => {
    const { world, attacker, target, attacks } = twoUnits();
    const hpBefore = target.currentHp;
    // critChance 0 → the combatRng draw never produces a crit, so the
    // result is purely round(baseDamage × multiplier), config-free.
    new AttackAction(target, 10, 0, 0.5).start(attacker, world);
    expect(attacks[0]!.damage).toBe(5); // round(10 × 0.5)
    expect(attacks[0]!.crit).toBe(false);
    expect(target.currentHp).toBe(hpBefore - 5);
  });

  it('defaults the multiplier to 1 when the constructor omits it', () => {
    const { world, attacker, target, attacks } = twoUnits();
    new AttackAction(target, 7, 0).start(attacker, world);
    expect(attacks[0]!.damage).toBe(7);
  });

  it('stacks crit and multiplier in a single round (round(base × critMult × mult))', () => {
    const { world, attacker, target, attacks } = twoUnits();
    // critChance 1 → the draw (always < 1) is always a crit.
    new AttackAction(target, 10, 1, 0.5).start(attacker, world);
    expect(attacks[0]!.crit).toBe(true);
    expect(attacks[0]!.damage).toBe(Math.round(10 * STATS.critMult * 0.5));
  });

  it('rounds the combined product, not each factor', () => {
    const { world, attacker, target, attacks } = twoUnits();
    // 5 × 0.5 = 2.5 → rounds to 3 (round-half-up), proving the round
    // happens once on the product rather than truncating mid-way.
    new AttackAction(target, 5, 0, 0.5).start(attacker, world);
    expect(attacks[0]!.damage).toBe(3);
  });
});
