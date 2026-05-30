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
    constitution: 10, strength: 0, ranged: 0, magic: 0, luck: 0, speed: 0, endurance: 0,
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

describe('GambitStrikeAction — reposition', () => {
  it('steps away from the struck target, increasing Chebyshev distance', () => {
    const { world, moves } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 6, y: 5 });
    target.currentHp = 100;
    world.units.push(rogue, target);

    new GambitStrikeAction(target, 5, 0, 1).start(rogue, world);

    expect(chebyshev(rogue.position, target.position)).toBe(2);
    expect(rogue.position).not.toEqual({ x: 5, y: 5 });
    expect(moves).toHaveLength(1);
    expect(moves[0]!.from).toEqual({ x: 5, y: 5 });
    expect(moves[0]!.to).toEqual(rogue.position);
  });

  it('holds position in a corner where no neighbor increases distance', () => {
    const { world, moves, hits } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 0, y: 0 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 1, y: 1 });
    target.currentHp = 100;
    world.units.push(rogue, target);

    new GambitStrikeAction(target, 5, 0, 1).start(rogue, world);

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

    new GambitStrikeAction(target, 5, 0, 1).start(rogue, world);

    expect(rogue.position).toEqual({ x: 5, y: 5 });
    expect(moves).toHaveLength(0);
  });
});

describe('GambitStrikeAction — serialization', () => {
  it('round-trips through the action registry', () => {
    const { world } = makeScene();
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, 'rogue');
    const target = makeUnit(2, 'enemy', { x: 6, y: 5 });
    target.currentHp = 100;
    world.units.push(rogue, target);

    const data = new GambitStrikeAction(target, 7, 0, 1).toData();
    const rehydrated = createAction(GAMBIT_STRIKE_ACTION_ID, data, world);
    rehydrated.start(rogue, world);
    expect(target.currentHp).toBe(93);
  });
});
