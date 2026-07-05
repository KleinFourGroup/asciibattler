import { describe, it, expect } from 'vitest';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats, inertDerived } from '../stats';
import { chebyshev } from '../movement';
import { LEVELING } from '../../config/leveling';
import { abilityDef } from '../../config/abilities';
import { rangeForArchetype } from '../archetypes';
import { MovementBehavior } from '../behaviors/MovementBehavior';
import { EffectAbility } from './EffectAbility';
import { parseAbilityDef, type AbilityDef, type ScaledValue } from './schema';
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

describe('proposeEffectAbility — chain (chain_lightning, §29c)', () => {
  it('commits the primary + captures each inner op\'s cast-time scalars into chainOps', () => {
    const u = caster('chain_lightning', { x: 5, y: 5 });
    const enemy = makeUnit('enemy', { x: 8, y: 5 }); // dist 3, inside [2, 5] band
    const p = ability('chain_lightning').propose(u, world([u, enemy]));
    expect(p).not.toBeNull();
    expect(p!.cooldownKey).toBe('chain_lightning');
    const d = dataOf(p!.action);
    expect(d.targetId).toBe(enemy.id); // the chain locks the primary like a strike
    // The cast-time-capture contract: the inner bolt's baseDamage is the caster's
    // CAST-time magic (might 0 + magic), captured once into chainOps — the
    // interpreter scales it by falloff per hop, but capture happens here.
    const chainOps = d.ops[0]!.chainOps!;
    expect(chainOps).toHaveLength(1);
    expect(chainOps[0]!.baseDamage).toBe(u.effectiveStats.magic);
  });

  it('abstains inside the minRange floor, casts at the floor', () => {
    const floor = abilityDef('chain_lightning').minRangeCells;
    expect(floor).toBeGreaterThanOrEqual(1);
    const u = caster('chain_lightning', { x: 5, y: 5 });
    const tooClose = makeUnit('enemy', { x: 5 + (floor - 1), y: 5 });
    expect(ability('chain_lightning').propose(u, world([u, tooClose]))).toBeNull();
    const atFloor = makeUnit('enemy', { x: 5 + floor, y: 5 });
    expect(ability('chain_lightning').propose(u, world([u, atFloor]))).not.toBeNull();
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

describe('proposeEffectAbility — applyStatus scaling capture (§31)', () => {
  // Clone the shipped `cleaver` (a Reaver bleed-on-hit: effects [damage, applyStatus]
  // on impact) and inject scaled magnitude/duration onto its applyStatus op, so the
  // propose-time capture runs against a real multi-op def. Re-parsed through the
  // schema, so the ScaledValue authoring is validated — not merely type-asserted.
  function cleaverWithStatus(over: {
    magnitude?: number | ScaledValue;
    durationSeconds?: number | ScaledValue;
  }): AbilityDef {
    const raw = structuredClone(abilityDef('cleaver'));
    const entry = raw.effects.find((e) => e.op.kind === 'applyStatus')!;
    if (entry.op.kind === 'applyStatus') {
      if (over.magnitude !== undefined) entry.op.magnitude = over.magnitude;
      if (over.durationSeconds !== undefined) entry.op.durationSeconds = over.durationSeconds;
    }
    return parseAbilityDef(raw);
  }

  // cleaver's effects are [damage, applyStatus] → ops[1] is the status resolution.
  const STATUS = 1;
  function proposeCleaver(def: AbilityDef): EffectActionData {
    const u = caster('cleaver', { x: 5, y: 5 }); // STATS.strength = 8
    const enemy = makeUnit('enemy', { x: 6, y: 5 }); // dist 1 == reach
    const p = new EffectAbility(def).propose(u, world([u, enemy]));
    expect(p).not.toBeNull();
    return dataOf(p!.action);
  }

  it('an unauthored magnitude/duration captures as undefined (the consumer default governs)', () => {
    const res = proposeCleaver(cleaverWithStatus({})).ops[STATUS]!;
    expect(res.statusMagnitude).toBeUndefined(); // executeApplyStatus `?? 1`
    expect(res.statusDurationSeconds).toBeUndefined(); // def-duration base
  });

  it('a bare-number magnitude/duration is captured verbatim (frozen, byte-identical to today)', () => {
    const res = proposeCleaver(cleaverWithStatus({ magnitude: 2, durationSeconds: 3 })).ops[STATUS]!;
    expect(res.statusMagnitude).toBe(2);
    expect(res.statusDurationSeconds).toBe(3);
  });

  it('a scaled magnitude is captured off the caster at cast (base + perPoint × stat)', () => {
    // strength 8 → 1 + 0.5 × 8 = 5
    const res = proposeCleaver(
      cleaverWithStatus({ magnitude: { base: 1, stat: 'strength', perPoint: 0.5 } }),
    ).ops[STATUS]!;
    expect(res.statusMagnitude).toBe(5);
  });

  it('a scaled duration honors its max clamp', () => {
    // strength 8 → 2 + 1 × 8 = 10, clamped to 5
    const res = proposeCleaver(
      cleaverWithStatus({ durationSeconds: { base: 2, stat: 'strength', perPoint: 1, max: 5 } }),
    ).ops[STATUS]!;
    expect(res.statusDurationSeconds).toBe(5);
  });
});

/**
 * 43-pre-b — the LOS occluder pool (`collectLosBlockers`) must cover a
 * multi-tile neutral's WHOLE footprint (`cellsOccupiedBy`), not just its §39
 * canonical corner. Corner-only, a 2×2 rubble's body cells were invisible to
 * the shot gate — archers fired straight through them. The rubble is built
 * directly (id 900, clear of both id counters); `blocksLineOfSight` defaults
 * true, and `footprintOf` resolves the 2×2 off the `rubble_2x2` def.
 */
describe('proposeEffectAbility — multi-tile neutral footprints (43-pre-b)', () => {
  const rubble2x2 = (corner: GridCoord): Unit =>
    new Unit({
      id: 900,
      team: 'neutral',
      archetype: 'rubble_2x2',
      glyph: '#',
      stats: STATS,
      derived: inertDerived(1),
      position: corner,
    });

  it('the bow abstains when a rubble BODY cell (corner off-line) breaks LOS', () => {
    const u = caster('bow', { x: 0, y: 5 });
    const enemy = makeUnit('enemy', { x: 3, y: 5 }); // dist 3, in range
    // Corner (1,4) is OFF the sight line; body cells (1,5)(2,5) are ON it.
    const p = ability('bow').propose(u, world([u, enemy, rubble2x2({ x: 1, y: 4 })]));
    expect(p).toBeNull();
  });

  it('the catapult (ignoresLineOfSight) still lobs over the rubble body', () => {
    const u = caster('catapult_shot', { x: 0, y: 5 });
    const dist = Math.min(abilityDef('catapult_shot').rangeCells, 5);
    const enemy = makeUnit('enemy', { x: dist, y: 5 });
    const p = ability('catapult_shot').propose(u, world([u, enemy, rubble2x2({ x: 1, y: 4 })]));
    expect(p).not.toBeNull();
  });
});

/**
 * 44-pre-c — the strike gates measure the firing band against the target's
 * BODY (`firingBandCell` — in band of, and with LOS to, ANY body cell), not its
 * §39 corner. Corner-only, a melee unit flush against a big rubble's far side
 * read "out of range" (§40's "fires the moment body-adjacent" comment was
 * FALSE); a bow in body-range abstained because the ray to the CORNER threaded
 * the body; a mage/catapult whose corner sat past max range couldn't fire at
 * the body under its nose. The movement hold routes through the SAME predicate
 * — the sweep at the bottom pins the pair's agreement (the GP4/Qb#3
 * freeze-class gate).
 */
describe('proposeEffectAbility — footprint firing band (44-pre-c)', () => {
  const rubble = (corner: GridCoord, archetype: UnitArchetype = 'rubble_2x2'): Unit =>
    new Unit({
      id: 900,
      team: 'neutral',
      archetype,
      glyph: '#',
      stats: STATS,
      derived: inertDerived(1),
      position: corner,
    });

  it('a sword flush against the FAR side of a 2×2 rubble strikes the body', () => {
    const r = rubble({ x: 3, y: 3 }); // body (3,3)(4,3)(3,4)(4,4)
    const u = caster('sword', { x: 5, y: 4 }); // adjacent to (4,3)/(4,4); corner dist 2
    u.targetId = r.id;
    const p = ability('sword').propose(u, world([u, r]));
    expect(p).not.toBeNull();
    expect(dataOf(p!.action).targetId).toBe(r.id);
  });

  it('a bow with a clear BODY shot fires though the corner ray threads the body', () => {
    const r = rubble({ x: 3, y: 3 });
    const u = caster('bow', { x: 6, y: 4 }); // body (4,3)/(4,4) at dist 2 ∈ [2,3]
    u.targetId = r.id;
    expect(ability('bow').propose(u, world([u, r]))).not.toBeNull();
  });

  it('a bow flush against the body abstains — the WHOLE body is under its floor or unseen', () => {
    const r = rubble({ x: 3, y: 3 });
    const u = caster('bow', { x: 5, y: 4 }); // nearest body dist 1 < minRange 2;
    u.targetId = r.id; // in-band body cells only via rays through the body
    expect(ability('bow').propose(u, world([u, r]))).toBeNull();
  });

  it('a catapult lobs at a body edging into range though the corner is past max', () => {
    const r = rubble({ x: 4, y: 4 }, 'rubble_3x3'); // body x,y ∈ [4..6]
    const u = caster('catapult_shot', { x: 11, y: 5 }); // corner 7 > 6; body (6,5) at 5
    u.targetId = r.id;
    expect(ability('catapult_shot').propose(u, world([u, r]))).not.toBeNull();
  });

  it('a mage bolt reaches a body cell past its corner range and centres the blast on it', () => {
    const r = rubble({ x: 4, y: 4 }, 'rubble_3x3');
    const u = caster('magic_bolt', { x: 11, y: 5 }); // corner 7 > 5; body edge at 5
    u.targetId = r.id;
    const p = ability('magic_bolt').propose(u, world([u, r]));
    expect(p).not.toBeNull();
    const cell = dataOf(p!.action).targetCell!;
    // The blast centre is the gate's aim cell — an in-range, visible BODY cell.
    expect(cell.x).toBeGreaterThanOrEqual(4);
    expect(cell.x).toBeLessThanOrEqual(6);
    expect(cell.y).toBeGreaterThanOrEqual(4);
    expect(cell.y).toBeLessThanOrEqual(6);
    expect(Math.max(Math.abs(cell.x - 11), Math.abs(cell.y - 5))).toBeLessThanOrEqual(
      abilityDef('magic_bolt').rangeCells,
    );
  });

  it('the dash abstains body-adjacent to a rubble (already in strike reach)', () => {
    const r = rubble({ x: 3, y: 3 });
    const u = makeUnit('player', { x: 5, y: 4 }, { range: 1 }); // body-adjacent melee
    u.targetId = r.id;
    // Corner-only read dist 2 > reach 1 and tried to leap at a body it could
    // already hit (the leap then aborted on the unreachable corner — a wasted
    // gate, not a freeze). Footprint distance abstains outright.
    expect(ability('dash').propose(u, world([u, r]))).toBeNull();
  });

  it('the hold/strike pair NEVER disagrees around a 3×3 rubble (the freeze-class gate)', () => {
    // The GP4/Qb#3 deadlock IS the movement hold and the strike gate answering
    // "in range?" differently: hold_band with no fireable strike = a frozen
    // unit. Sweep every free cell around a 3×3 rubble for the three gate
    // shapes (melee / LOS-gated ranged / LOS-ignoring lob): wherever movement
    // holds, the strike MUST fire.
    const VARIANTS = [
      { aid: 'sword', archetype: 'mercenary' },
      { aid: 'bow', archetype: 'ranged' },
      { aid: 'catapult_shot', archetype: 'catapult' },
    ] as const;
    for (const v of VARIANTS) {
      const def = abilityDef(v.aid);
      let holds = 0;
      for (let x = 0; x < 14; x++) {
        for (let y = 0; y < 14; y++) {
          if (x >= 4 && x <= 6 && y >= 4 && y <= 6) continue; // the body itself
          const r = rubble({ x: 4, y: 4 }, 'rubble_3x3');
          const u = makeUnit('player', { x, y }, {
            archetype: v.archetype,
            range: rangeForArchetype(v.archetype),
          });
          u.targetId = r.id;
          u.abilities.push(new EffectAbility(def)); // the hold reads ignoresLineOfSight
          const bus = new EventBus<GameEvents>();
          const w = new World(bus, new RNG(1), 16, 16);
          w.units.push(u, r);
          const kinds: string[] = [];
          bus.on('unit:moveDecision', (p) => kinds.push(p.kind));
          new MovementBehavior().proposeAction(u, w);
          if (kinds[kinds.length - 1] === 'hold_band') {
            holds++;
            expect(
              new EffectAbility(def).propose(u, w),
              `${v.aid} holds at (${x},${y}) but cannot strike`,
            ).not.toBeNull();
          }
        }
      }
      expect(holds, `${v.aid} never held — the sweep is vacuous`).toBeGreaterThan(0);
    }
  });
});
