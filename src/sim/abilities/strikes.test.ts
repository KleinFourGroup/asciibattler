import { describe, it, expect } from 'vitest';
import { MeleeStrike, GambitStrike } from './strikes';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats, attackCooldownTicksFor } from '../stats';
import { attackConfig } from '../../config/abilities';
import { secondsToTicks } from '../../config';
import { totalTicks } from '../Action';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';

/**
 * F4 — basic-strike PROPOSE-path tests (the wiring layer). Cadence + the
 * gambit's `retreatDelaySeconds` split derive from `config/abilities.json` via
 * `abilityConfig`, per the project convention that wiring tests read the
 * shipped config while mechanic tests (GambitStrikeAction.test.ts) use explicit
 * inputs. The point here is the PHASE SHAPE: the rogue's gambit carves a
 * leading `windup` (so the strike shove plays before the deferred retreat),
 * while a plain melee strike stays `[impact 0, recovery D]`.
 */

const GAMBIT = attackConfig('gambit_strike');
// I6 — `melee_strike` split into per-subclass weapons; `sword` is the mercenary's.
const MELEE = attackConfig('sword');

// Representative rogue/melee stat blocks. Cadence expectations derive from the
// SAME `speed` via `attackCooldownTicksFor`, so the assertions hold regardless
// of the exact shipped numbers — these just need a non-zero speed so the
// windup is strictly inside the busy window (a real split, not a degenerate 0).
const ROGUE_STATS: UnitStats = {
  constitution: 14, strength: 4, ranged: 0, magic: 0, luck: 10, defense: 0, precision: 5, evasion: 5, speed: 9, mobility: 4, power: 1,
};
const MELEE_STATS: UnitStats = {
  constitution: 30, strength: 8, ranged: 0, magic: 0, luck: 2, defense: 0, precision: 5, evasion: 5, speed: 3, mobility: 5, power: 1,
};

function makeUnit(
  id: number,
  team: Team,
  pos: GridCoord,
  opts: { archetype?: UnitArchetype; stats?: UnitStats; range?: number } = {},
): Unit {
  const archetype = opts.archetype ?? 'mercenary';
  const stats = opts.stats ?? MELEE_STATS;
  // melee_strike + gambit_strike both have range 1, so the default is right
  // for every unit this file constructs.
  return new Unit({
    id, team, archetype,
    glyph: archetype === 'rogue' ? 'r' : 'M',
    stats, derived: deriveStats(stats, opts.range ?? 1),
    position: pos,
  });
}

function world(units: Unit[]): World {
  const w = new World(new EventBus<GameEvents>(), new RNG(1));
  w.units.push(...units);
  return w;
}

describe('GambitStrike.propose — F4 phase timeline', () => {
  it('carves a leading windup out of recovery: [windup R, impact 0, recovery D−R]', () => {
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, { archetype: 'rogue', stats: ROGUE_STATS });
    const enemy = makeUnit(2, 'enemy', { x: 6, y: 5 }); // dist 1, in gambit range
    const proposal = new GambitStrike().propose(rogue, world([rogue, enemy]));

    expect(proposal).not.toBeNull();
    expect(proposal!.score).toBe(10);
    expect(proposal!.cooldownKey).toBe('gambit_strike');

    const durationTicks = attackCooldownTicksFor(GAMBIT.cooldownSeconds, ROGUE_STATS.speed);
    const windup = Math.min(secondsToTicks(GAMBIT.retreatDelaySeconds!), durationTicks);
    expect(windup).toBeGreaterThan(0); // a real split, not degenerate
    expect(windup).toBeLessThan(durationTicks); // strictly inside the busy window

    expect(proposal!.phases).toEqual([
      { phase: 'windup', ticks: windup },
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: durationTicks - windup },
    ]);
  });

  it('is balance-neutral on cadence: Σ phase ticks == cooldown == the un-split duration', () => {
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, { archetype: 'rogue', stats: ROGUE_STATS });
    const enemy = makeUnit(2, 'enemy', { x: 6, y: 5 });
    const proposal = new GambitStrike().propose(rogue, world([rogue, enemy]));

    const durationTicks = attackCooldownTicksFor(GAMBIT.cooldownSeconds, ROGUE_STATS.speed);
    expect(proposal!.cooldown).toBe(durationTicks);
    expect(totalTicks(proposal!.phases)).toBe(durationTicks);
  });
});

describe('MeleeStrike.propose — stays a basic strike', () => {
  it('has no windup: [impact 0, recovery D] (no retreatDelaySeconds on the sword)', () => {
    expect(MELEE.retreatDelaySeconds).toBeUndefined();

    const melee = makeUnit(1, 'player', { x: 5, y: 5 }, { stats: MELEE_STATS });
    const enemy = makeUnit(2, 'enemy', { x: 6, y: 5 });
    const proposal = new MeleeStrike('sword').propose(melee, world([melee, enemy]));

    const durationTicks = attackCooldownTicksFor(MELEE.cooldownSeconds, MELEE_STATS.speed);
    expect(proposal!.phases).toEqual([
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: durationTicks },
    ]);
  });
});
