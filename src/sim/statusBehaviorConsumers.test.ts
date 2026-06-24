import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { ARCHETYPE_CONFIG } from './archetypes';
import { createAbility } from './abilities/registry';
import { MovementBehavior } from './behaviors/MovementBehavior';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { updateTarget } from './Targeting';
import type { StatusEffect } from './statusEffects';
import type { Unit, UnitArchetype, Team } from './Unit';
import type { GameEvents } from '../core/events';

/**
 * §28 — the behavior-axis DECISION-HOOKS read by the existing consumers
 * (`AbilityBehavior` / `MovementBehavior` / `Targeting`). These exercise the
 * REAL shipped status defs (frozen/panic/blind/confusion) end-to-end through
 * `World.tick` + the behaviors, proving each flag changes what its consumer
 * proposes. The status *content* (durations/ranges) is pinned in
 * `config/statuses.test.ts`; here we assert BEHAVIOR (rooted / flees / wanders /
 * friendly-fires), so reading the live defs is the integration point, not a
 * hardcoded balance number.
 */

const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** A held (never-expiring) behavior status by its shipped `key`. */
function status(key: string): StatusEffect {
  return { key, magnitude: 1, mods: {}, lifetime: { kind: 'endOfTurn' }, merge: 'replace' };
}

interface Spec {
  archetype: UnitArchetype;
  team: Team;
  x: number;
  y: number;
  hp?: number;
  /** Attach MovementBehavior + AbilityBehavior + the archetype's ability. */
  combat?: boolean;
  ability?: string;
  /** Override the move cooldown (default left to deriveStats) for fast tests. */
  moveCd?: number;
}

function build(specs: Spec[], seed = 1) {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(seed));
  const attacks: GameEvents['unit:attacked'][] = [];
  const moves: GameEvents['unit:moved'][] = [];
  bus.on('unit:attacked', (p) => attacks.push(p));
  bus.on('unit:moved', (p) => moves.push(p));

  const units = specs.map((s) => {
    const stats = { ...ARCHETYPE_CONFIG[s.archetype].baseStats, luck: 0 };
    const u = world.spawnUnit({ archetype: s.archetype, level: 1, stats, xp: 0 }, s.team, {
      x: s.x,
      y: s.y,
    });
    if (s.hp !== undefined) u.currentHp = s.hp;
    if (s.moveCd !== undefined) {
      (u as unknown as { derived: { moveCooldownTicks: number } }).derived.moveCooldownTicks = s.moveCd;
    }
    if (s.combat) {
      u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
      u.abilities.push(createAbility(s.ability ?? 'sword'));
    }
    return u;
  });
  return { world, units, attacks, moves };
}

describe('28 — frozen', () => {
  it('a frozen unit proposes nothing (no attack on an adjacent foe, no move)', () => {
    const { world, units, attacks, moves } = build([
      { archetype: 'mercenary', team: 'player', x: 5, y: 5, combat: true, moveCd: 1 },
      { archetype: 'mercenary', team: 'enemy', x: 6, y: 5, hp: 100 },
    ]);
    const [p, e] = units as [Unit, Unit];
    p.addEffect(status('frozen'));

    for (let i = 0; i < 8; i++) world.tick();

    expect(attacks).toHaveLength(0); // preventsAttack
    expect(moves).toHaveLength(0); // preventsMove
    expect(p.position).toEqual({ x: 5, y: 5 });
    expect(e.currentHp).toBe(100);
  });

  it('the SAME unit attacks the adjacent foe once unfrozen (control)', () => {
    const { world, units, attacks } = build([
      { archetype: 'mercenary', team: 'player', x: 5, y: 5, combat: true, moveCd: 1 },
      { archetype: 'mercenary', team: 'enemy', x: 6, y: 5, hp: 100 },
    ]);
    for (let i = 0; i < 4; i++) world.tick();
    expect(attacks.length).toBeGreaterThan(0);
    expect((units[1] as Unit).currentHp).toBeLessThan(100);
  });

  it('a frozen unit does not even approach a distant foe', () => {
    const { world, units, moves } = build([
      { archetype: 'mercenary', team: 'player', x: 0, y: 5, combat: true, moveCd: 1 },
      { archetype: 'mercenary', team: 'enemy', x: 11, y: 5, hp: 100 },
    ]);
    (units[0] as Unit).addEffect(status('frozen'));
    for (let i = 0; i < 8; i++) world.tick();
    expect(moves).toHaveLength(0);
    expect((units[0] as Unit).position).toEqual({ x: 0, y: 5 });
  });
});

describe('28 — panic', () => {
  it('a panicked unit does not attack and FLEES the nearest enemy', () => {
    const { world, units, attacks } = build([
      { archetype: 'mercenary', team: 'player', x: 5, y: 5, combat: true, moveCd: 1 },
      { archetype: 'mercenary', team: 'enemy', x: 6, y: 5, hp: 100 },
    ]);
    const [p, e] = units as [Unit, Unit];
    p.addEffect(status('panic'));
    const startDist = cheb(p.position, e.position); // 1

    for (let i = 0; i < 6; i++) world.tick();

    expect(attacks).toHaveLength(0); // preventsAttack
    expect(e.currentHp).toBe(100);
    expect(cheb(p.position, e.position)).toBeGreaterThan(startDist); // fled
  });

  it('a panicked unit with no enemy proposes no flee (nothing to flee)', () => {
    const { world, units } = build([
      { archetype: 'mercenary', team: 'player', x: 5, y: 5, combat: true },
    ]);
    (units[0] as Unit).addEffect(status('panic'));
    expect(new MovementBehavior().proposeAction(units[0] as Unit, world)).toBeNull();
  });
});

describe('28 — blind', () => {
  it('strikes an ADJACENT enemy (acquisition reach 1 still reaches it)', () => {
    const { world, units, attacks } = build([
      { archetype: 'mercenary', team: 'player', x: 5, y: 5, combat: true, moveCd: 1 },
      { archetype: 'mercenary', team: 'enemy', x: 6, y: 5, hp: 100 },
    ]);
    (units[0] as Unit).addEffect(status('blind'));
    for (let i = 0; i < 4; i++) world.tick();
    expect(attacks.length).toBeGreaterThan(0); // blind does NOT prevent attack
    expect((units[1] as Unit).currentHp).toBeLessThan(100);
  });

  it('does NOT acquire a distant enemy — wanders instead (targetId stays null)', () => {
    const { world, units, attacks, moves } = build([
      { archetype: 'mercenary', team: 'player', x: 5, y: 5, combat: true, moveCd: 1 },
      { archetype: 'mercenary', team: 'enemy', x: 11, y: 5, hp: 100 },
    ]);
    const [p, e] = units as [Unit, Unit];
    p.addEffect(status('blind'));
    for (let i = 0; i < 8; i++) world.tick();
    expect(p.targetId).toBeNull(); // capped acquisition never marks the far foe
    expect(attacks).toHaveLength(0);
    expect(e.currentHp).toBe(100);
    expect(moves.length).toBeGreaterThan(0); // it wandered
  });

  it('the friend/foe filter survives blind — never strikes an adjacent ALLY', () => {
    const { world, units, attacks } = build([
      { archetype: 'mercenary', team: 'player', x: 5, y: 5, combat: true, moveCd: 1 },
      { archetype: 'mercenary', team: 'player', x: 6, y: 5, hp: 100 }, // adjacent ally
      { archetype: 'mercenary', team: 'enemy', x: 11, y: 11, hp: 100 }, // keeps the battle live
    ]);
    (units[0] as Unit).addEffect(status('blind'));
    for (let i = 0; i < 8; i++) world.tick();
    expect(attacks).toHaveLength(0); // blind acquires ENEMIES only — the ally is safe
    expect((units[1] as Unit).currentHp).toBe(100);
  });
});

describe('28 — confusion (targeting)', () => {
  // A confused unit picks a RANDOM living non-neutral unit of any team within
  // the confusion radius. These call `updateTarget` directly (the once-per-tick
  // targeting authority) for a clean, tick-free read of the mark.
  function confusedScene(seed: number) {
    const { world, units } = build(
      [
        { archetype: 'mercenary', team: 'player', x: 5, y: 5, combat: true },
        { archetype: 'mercenary', team: 'player', x: 6, y: 5 }, // ally, in range
        { archetype: 'mercenary', team: 'enemy', x: 4, y: 5 }, // enemy, in range
      ],
      seed,
    );
    (units[0] as Unit).addEffect(status('confusion'));
    return { world, units };
  }

  it('marks a unit of EITHER team (friendly-fire) across seeds, deterministically', () => {
    const picks = new Set<number>();
    let allyId = -1;
    let enemyId = -1;
    for (let seed = 0; seed < 24; seed++) {
      const { world, units } = confusedScene(seed);
      allyId = units[1]!.id;
      enemyId = units[2]!.id;
      updateTarget(units[0] as Unit, world);
      const id = (units[0] as Unit).targetId;
      expect(id === allyId || id === enemyId).toBe(true); // ally OR enemy
      if (id !== null) picks.add(id);
    }
    // Over the seed sweep both the ally and the enemy get marked at least once.
    expect(picks.has(allyId)).toBe(true);
    expect(picks.has(enemyId)).toBe(true);
  });

  it('is deterministic — the same seed marks the same unit', () => {
    const a = confusedScene(7);
    const b = confusedScene(7);
    updateTarget(a.units[0] as Unit, a.world);
    updateTarget(b.units[0] as Unit, b.world);
    expect((a.units[0] as Unit).targetId).toBe((b.units[0] as Unit).targetId);
  });

  it('an only-ally-in-range confused melee strikes its own ally', () => {
    const { world, units, attacks } = build([
      { archetype: 'mercenary', team: 'player', x: 5, y: 5, combat: true, moveCd: 1 },
      { archetype: 'mercenary', team: 'player', x: 6, y: 5, hp: 100 }, // the only candidate
      { archetype: 'mercenary', team: 'enemy', x: 11, y: 11, hp: 100 }, // far — out of radius, keeps battle live
    ]);
    (units[0] as Unit).addEffect(status('confusion'));
    for (let i = 0; i < 6; i++) world.tick();
    expect(attacks.length).toBeGreaterThan(0);
    expect(attacks.every((a) => a.targetId === units[1]!.id)).toBe(true); // hit the ally
    expect((units[1] as Unit).currentHp).toBeLessThan(100);
  });
});

describe('28 — confusion (AoE friendly-fire)', () => {
  // A confused mage forces `affects:'all'`, so its blast hits allies in the
  // radius too. The control proves a SANE mage spares its own team.
  function mageScene(confused: boolean) {
    const { world, units } = build([
      // mage stationary (AbilityBehavior only) so it just blasts whatever it marks.
      { archetype: 'mage', team: 'player', x: 5, y: 5, ability: 'magic_bolt' },
      { archetype: 'mage', team: 'player', x: 5, y: 9, hp: 100 }, // ally A (blast-radius of E)
      { archetype: 'mercenary', team: 'enemy', x: 6, y: 9, hp: 300 }, // enemy E (in mage band)
    ]);
    const mage = units[0] as Unit;
    mage.behaviors.push(new AbilityBehavior());
    mage.abilities.push(createAbility('magic_bolt'));
    if (confused) mage.addEffect(status('confusion'));
    return { world, units };
  }

  it('a confused mage damages its own ally (affects forced to all)', () => {
    const { world, units } = mageScene(true);
    for (let i = 0; i < 80; i++) world.tick();
    expect((units[1] as Unit).currentHp).toBeLessThan(100); // ally got caught in the blast
  });

  it('a SANE mage never damages its ally in the same blast (control)', () => {
    const { world, units } = mageScene(false);
    for (let i = 0; i < 80; i++) world.tick();
    expect((units[1] as Unit).currentHp).toBe(100); // affects:'enemies' spares the ally
  });
});
