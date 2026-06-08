import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { Unit, type UnitArchetype } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats } from '../stats';
import { STATS } from '../../config/stats';
import type { GameEvents } from '../../core/events';
import { GambitStrikeAction, GAMBIT_STRIKE_ACTION_ID } from './GambitStrikeAction';
import { createAction } from './registry';

/**
 * E7.A — GambitStrikeAction MECHANIC tests. Explicit literals (no
 * config-derived expectations) so the strike + reposition mechanic stays
 * pinned regardless of the shipped rogue balance. Mirrors the
 * AttackAction.test.ts split: mechanic/primitive tests use explicit
 * inputs and never read the shipped archetype JSON.
 */

function makeScene(): {
  world: World;
  moves: GameEvents['unit:moved'][];
  hits: GameEvents['unit:attacked'][];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const moves: GameEvents['unit:moved'][] = [];
  const hits: GameEvents['unit:attacked'][] = [];
  bus.on('unit:moved', (p) => moves.push(p));
  bus.on('unit:attacked', (p) => hits.push(p));
  return { world, moves, hits };
}

function makeUnit(
  id: number,
  team: 'player' | 'enemy',
  pos: { x: number; y: number },
  archetype: UnitArchetype = 'melee',
): Unit {
  const stats = {
    constitution: 10, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0, precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
  };
  return new Unit({
    id, team, archetype, glyph: archetype === 'rogue' ? 'r' : 'M',
    stats, derived: deriveStats(stats, 1), position: pos,
  });
}

function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

describe('GambitStrikeAction — damage', () => {
  it('applies base damage with no crit', () => {
    const { world } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 6, y: 5 });
    target.currentHp = 100;
    world.units.push(rogue, target);
    new GambitStrikeAction(target, 5, 0, 1).start(rogue, world);
    expect(target.currentHp).toBe(95);
  });

  it('doubles damage on a crit (critChance = 1 always fires)', () => {
    const { world } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 6, y: 5 });
    target.currentHp = 100;
    world.units.push(rogue, target);
    new GambitStrikeAction(target, 5, 1, 1).start(rogue, world);
    expect(target.currentHp).toBe(100 - Math.round(5 * STATS.critMult));
  });

  it('rounds after the damage multiplier (shares AttackAction resolution)', () => {
    const { world } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 6, y: 5 });
    target.currentHp = 100;
    world.units.push(rogue, target);
    // base 5 × 0.5 = 2.5 → round-half-up → 3
    new GambitStrikeAction(target, 5, 0, 0.5).start(rogue, world);
    expect(target.currentHp).toBe(97);
  });
});

describe('GambitStrikeAction — reposition (F4: deferred to applyEffect)', () => {
  it('start lands the damage but does NOT move the rogue (reposition waits)', () => {
    const { world, moves, hits } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 6, y: 5 });
    target.currentHp = 100;
    world.units.push(rogue, target);

    new GambitStrikeAction(target, 5, 0, 1).start(rogue, world);

    // Strike resolved at offset 0...
    expect(hits).toHaveLength(1);
    expect(target.currentHp).toBe(95);
    // ...but the rogue is still adjacent — the dart-back is deferred.
    expect(rogue.position).toEqual({ x: 5, y: 5 });
    expect(moves).toHaveLength(0);
  });

  it('applyEffect steps away from the struck cell, increasing Chebyshev distance', () => {
    const { world, moves } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 6, y: 5 });
    target.currentHp = 100;
    world.units.push(rogue, target);

    const action = new GambitStrikeAction(target, 5, 0, 1);
    action.start(rogue, world);
    action.applyEffect(rogue, world, 5, 'impact');

    expect(chebyshev(rogue.position, target.position)).toBe(2);
    expect(rogue.position).not.toEqual({ x: 5, y: 5 });
    expect(moves).toHaveLength(1);
    expect(moves[0]!.from).toEqual({ x: 5, y: 5 });
    expect(moves[0]!.to).toEqual(rogue.position);
  });

  it('retreats from the cell struck even if the target died during the windup', () => {
    const { world, moves } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 6, y: 5 });
    target.currentHp = 100;
    world.units.push(rogue, target);

    const action = new GambitStrikeAction(target, 5, 0, 1);
    action.start(rogue, world);
    // Target dies (e.g. an ally finished it) and is removed before impact.
    world.units.splice(world.units.indexOf(target), 1);
    action.applyEffect(rogue, world, 5, 'impact');

    // struckFrom (captured at cast) still anchors the dart-back away from (6,5).
    expect(rogue.position.x).toBeLessThan(5);
    expect(moves).toHaveLength(1);
    expect(moves[0]!.from).toEqual({ x: 5, y: 5 });
  });

  it('holds position in a corner where no neighbor increases distance', () => {
    const { world, moves, hits } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 0, y: 0 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 1, y: 1 });
    target.currentHp = 100;
    world.units.push(rogue, target);

    const action = new GambitStrikeAction(target, 5, 0, 1);
    action.start(rogue, world);
    action.applyEffect(rogue, world, 5, 'impact');

    expect(rogue.position).toEqual({ x: 0, y: 0 });
    expect(moves).toHaveLength(0);
    // Damage still lands — the reposition is a bonus, not a precondition.
    expect(hits).toHaveLength(1);
    expect(target.currentHp).toBe(95);
  });

  it('holds when every distance-increasing cell is occupied', () => {
    const { world, moves } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 6, y: 5 });
    target.currentHp = 100;
    // The only neighbors of (5,5) farther from (6,5) are the x=4 column.
    const blockers = [
      makeUnit(3, 'player', { x: 4, y: 4 }),
      makeUnit(4, 'player', { x: 4, y: 5 }),
      makeUnit(5, 'player', { x: 4, y: 6 }),
    ];
    world.units.push(rogue, target, ...blockers);

    const action = new GambitStrikeAction(target, 5, 0, 1);
    action.start(rogue, world);
    action.applyEffect(rogue, world, 5, 'impact');

    expect(rogue.position).toEqual({ x: 5, y: 5 });
    expect(moves).toHaveLength(0);
  });

  it('lerps the dart over the remaining busy window, not a full move cooldown', () => {
    const { world, moves } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 6, y: 5 });
    target.currentHp = 100;
    world.units.push(rogue, target);

    const action = new GambitStrikeAction(target, 5, 0, 1);
    // Mid-gambit: the action is the unit's activeAction with R ticks of recovery
    // left at impact. A fresh world's currentTick is 0, so finishTick === R makes
    // (finishTick - currentTick) === R — the remaining busy window.
    const R = 6;
    rogue.activeAction = {
      action,
      startTick: 0,
      finishTick: R,
      phases: [
        { phase: 'windup', ticks: 0 },
        { phase: 'impact', ticks: 0 },
        { phase: 'recovery', ticks: R },
      ],
    };
    // The cap matters only because the window is SHORTER than a full move
    // cooldown — that's the cut-off bug this guards.
    expect(rogue.derived.moveCooldownTicks).toBeGreaterThan(R);

    action.start(rogue, world);
    action.applyEffect(rogue, world, 0, 'impact');

    expect(moves).toHaveLength(1);
    expect(moves[0]!.durationTicks).toBe(R);
  });

  it('falls back to the move cooldown when there is no activeAction', () => {
    const { world, moves } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 6, y: 5 });
    target.currentHp = 100;
    world.units.push(rogue, target);

    const action = new GambitStrikeAction(target, 5, 0, 1);
    action.start(rogue, world);
    action.applyEffect(rogue, world, 5, 'impact');

    expect(moves).toHaveLength(1);
    expect(moves[0]!.durationTicks).toBe(rogue.derived.moveCooldownTicks);
  });
});

describe('GambitStrikeAction — serialization', () => {
  it('round-trips damage + struckFrom; the deferred reposition resolves after rehydrate', () => {
    const { world, moves } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 6, y: 5 });
    target.currentHp = 100;
    world.units.push(rogue, target);

    const data = new GambitStrikeAction(target, 7, 0, 1).toData() as {
      struckFrom?: { x: number; y: number };
    };
    // struckFrom is captured at cast (the target's cell) and serialized so a
    // snapshot taken mid-windup still knows where to dart back from.
    expect(data.struckFrom).toEqual({ x: 6, y: 5 });

    const rehydrated = createAction(GAMBIT_STRIKE_ACTION_ID, data, world);
    rehydrated.start(rogue, world);
    expect(target.currentHp).toBe(93);
    // The reposition survives the round-trip (struckFrom drives applyEffect).
    rehydrated.applyEffect!(rogue, world, 5, 'impact');
    expect(chebyshev(rogue.position, { x: 6, y: 5 })).toBe(2);
    expect(moves).toHaveLength(1);
  });
});
