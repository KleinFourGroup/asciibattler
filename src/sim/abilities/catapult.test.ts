import { describe, it, expect } from 'vitest';
import { CatapultShot } from './catapult';
import { CatapultShotAction } from '../actions/CatapultShotAction';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats, inertDerived, catapultShotDamage, attackCooldownTicksFor } from '../stats';
import { abilityConfig } from '../../config/abilities';
import { secondsToTicks } from '../../config';
import { phasesBeginningAt, totalTicks } from '../Action';
import { rangeForArchetype } from '../archetypes';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';

/**
 * E7.D — `catapult_shot` PROPOSE-path tests (the wiring layer). Range and
 * cadence expectations derive from `config/abilities.json` via
 * `abilityConfig`, per the project convention that wiring tests read the
 * shipped config while mechanic tests (CatapultShotAction.test.ts) use
 * explicit inputs. The DEFINING test here is that it FIRES THROUGH a wall —
 * the arcing shot ignores line of sight, unlike the ranged strike / mage.
 */

const SHOT = abilityConfig('catapult_shot');
const SHOT_RANGE = SHOT.range;

const CATAPULT_STATS: UnitStats = {
  constitution: 24, strength: 0, ranged: 14, magic: 0, luck: 2, speed: 4, endurance: 4,
};

function makeUnit(
  id: number,
  team: Team,
  pos: GridCoord,
  opts: { archetype?: UnitArchetype; stats?: UnitStats; range?: number; blocksLos?: boolean } = {},
): Unit {
  const archetype = opts.archetype ?? 'melee';
  const isEnv = archetype === 'environment';
  const stats = opts.stats ?? CATAPULT_STATS;
  const derived = isEnv ? inertDerived(1) : deriveStats(stats, opts.range ?? 1);
  return new Unit({
    id, team, archetype,
    glyph: archetype === 'catapult' ? 'c' : archetype === 'environment' ? '#' : 'M',
    stats, derived, position: pos,
    ...(opts.blocksLos !== undefined ? { blocksLineOfSight: opts.blocksLos } : {}),
  });
}

function makeCatapult(pos: GridCoord): Unit {
  return makeUnit(1, 'player', pos, {
    archetype: 'catapult',
    stats: CATAPULT_STATS,
    range: rangeForArchetype('catapult'),
  });
}

function world(units: Unit[]): World {
  const w = new World(new EventBus<GameEvents>(), new RNG(1));
  w.units.push(...units);
  return w;
}

function dataOf(action: { toData(): unknown }): ReturnType<CatapultShotAction['toData']> {
  return action.toData() as ReturnType<CatapultShotAction['toData']>;
}

describe('CatapultShot.propose', () => {
  it('proposes a charged shot: score 10, keyed on catapult_shot, multi-tick with effect at the end', () => {
    const cat = makeCatapult({ x: 5, y: 5 });
    const enemy = makeUnit(2, 'enemy', { x: 5, y: 9 }); // dist 4, in range (<=6)
    const proposal = new CatapultShot().propose(cat, world([cat, enemy]));

    expect(proposal).not.toBeNull();
    expect(proposal!.score).toBe(10);
    expect(proposal!.cooldownKey).toBe('catapult_shot');

    const expected = attackCooldownTicksFor(SHOT.cooldownSeconds, CATAPULT_STATS.speed);
    expect(proposal!.cooldown).toBe(expected);
    // F3 — the wind-up is SPLIT: charge for `expected - travel`, loose
    // (`release`), let the boulder arc for `travel`, then land the hit at
    // `impact`. `travel` is carved OUT of the wind-up (derived from the
    // ability's travelSeconds), so the impact offset + busy window stay
    // `expected`. `release` is the renderer's launch cue.
    const travel = Math.min(secondsToTicks(SHOT.travelSeconds ?? 0), expected);
    expect(travel).toBeGreaterThan(0); // F3 carved a real travel window
    expect(proposal!.phases).toEqual([
      { phase: 'windup', ticks: expected - travel },
      { phase: 'release', ticks: 0 },
      { phase: 'travel', ticks: travel },
      { phase: 'impact', ticks: 0 },
    ]);
    expect(expected).toBeGreaterThan(1); // it's a genuine wind-up, not single-tick
  });

  it('F3 split is behavior-preserving: busy window unchanged, impact still at the end, release leads it by travel', () => {
    const cat = makeCatapult({ x: 5, y: 5 });
    const enemy = makeUnit(2, 'enemy', { x: 5, y: 9 });
    const proposal = new CatapultShot().propose(cat, world([cat, enemy]));

    const expected = attackCooldownTicksFor(SHOT.cooldownSeconds, CATAPULT_STATS.speed);
    const travel = Math.min(secondsToTicks(SHOT.travelSeconds ?? 0), expected);
    // Σ ticks is the busy window the unit is locked for — unchanged by the split.
    expect(totalTicks(proposal!.phases)).toBe(expected);
    // `release` + `travel` both begin at offset `expected - travel` (the
    // zero-length release shares the boundary with travel, in declared order).
    expect(phasesBeginningAt(proposal!.phases, expected - travel)).toEqual(['release', 'travel']);
    // The effect still lands at the very end — exactly where the pre-F3 impact fired.
    expect(phasesBeginningAt(proposal!.phases, expected)).toEqual(['impact']);
  });

  it('locks the live enemy target + scales damage on ranged', () => {
    const cat = makeCatapult({ x: 5, y: 5 });
    const enemy = makeUnit(2, 'enemy', { x: 6, y: 6 });
    const proposal = new CatapultShot().propose(cat, world([cat, enemy]));
    const data = dataOf(proposal!.action);

    expect(data.targetId).toBe(enemy.id); // homing — locks the unit, not a cell
    expect(data.baseDamage).toBe(catapultShotDamage(cat));
    expect(data.baseDamage).toBe(CATAPULT_STATS.ranged);
    // castPosition is captured for the VFX fallback (the target's cell at cast).
    expect(data.castPosition).toEqual({ x: 6, y: 6 });
  });

  it('FIRES THROUGH a wall — the arcing shot ignores line of sight', () => {
    const cat = makeCatapult({ x: 0, y: 0 });
    const enemy = makeUnit(2, 'enemy', { x: 4, y: 0 }); // in range (<=6)
    const wall = makeUnit(3, 'neutral', { x: 2, y: 0 }, { archetype: 'environment' });
    // A ranged/mage unit would abstain here (LOS broken); the catapult does not.
    expect(new CatapultShot().propose(cat, world([cat, enemy, wall]))).not.toBeNull();
  });

  it('abstains when the only enemy is out of range', () => {
    const cat = makeCatapult({ x: 0, y: 0 });
    const enemy = makeUnit(2, 'enemy', { x: SHOT_RANGE + 1, y: 0 });
    expect(new CatapultShot().propose(cat, world([cat, enemy]))).toBeNull();
  });

  it('abstains when there is no enemy at all', () => {
    const cat = makeCatapult({ x: 5, y: 5 });
    const ally = makeUnit(2, 'player', { x: 5, y: 6 });
    expect(new CatapultShot().propose(cat, world([cat, ally]))).toBeNull();
  });

  it('declares ignoresLineOfSight so MovementBehavior abstains in-range without LOS', () => {
    expect(new CatapultShot().ignoresLineOfSight).toBe(true);
  });
});
