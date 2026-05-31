import { describe, it, expect } from 'vitest';
import { MagicBolt } from './magic';
import { MagicBoltAction } from '../actions/MagicBoltAction';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats, inertDerived, magicBoltDamage, attackCooldownTicksFor } from '../stats';
import { abilityConfig } from '../../config/abilities';
import { rangeForArchetype } from '../archetypes';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';

/**
 * E7.C — `magic_bolt` PROPOSE-path tests (the wiring layer). Range, cadence,
 * and AoE-shape expectations derive from `config/abilities.json` via
 * `abilityConfig`, per the project convention that wiring tests read the
 * shipped config while mechanic tests (MagicBoltAction.test.ts) use explicit
 * inputs.
 */

const BOLT = abilityConfig('magic_bolt');
const BOLT_RANGE = BOLT.range;

const MAGE_STATS: UnitStats = {
  constitution: 16, strength: 0, ranged: 0, magic: 10, luck: 3, speed: 4, endurance: 4,
};

function makeUnit(
  id: number,
  team: Team,
  pos: GridCoord,
  opts: { archetype?: UnitArchetype; stats?: UnitStats; range?: number; blocksLos?: boolean } = {},
): Unit {
  const archetype = opts.archetype ?? 'melee';
  const isEnv = archetype === 'environment';
  const stats = opts.stats ?? MAGE_STATS;
  const derived = isEnv ? inertDerived(1) : deriveStats(stats, opts.range ?? 1);
  return new Unit({
    id, team, archetype,
    glyph: archetype === 'mage' ? 'm' : archetype === 'environment' ? '#' : 'M',
    stats, derived, position: pos,
    ...(opts.blocksLos !== undefined ? { blocksLineOfSight: opts.blocksLos } : {}),
  });
}

function makeMage(pos: GridCoord): Unit {
  return makeUnit(1, 'player', pos, {
    archetype: 'mage',
    stats: MAGE_STATS,
    range: rangeForArchetype('mage'),
  });
}

function world(units: Unit[]): World {
  const w = new World(new EventBus<GameEvents>(), new RNG(1));
  w.units.push(...units);
  return w;
}

function dataOf(action: { toData(): unknown }): ReturnType<MagicBoltAction['toData']> {
  return action.toData() as ReturnType<MagicBoltAction['toData']>;
}

describe('MagicBolt.propose', () => {
  it('proposes a charged AoE: score 10, keyed on magic_bolt, multi-tick with effect at the end', () => {
    const mage = makeMage({ x: 5, y: 5 });
    const enemy = makeUnit(2, 'enemy', { x: 5, y: 7 }); // dist 2, in range
    const proposal = new MagicBolt().propose(mage, world([mage, enemy]));

    expect(proposal).not.toBeNull();
    expect(proposal!.score).toBe(10);
    expect(proposal!.cooldownKey).toBe('magic_bolt');

    const expected = attackCooldownTicksFor(BOLT.cooldownSeconds, MAGE_STATS.speed);
    expect(proposal!.cooldown).toBe(expected);
    // F2 — charge for the whole window, detonate at impact. Σ ticks ==
    // expected (the busy window); the blast lands at offset `expected` —
    // the multi-tick signature that exercises applyEffect + the progress bar.
    expect(proposal!.phases).toEqual([
      { phase: 'windup', ticks: expected },
      { phase: 'impact', ticks: 0 },
    ]);
    expect(expected).toBeGreaterThan(1); // it's a genuine charge, not single-tick
  });

  it('ground-targets the enemy cell at cast time + scales damage on magic', () => {
    const mage = makeMage({ x: 5, y: 5 });
    const enemy = makeUnit(2, 'enemy', { x: 6, y: 6 });
    const proposal = new MagicBolt().propose(mage, world([mage, enemy]));
    const data = dataOf(proposal!.action);

    expect(data.center).toEqual({ x: 6, y: 6 }); // the target's cell, frozen
    expect(data.baseDamage).toBe(magicBoltDamage(mage));
    expect(data.baseDamage).toBe(MAGE_STATS.magic);
    expect(data.radius).toBe(BOLT.aoe!.radius);
    expect(data.ringMultiplier).toBe(BOLT.aoe!.ringMultiplier);
  });

  it('abstains when the only enemy is out of range', () => {
    const mage = makeMage({ x: 0, y: 0 });
    const enemy = makeUnit(2, 'enemy', { x: BOLT_RANGE + 1, y: 0 });
    expect(new MagicBolt().propose(mage, world([mage, enemy]))).toBeNull();
  });

  it('abstains when a wall breaks line of sight to the target', () => {
    const mage = makeMage({ x: 0, y: 0 });
    const enemy = makeUnit(2, 'enemy', { x: 4, y: 0 }); // in range (<=5)
    const wall = makeUnit(3, 'neutral', { x: 2, y: 0 }, { archetype: 'environment' });
    expect(new MagicBolt().propose(mage, world([mage, enemy, wall]))).toBeNull();
  });

  it('fires THROUGH half-cover (LOS-transparent neutral does not block the cast)', () => {
    const mage = makeMage({ x: 0, y: 0 });
    const enemy = makeUnit(2, 'enemy', { x: 4, y: 0 });
    const halfCover = makeUnit(3, 'neutral', { x: 2, y: 0 }, {
      archetype: 'environment',
      blocksLos: false,
    });
    expect(new MagicBolt().propose(mage, world([mage, enemy, halfCover]))).not.toBeNull();
  });

  it('abstains when there is no enemy at all', () => {
    const mage = makeMage({ x: 5, y: 5 });
    const ally = makeUnit(2, 'player', { x: 5, y: 6 });
    expect(new MagicBolt().propose(mage, world([mage, ally]))).toBeNull();
  });
});
