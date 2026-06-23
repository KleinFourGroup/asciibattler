import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats, inertDerived } from '../stats';
import { chebyshev } from '../movement';
import { LEVELING } from '../../config/leveling';
import { abilityDef } from '../../config/abilities';
import { EffectAbility } from './EffectAbility';
import type { EffectActionData } from './EffectAction';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';

/**
 * Phase Y5 — the propose-bridge gate tests, pinned DIRECTLY on the production
 * `EffectAbility`.
 *
 * Through Y4 the propose bridge ([propose.ts](src/sim/effects/propose.ts)) — the
 * range / minRange band, the LOS gate + the catapult's LOS skip, the half-cover
 * capture, the aoe blast-centre, the fizzle cast-cell, the heal pick, and the
 * dash aggressive-close gate — was covered only end-to-end by the determinism
 * oracle (effectMigration.test.ts), which compared each migrated verb to its
 * legacy class. Y5 deletes the legacy classes (and so the oracle), so these tests
 * harvest the oracle's propose coverage onto the data-driven path. Op / firing /
 * timeline / targeting coverage lives in the sibling `effects/*.test.ts`; the
 * per-archetype battles in `tests/integration/*-battle.test.ts` drive the whole
 * loop through `createAbility` → `EffectAbility`.
 */

const STATS: UnitStats = {
  constitution: 30, strength: 8, ranged: 14, magic: 10, luck: 3, defense: 0,
  precision: 5, evasion: 5, speed: 5, mobility: 5, power: 1,
};

interface MakeOpts {
  archetype?: UnitArchetype;
  stats?: UnitStats;
  /** strike reach via `deriveStats` (= `derived.attackRange`). */
  range?: number;
  hp?: number;
  blocksLos?: boolean;
}

let nextId = 1;
function makeUnit(team: Team, pos: GridCoord, opts: MakeOpts = {}): Unit {
  const archetype = opts.archetype ?? 'mercenary';
  const isEnv = archetype === 'environment';
  const stats = opts.stats ?? STATS;
  const derived = isEnv ? inertDerived(opts.hp ?? 1) : deriveStats(stats, opts.range ?? 1);
  const u = new Unit({
    id: nextId++,
    team,
    archetype,
    glyph: isEnv ? '#' : 'M',
    stats,
    derived,
    position: pos,
    ...(opts.blocksLos !== undefined ? { blocksLineOfSight: opts.blocksLos } : {}),
  });
  if (opts.hp !== undefined) u.currentHp = opts.hp;
  return u;
}

function world(units: Unit[]): World {
  const w = new World(new EventBus<GameEvents>(), new RNG(1), 16, 16);
  w.units.push(...units);
  return w;
}

function ability(id: string): EffectAbility {
  return new EffectAbility(abilityDef(id));
}

function dataOf(action: { toData(): unknown }): EffectActionData {
  return action.toData() as EffectActionData;
}

/** A player caster whose strike reach == the named ability's own range, so
 *  `currentTarget` commits a target inside that range (mirrors the legacy
 *  wiring tests' `rangeForArchetype`). */
function caster(id: string, pos: GridCoord, extra: MakeOpts = {}): Unit {
  return makeUnit('player', pos, { range: abilityDef(id).rangeCells, ...extra });
}

const wall = (pos: GridCoord): Unit => makeUnit('neutral', pos, { archetype: 'environment' });
const halfCover = (pos: GridCoord): Unit =>
  makeUnit('neutral', pos, { archetype: 'environment', blocksLos: false });

describe('proposeEffectAbility — enemyInRange strike (sword)', () => {
  it('proposes in range, with the def score + cooldownKey', () => {
    const u = caster('sword', { x: 5, y: 5 });
    const enemy = makeUnit('enemy', { x: 6, y: 5 }); // dist 1 == range
    const p = ability('sword').propose(u, world([u, enemy]));
    expect(p).not.toBeNull();
    expect(p!.score).toBe(abilityDef('sword').priority);
    expect(p!.cooldownKey).toBe('sword');
    expect(dataOf(p!.action).targetId).toBe(enemy.id);
  });

  it('abstains out of range', () => {
    const u = caster('sword', { x: 0, y: 0 });
    const enemy = makeUnit('enemy', { x: 2, y: 0 }); // dist 2 > range 1
    expect(ability('sword').propose(u, world([u, enemy]))).toBeNull();
  });

  it('abstains when there is no enemy', () => {
    const u = caster('sword', { x: 5, y: 5 });
    const ally = makeUnit('player', { x: 6, y: 5 });
    expect(ability('sword').propose(u, world([u, ally]))).toBeNull();
  });
});

describe('proposeEffectAbility — enemyInRange + minRange + LOS + half-cover (bow)', () => {
  it('abstains inside the minRange floor, fires at the floor', () => {
    const floor = abilityDef('bow').minRangeCells;
    expect(floor).toBeGreaterThanOrEqual(1);
    const u = caster('bow', { x: 5, y: 5 });
    const tooClose = makeUnit('enemy', { x: 5 + (floor - 1), y: 5 });
    expect(ability('bow').propose(u, world([u, tooClose]))).toBeNull();
    const atFloor = makeUnit('enemy', { x: 5 + floor, y: 5 });
    expect(ability('bow').propose(u, world([u, atFloor]))).not.toBeNull();
  });

  it('abstains when a wall breaks line of sight', () => {
    const u = caster('bow', { x: 0, y: 0 });
    const enemy = makeUnit('enemy', { x: 3, y: 0 }); // in range
    expect(ability('bow').propose(u, world([u, enemy, wall({ x: 2, y: 0 })]))).toBeNull();
  });

  it('fires through half-cover and captures the 0.5 damage multiplier on the op', () => {
    const u = caster('bow', { x: 0, y: 0 });
    const enemy = makeUnit('enemy', { x: 3, y: 0 });
    const p = ability('bow').propose(u, world([u, enemy, halfCover({ x: 2, y: 0 })]));
    expect(p).not.toBeNull();
    expect(dataOf(p!.action).ops[0]!.damageMultiplier).toBe(LEVELING.halfCoverDamageMult);
  });

  it('no half-cover → multiplier 1', () => {
    const u = caster('bow', { x: 0, y: 0 });
    const enemy = makeUnit('enemy', { x: 3, y: 0 });
    const p = ability('bow').propose(u, world([u, enemy]));
    expect(dataOf(p!.action).ops[0]!.damageMultiplier).toBe(1);
  });
});

describe('proposeEffectAbility — aoe (magic_bolt)', () => {
  it('ground-targets the enemy cell at cast (targetId -1, targetCell = the cell)', () => {
    const u = caster('magic_bolt', { x: 5, y: 5 });
    const enemy = makeUnit('enemy', { x: 7, y: 7 }); // dist 2, in band
    const p = ability('magic_bolt').propose(u, world([u, enemy]));
    expect(p).not.toBeNull();
    const d = dataOf(p!.action);
    expect(d.targetId).toBe(-1); // the blast subjects whoever is in the cells, not a locked unit
    expect(d.targetCell).toEqual({ x: 7, y: 7 });
  });

  it('abstains inside the minRange floor, casts at the floor', () => {
    const floor = abilityDef('magic_bolt').minRangeCells;
    expect(floor).toBeGreaterThanOrEqual(1);
    const u = caster('magic_bolt', { x: 5, y: 5 });
    const tooClose = makeUnit('enemy', { x: 5 + (floor - 1), y: 5 });
    expect(ability('magic_bolt').propose(u, world([u, tooClose]))).toBeNull();
    const atFloor = makeUnit('enemy', { x: 5 + floor, y: 5 });
    expect(ability('magic_bolt').propose(u, world([u, atFloor]))).not.toBeNull();
  });

  it('abstains when a wall breaks line of sight (a bolt cannot pass stone)', () => {
    const u = caster('magic_bolt', { x: 0, y: 0 });
    const enemy = makeUnit('enemy', { x: 4, y: 0 }); // in range
    expect(ability('magic_bolt').propose(u, world([u, enemy, wall({ x: 2, y: 0 })]))).toBeNull();
  });

  it('fires through half-cover (LOS-transparent neutral)', () => {
    const u = caster('magic_bolt', { x: 0, y: 0 });
    const enemy = makeUnit('enemy', { x: 4, y: 0 });
    expect(
      ability('magic_bolt').propose(u, world([u, enemy, halfCover({ x: 2, y: 0 })])),
    ).not.toBeNull();
  });
});

describe('proposeEffectAbility — fizzle artillery (catapult_shot)', () => {
  it('locks the live enemy + captures the cast cell as the fizzle fallback', () => {
    const u = caster('catapult_shot', { x: 5, y: 5 });
    const enemy = makeUnit('enemy', { x: 9, y: 9 }); // dist 4, in band
    const p = ability('catapult_shot').propose(u, world([u, enemy]));
    expect(p).not.toBeNull();
    const d = dataOf(p!.action);
    expect(d.targetId).toBe(enemy.id); // homing — locks the unit
    expect(d.targetCell).toEqual({ x: 9, y: 9 }); // the cast cell (dud-VFX fallback)
  });

  it('FIRES THROUGH a wall — the arcing shot ignores line of sight', () => {
    const u = caster('catapult_shot', { x: 0, y: 0 });
    const enemy = makeUnit('enemy', { x: 4, y: 0 }); // in range
    // A bow/mage would abstain here (LOS broken); the catapult lobs over.
    expect(
      ability('catapult_shot').propose(u, world([u, enemy, wall({ x: 2, y: 0 })])),
    ).not.toBeNull();
  });

  it('exposes ignoresLineOfSight so MovementBehavior abstains in-range without LOS', () => {
    expect(ability('catapult_shot').ignoresLineOfSight).toBe(true);
    expect(ability('bow').ignoresLineOfSight).toBeUndefined();
  });

  it('abstains inside the minRange floor', () => {
    const floor = abilityDef('catapult_shot').minRangeCells;
    expect(floor).toBeGreaterThanOrEqual(1);
    const u = caster('catapult_shot', { x: 5, y: 5 });
    const tooClose = makeUnit('enemy', { x: 5 + (floor - 1), y: 5 });
    expect(ability('catapult_shot').propose(u, world([u, tooClose]))).toBeNull();
  });
});

describe('proposeEffectAbility — lowestHpAlly (heal_ally)', () => {
  it('targets the lowest-HP wounded ally in range (self included)', () => {
    const h = makeUnit('player', { x: 5, y: 5 }, { archetype: 'healer' });
    const allyA = makeUnit('player', { x: 5, y: 6 }, { hp: 10 });
    const allyB = makeUnit('player', { x: 6, y: 7 }, { hp: 5 });
    const p = ability('heal_ally').propose(h, world([h, allyA, allyB]));
    expect(p).not.toBeNull();
    expect(p!.cooldownKey).toBe('heal_ally');
    expect(dataOf(p!.action).targetId).toBe(allyB.id); // lowest HP wins
  });

  it('abstains when no ally is wounded', () => {
    const h = makeUnit('player', { x: 5, y: 5 }, { archetype: 'healer' });
    const ally = makeUnit('player', { x: 5, y: 6 }); // full HP
    expect(ability('heal_ally').propose(h, world([h, ally]))).toBeNull();
  });

  it('never heals enemies or neutrals (same-team only)', () => {
    const h = makeUnit('player', { x: 5, y: 5 }, { archetype: 'healer' });
    const woundedEnemy = makeUnit('enemy', { x: 5, y: 6 }, { hp: 5 });
    expect(ability('heal_ally').propose(h, world([h, woundedEnemy]))).toBeNull();
  });
});

describe('proposeEffectAbility — self caster-reposition (dash)', () => {
  it('abstains when the target is already within strike range (let the strike fire)', () => {
    const r = makeUnit('player', { x: 5, y: 5 }, { archetype: 'rogue', range: 1 });
    const enemy = makeUnit('enemy', { x: 6, y: 5 }); // dist 1 == strike reach
    expect(ability('dash').propose(r, world([r, enemy]))).toBeNull();
  });

  it('abstains when there is no target', () => {
    const r = makeUnit('player', { x: 5, y: 5 }, { archetype: 'rogue', range: 1 });
    expect(ability('dash').propose(r, world([r]))).toBeNull();
  });

  it('leaps toward a far target: targetId -1, the landing captured on the move op', () => {
    const start = { x: 5, y: 5 };
    const r = makeUnit('player', start, { archetype: 'rogue', range: 1 });
    const enemy = makeUnit('enemy', { x: 5 + abilityDef('dash').rangeCells + 2, y: 5 });
    const p = ability('dash').propose(r, world([r, enemy]));
    expect(p).not.toBeNull();
    const d = dataOf(p!.action);
    expect(d.targetId).toBe(-1); // the leap subjects the caster, not the enemy
    const land = d.ops[0]!.moveDest!;
    expect(chebyshev(land, start)).toBe(abilityDef('dash').rangeCells); // covers the full leap
    expect(chebyshev(land, enemy.position)).toBeLessThan(chebyshev(start, enemy.position));
  });
});
