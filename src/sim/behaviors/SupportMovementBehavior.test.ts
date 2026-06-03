import { describe, it, expect } from 'vitest';
import { SupportMovementBehavior } from './SupportMovementBehavior';
import { MoveAction } from '../actions/MoveAction';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats } from '../stats';
import { SIM } from '../../config/sim';
import type { ActionProposal } from '../Action';
import type { GameEvents } from '../../core/events';

/**
 * E7.B — SupportMovementBehavior decision-ladder tests. The heal-range and
 * panic-range expectations derive from the unit's `derived.attackRange` and
 * `SIM.healerPanicRangeCells` (wiring convention) so a config tweak can't
 * silently break the geometry.
 */

const HEAL_RANGE = 3;
const PANIC = SIM.healerPanicRangeCells;
const FOLLOW = SIM.healerFollowGapCells;

const HEALER_STATS: UnitStats = {
  constitution: 20, strength: 0, ranged: 0, magic: 8, luck: 0, agility: 6, mobility: 5,
};
const COMBATANT_STATS: UnitStats = {
  constitution: 20, strength: 6, ranged: 0, magic: 0, luck: 0, agility: 5, mobility: 5,
};

function makeUnit(
  id: number,
  team: Team,
  pos: { x: number; y: number },
  opts: { archetype?: UnitArchetype; range?: number; hp?: number } = {},
): Unit {
  const archetype = opts.archetype ?? 'melee';
  const stats = archetype === 'healer' ? HEALER_STATS : COMBATANT_STATS;
  const u = new Unit({
    id, team, archetype,
    glyph: archetype === 'healer' ? 'h' : 'M',
    stats, derived: deriveStats(stats, opts.range ?? 1), position: pos,
  });
  if (opts.hp !== undefined) u.currentHp = opts.hp;
  return u;
}

function makeHealer(pos: { x: number; y: number }, hp?: number): Unit {
  return makeUnit(1, 'player', pos, {
    archetype: 'healer',
    range: HEAL_RANGE,
    ...(hp !== undefined ? { hp } : {}),
  });
}

function world(units: Unit[]): World {
  const w = new World(new EventBus<GameEvents>(), new RNG(1));
  w.units.push(...units);
  return w;
}

function dest(p: ActionProposal): { x: number; y: number } {
  return (p.action as MoveAction).toData().to;
}

function cheb(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

describe('SupportMovementBehavior', () => {
  it('idles when a wounded ally is already in heal range (lets heal_ally fire)', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    const wounded = makeUnit(2, 'player', { x: 5, y: 5 + HEAL_RANGE }, { hp: 5 });
    expect(new SupportMovementBehavior().proposeAction(healer, world([healer, wounded]))).toBeNull();
  });

  it('idles when only the healer itself is hurt (self-heal in range)', () => {
    const healer = makeHealer({ x: 5, y: 5 }, /* hp */ 5);
    expect(new SupportMovementBehavior().proposeAction(healer, world([healer]))).toBeNull();
  });

  it('panic-retreats (score 5) from a too-close enemy when nothing is healable', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    const enemy = makeUnit(2, 'enemy', { x: 5, y: 5 + PANIC }, {}); // exactly at panic range
    const proposal = new SupportMovementBehavior().proposeAction(healer, world([healer, enemy]));
    expect(proposal).not.toBeNull();
    expect(proposal!.score).toBe(5);
    expect(cheb(dest(proposal!), enemy.position)).toBeGreaterThan(cheb(healer.position, enemy.position));
  });

  it('does not retreat from an enemy just beyond panic range (and idles if nothing to do)', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    const enemy = makeUnit(2, 'enemy', { x: 5, y: 5 + PANIC + 1 }, {});
    // No allies, no wounded → nothing to approach/follow → idle.
    expect(new SupportMovementBehavior().proposeAction(healer, world([healer, enemy]))).toBeNull();
  });

  it('retreat outranks approaching a wounded ally', () => {
    // Enemy to the north (in panic range); wounded ally also north but far
    // out of heal range. Approaching the ally would step TOWARD the enemy;
    // retreat must win and step away (south).
    const healer = makeHealer({ x: 5, y: 5 });
    const enemy = makeUnit(2, 'enemy', { x: 5, y: 5 - PANIC }, {});
    const wounded = makeUnit(3, 'player', { x: 5, y: 0 }, { hp: 5 });
    const proposal = new SupportMovementBehavior().proposeAction(
      healer,
      world([healer, enemy, wounded]),
    );
    expect(proposal!.score).toBe(5);
    expect(cheb(dest(proposal!), enemy.position)).toBeGreaterThan(cheb(healer.position, enemy.position));
  });

  it('approaches the nearest wounded ally (score 1) when no enemy is near', () => {
    const healer = makeHealer({ x: 1, y: 1 });
    const wounded = makeUnit(2, 'player', { x: 1, y: 9 }, { hp: 5 }); // far, out of range
    const proposal = new SupportMovementBehavior().proposeAction(healer, world([healer, wounded]));
    expect(proposal!.score).toBe(1);
    expect(cheb(dest(proposal!), wounded.position)).toBeLessThan(cheb(healer.position, wounded.position));
  });

  it('trails toward the allies CENTROID (score 1), not an individual ally', () => {
    // Nearest ally is one cell WEST; a second ally is far EAST, so the
    // centroid sits east of the healer. A centroid anchor steps EAST (toward
    // the average); a nearest-ally anchor would step WEST onto its neighbor.
    const healer = makeHealer({ x: 5, y: 5 });
    const nearWest = makeUnit(2, 'player', { x: 4, y: 5 }); // full HP, dist 1
    const farEast = makeUnit(3, 'player', { x: 10, y: 5 }); // full HP, dist 5
    const centroid = { x: 7, y: 5 }; // round((4+10)/2)=7
    const proposal = new SupportMovementBehavior().proposeAction(
      healer,
      world([healer, nearWest, farEast]),
    );
    expect(proposal!.score).toBe(1);
    expect(dest(proposal!).x).toBeGreaterThan(healer.position.x); // east, toward centroid
    expect(cheb(dest(proposal!), centroid)).toBeLessThan(cheb(healer.position, centroid));
  });

  it('idles when within healerFollowGapCells of the allies centroid', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    // Single ally exactly FOLLOW cells away → centroid == ally, gap == FOLLOW
    // (not strictly greater) → in formation, idle.
    const ally = makeUnit(2, 'player', { x: 5, y: 5 + FOLLOW });
    expect(new SupportMovementBehavior().proposeAction(healer, world([healer, ally]))).toBeNull();
  });

  it('idles when alone', () => {
    const healer = makeHealer({ x: 5, y: 5 });
    expect(new SupportMovementBehavior().proposeAction(healer, world([healer]))).toBeNull();
  });
});
