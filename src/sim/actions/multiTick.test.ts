import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { Unit, type Behavior } from '../Unit';
import type { Action, ActionProposal } from '../Action';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats } from '../stats';
import { ARCHETYPE_CONFIG } from '../archetypes';
import type { GameEvents } from '../../core/events';

/**
 * Fixture exercising the multi-tick portion of the A1 action machinery:
 * an action whose damage lands at an effect tick *between* start and
 * finish, with a cooldown that gates re-proposal independently of the
 * duration lockout.
 *
 * Charge-up attack contract:
 *   - duration N: unit is busy for N ticks after start.
 *   - effectTicks [k]: damage applies at tick start+k (0 < k < N).
 *   - cooldown M >= duration: the action can't be re-proposed until M
 *     ticks have elapsed from start, so a long-cooldown high-damage
 *     skill can't fire back-to-back even after the unit is free.
 */
class ChargeAttackAction implements Action {
  readonly id = 'charge-attack';

  constructor(
    private readonly target: Unit,
    private readonly damage: number,
  ) {}

  start(_unit: Unit, _world: World): void {
    // No immediate effect — the punch lands during applyEffect.
  }

  applyEffect(unit: Unit, world: World, _tickOffset: number): void {
    if (this.target.currentHp <= 0) return;
    this.target.currentHp -= this.damage;
    world.emit('unit:attacked', {
      attackerId: unit.id,
      targetId: this.target.id,
      damage: this.damage,
      crit: false,
    });
  }

  toData(): { targetId: number; damage: number } {
    return { targetId: this.target.id, damage: this.damage };
  }
}

interface ChargeAttackOpts {
  readonly damage: number;
  readonly cooldown: number;
  readonly duration: number;
  readonly effectAt: number;
}

class ChargeAttackBehavior implements Behavior {
  readonly kind = 'charge-attack';

  constructor(private readonly opts: ChargeAttackOpts) {}

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    const target = world.units.find((u) => u.team !== unit.team && u.currentHp > 0);
    if (!target) return null;
    return {
      action: new ChargeAttackAction(target, this.opts.damage),
      score: 100,
      cooldown: this.opts.cooldown,
      // F2 — windup until the effect tick, impact there (applyEffect lands
      // the hit), recovery for the rest of the busy window. Σ ticks ==
      // duration; impact offset == effectAt (pre-F2 `effectTicks:[effectAt]`).
      phases: [
        { phase: 'windup', ticks: this.opts.effectAt },
        { phase: 'impact', ticks: 0 },
        { phase: 'recovery', ticks: this.opts.duration - this.opts.effectAt },
      ],
    };
  }
}

describe('multi-tick action machinery', () => {
  it('fires applyEffect at the listed offset, not at start or finish', () => {
    const { world, attacks, target } = scene({
      damage: 20,
      cooldown: 10,
      duration: 10,
      effectAt: 5,
    });

    // Tick 1: action starts. No damage yet.
    world.tick();
    expect(attacks).toHaveLength(0);
    expect(target.currentHp).toBe(100);

    // Ticks 2..5: still charging, no damage.
    for (let i = 2; i <= 5; i++) {
      world.tick();
      expect(attacks).toHaveLength(0);
    }

    // Tick 6 (offset 5): damage lands.
    world.tick();
    expect(attacks).toHaveLength(1);
    expect(target.currentHp).toBe(80);

    // Ticks 7..10: still in duration window, no more damage.
    for (let i = 7; i <= 10; i++) {
      world.tick();
      expect(attacks).toHaveLength(1);
    }
  });

  it('locks the unit out of new actions for the full duration', () => {
    const { world, attacks } = scene({
      damage: 20,
      cooldown: 10,
      duration: 10,
      effectAt: 5,
    });

    // Tick 1: action starts. Tick 6: damage. Tick 11: free again.
    for (let i = 1; i <= 10; i++) world.tick();
    expect(attacks).toHaveLength(1);

    // Tick 11: action finishes, selector re-runs, new charge starts.
    world.tick();
    expect(attacks).toHaveLength(1); // still charging again
    // Tick 16: second damage.
    for (let i = 12; i <= 16; i++) world.tick();
    expect(attacks).toHaveLength(2);
  });

  it('keeps the action on cooldown for `cooldown` ticks from start, independent of duration', () => {
    // Cooldown longer than duration: unit is free at finishTick but can't
    // re-propose charge-attack until the cooldown elapses too.
    const { world, attacks } = scene({
      damage: 20,
      cooldown: 20,
      duration: 10,
      effectAt: 5,
    });

    // Tick 1: charge starts. Tick 6: damage. Tick 11: action ends.
    for (let i = 1; i <= 11; i++) world.tick();
    expect(attacks).toHaveLength(1);

    // Ticks 12..20: cooldown still > 0; nothing fires.
    for (let i = 12; i <= 20; i++) world.tick();
    expect(attacks).toHaveLength(1);

    // Tick 21: cooldown clears; charge re-proposed; ticks 21..26 to next hit.
    world.tick();
    for (let i = 22; i <= 26; i++) world.tick();
    expect(attacks).toHaveLength(2);
  });
});

function scene(opts: ChargeAttackOpts): {
  world: World;
  attacker: Unit;
  target: Unit;
  attacks: GameEvents['unit:attacked'][];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const attacks: GameEvents['unit:attacked'][] = [];
  bus.on('unit:attacked', (p) => attacks.push(p));

  // E1: build a "100 HP" stat profile via constitution=100 → maxHp=100
  // (hpPerConstitution=1.0 post the 6244561 balance tweak; the earlier
  // 2.5 ratio used constitution=40 here for the same result). Cooldown=1
  // by overriding derived after construction so the agility-based scale
  // doesn't muddy the fixture.
  const stats = { ...ARCHETYPE_CONFIG.melee.baseStats, constitution: 100, luck: 0 };
  const derived = { ...deriveStats(stats, 99), moveCooldownTicks: 1 };

  const attacker = new Unit({
    id: 1,
    team: 'player',
    archetype: 'melee',
    glyph: 'M',
    stats,
    derived,
    position: { x: 0, y: 0 },
  });
  attacker.behaviors.push(new ChargeAttackBehavior(opts));
  world.units.push(attacker);

  const targetDerived = { ...deriveStats(stats, 1), moveCooldownTicks: 1 };
  const target = new Unit({
    id: 2,
    team: 'enemy',
    archetype: 'melee',
    glyph: 'M',
    stats,
    derived: targetDerived,
    position: { x: 5, y: 0 },
  });
  world.units.push(target);

  return { world, attacker, target, attacks };
}
