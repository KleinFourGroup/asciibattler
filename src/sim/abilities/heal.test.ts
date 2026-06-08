import { describe, it, expect } from 'vitest';
import { HealAlly } from './heal';
import { HealAction } from '../actions/HealAction';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats, inertDerived, healAmountFor, attackCooldownTicksFor } from '../stats';
import { abilityConfig } from '../../config/abilities';
import type { GameEvents } from '../../core/events';

/**
 * E7.B — `heal_ally` PROPOSE-path tests (the wiring layer). Range + cadence
 * expectations derive from `config/abilities.json` via `abilityConfig`, per
 * the project convention that wiring tests read the shipped config while
 * mechanic tests (HealAction.test.ts) use explicit inputs.
 */

const HEAL_RANGE = abilityConfig('heal_ally').range;

const HEALER_STATS: UnitStats = {
  constitution: 20, strength: 0, ranged: 0, magic: 8, luck: 0, defense: 0, precision: 5, evasion: 5, speed: 6, mobility: 5, power: 1,
};
const ALLY_STATS: UnitStats = {
  constitution: 20, strength: 6, ranged: 0, magic: 0, luck: 0, defense: 0, precision: 5, evasion: 5, speed: 5, mobility: 5, power: 1,
};

function makeUnit(
  id: number,
  team: Team,
  pos: { x: number; y: number },
  opts: { archetype?: UnitArchetype; stats?: UnitStats; range?: number; hp?: number } = {},
): Unit {
  const archetype = opts.archetype ?? 'melee';
  const isNeutral = archetype === 'environment';
  const stats = opts.stats ?? ALLY_STATS;
  const derived = isNeutral ? inertDerived(opts.hp ?? 1) : deriveStats(stats, opts.range ?? 1);
  const u = new Unit({
    id, team, archetype,
    glyph: archetype === 'healer' ? 'h' : archetype === 'environment' ? '#' : 'M',
    stats, derived, position: pos,
  });
  if (opts.hp !== undefined) u.currentHp = opts.hp;
  return u;
}

function makeHealer(pos: { x: number; y: number }, hp?: number): Unit {
  return makeUnit(1, 'player', pos, {
    archetype: 'healer',
    stats: HEALER_STATS,
    range: HEAL_RANGE,
    ...(hp !== undefined ? { hp } : {}),
  });
}

function world(units: Unit[]): World {
  const w = new World(new EventBus<GameEvents>(), new RNG(1));
  w.units.push(...units);
  return w;
}

function targetIdOf(proposalAction: { toData(): unknown }): number {
  return (proposalAction.toData() as ReturnType<HealAction['toData']>).targetId;
}

describe('HealAlly.propose', () => {
  it('targets the lowest-HP wounded ally in range, score 10, keyed on heal_ally', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    const allyA = makeUnit(2, 'player', { x: 5, y: 6 }, { hp: 10 }); // dist 1, hp 10
    const allyB = makeUnit(3, 'player', { x: 6, y: 7 }, { hp: 5 });  // dist 2, hp 5
    const proposal = new HealAlly().propose(healer, world([healer, allyA, allyB]));

    expect(proposal).not.toBeNull();
    expect(proposal!.score).toBe(10);
    expect(proposal!.cooldownKey).toBe('heal_ally');
    expect(targetIdOf(proposal!.action)).toBe(allyB.id); // lowest HP wins
  });

  it('heals by healAmountFor(healer) (scales on magic)', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    const ally = makeUnit(2, 'player', { x: 5, y: 6 }, { hp: 10 });
    const proposal = new HealAlly().propose(healer, world([healer, ally]));
    const data = proposal!.action.toData() as ReturnType<HealAction['toData']>;
    expect(data.amount).toBe(healAmountFor(healer));
    expect(data.amount).toBe(HEALER_STATS.magic);
  });

  it('can target itself (self is in the ally pool)', () => {
    const healer = makeHealer({ x: 5, y: 5 }, /* hp */ 10);
    // No other wounded ally nearby — only the healer is hurt.
    const fullAlly = makeUnit(2, 'player', { x: 5, y: 6 }); // full HP, not wounded
    const proposal = new HealAlly().propose(healer, world([healer, fullAlly]));
    expect(proposal).not.toBeNull();
    expect(targetIdOf(proposal!.action)).toBe(healer.id);
  });

  it('abstains when no ally is wounded', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    const ally = makeUnit(2, 'player', { x: 5, y: 6 }); // full HP
    expect(new HealAlly().propose(healer, world([healer, ally]))).toBeNull();
  });

  it('abstains when the only wounded ally is out of range', () => {
    const healer = makeHealer({ x: 0, y: 0 });
    const ally = makeUnit(2, 'player', { x: HEAL_RANGE + 1, y: 0 }, { hp: 5 });
    expect(new HealAlly().propose(healer, world([healer, ally]))).toBeNull();
  });

  it('never heals enemies or neutrals (same-team only)', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    const woundedEnemy = makeUnit(2, 'enemy', { x: 5, y: 6 }, { hp: 5 });
    const woundedWall = makeUnit(3, 'neutral', { x: 6, y: 5 }, { archetype: 'environment', hp: 0 });
    expect(new HealAlly().propose(healer, world([healer, woundedEnemy, woundedWall]))).toBeNull();
  });

  it('derives cooldown + busy window from config × speed', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    const ally = makeUnit(2, 'player', { x: 5, y: 6 }, { hp: 10 });
    const proposal = new HealAlly().propose(healer, world([healer, ally]));
    const expected = attackCooldownTicksFor(
      abilityConfig('heal_ally').cooldownSeconds,
      HEALER_STATS.speed,
    );
    expect(proposal!.cooldown).toBe(expected);
    // F2 — single-tick heal: impact at offset 0, recovery fills the cadence
    // window (== the pre-F2 duration lockout).
    expect(proposal!.phases).toEqual([
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: expected },
    ]);
  });
});
