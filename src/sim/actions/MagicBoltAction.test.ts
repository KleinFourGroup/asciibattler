import { describe, it, expect } from 'vitest';
import { MagicBoltAction } from './MagicBoltAction';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats } from '../stats';
import { STATS } from '../../config/stats';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';

/**
 * E7.C — MagicBoltAction MECHANIC tests. Per the project convention,
 * mechanic/primitive tests use EXPLICIT inputs (no shipped config), so the
 * blast shape stays pinned even if `config/abilities.json` retunes the
 * mage's radius / ring multiplier / damage. The propose-path wiring (range,
 * cadence, LOS) is covered separately in `abilities/magic.test.ts`.
 */

const COMBATANT_STATS: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, speed: 0, endurance: 0,
};

let nextId = 1;
function makeUnit(team: Team, pos: GridCoord, archetype: UnitArchetype = 'melee'): Unit {
  return new Unit({
    id: nextId++,
    team,
    archetype,
    glyph: 'M',
    stats: COMBATANT_STATS,
    derived: deriveStats(COMBATANT_STATS, 1),
    position: pos,
  });
}

function world(units: Unit[]): World {
  const w = new World(new EventBus<GameEvents>(), new RNG(1));
  w.units.push(...units);
  return w;
}

/** A bolt that never crits (critChance 0) — keeps damage deterministic. */
function bolt(
  center: GridCoord,
  baseDamage: number,
  opts: { radius?: number; ringMultiplier?: number; critChance?: number } = {},
): MagicBoltAction {
  return new MagicBoltAction(
    center,
    baseDamage,
    opts.critChance ?? 0,
    opts.radius ?? 1,
    opts.ringMultiplier ?? 0.5,
  );
}

describe('MagicBoltAction.applyEffect — blast shape', () => {
  it('center cell takes full damage, ring cells take round(base × ringMultiplier)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    const center = makeUnit('enemy', { x: 5, y: 5 }); // chebyshev 0 from center
    const ring = makeUnit('enemy', { x: 6, y: 5 }); // chebyshev 1 from center
    const w = world([caster, center, ring]);

    bolt({ x: 5, y: 5 }, 10, { ringMultiplier: 0.5 }).applyEffect(caster, w, 0);

    expect(center.currentHp).toBe(center.derived.maxHp - 10); // full
    expect(ring.currentHp).toBe(ring.derived.maxHp - 5); // round(10 × 0.5)
  });

  it('hits every enemy within the Chebyshev radius (the full 3×3 for radius 1)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    // 8 ring enemies surrounding center (6,6).
    const ringPositions: GridCoord[] = [
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 },
      { x: 5, y: 6 }, { x: 7, y: 6 },
      { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 },
    ];
    const ringUnits = ringPositions.map((p) => makeUnit('enemy', p));
    const centerUnit = makeUnit('enemy', { x: 6, y: 6 });
    const w = world([caster, centerUnit, ...ringUnits]);

    bolt({ x: 6, y: 6 }, 8, { radius: 1, ringMultiplier: 0.5 }).applyEffect(caster, w, 0);

    expect(centerUnit.currentHp).toBe(centerUnit.derived.maxHp - 8);
    for (const u of ringUnits) expect(u.currentHp).toBe(u.derived.maxHp - 4);
  });

  it('leaves enemies outside the radius untouched', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    const outside = makeUnit('enemy', { x: 5, y: 7 }); // chebyshev 2 from (5,5)
    const w = world([caster, outside]);

    bolt({ x: 5, y: 5 }, 10).applyEffect(caster, w, 0);

    expect(outside.currentHp).toBe(outside.derived.maxHp); // unscathed
  });

  it('spares the caster team — no friendly fire (affectsFriendly off)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    const ally = makeUnit('player', { x: 5, y: 5 }); // dead center, same team
    const enemy = makeUnit('enemy', { x: 5, y: 6 });
    const w = world([caster, ally, enemy]);

    bolt({ x: 5, y: 5 }, 10).applyEffect(caster, w, 0);

    expect(ally.currentHp).toBe(ally.derived.maxHp); // ally untouched
    expect(enemy.currentHp).toBe(enemy.derived.maxHp - 5); // enemy still hit
  });

  it('spares neutral walls / half-cover (destructibility deferred)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    const wall = makeUnit('neutral', { x: 5, y: 5 }, 'environment');
    const w = world([caster, wall]);

    bolt({ x: 5, y: 5 }, 10).applyEffect(caster, w, 0);

    expect(wall.currentHp).toBe(wall.derived.maxHp); // wall undamaged
  });

  it('skips already-dead enemies in the blast (no posthumous hit)', () => {
    const attacks: GameEvents['unit:attacked'][] = [];
    const bus = new EventBus<GameEvents>();
    bus.on('unit:attacked', (p) => attacks.push(p));
    const w = new World(bus, new RNG(1));
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    const corpse = makeUnit('enemy', { x: 5, y: 5 });
    corpse.currentHp = 0;
    w.units.push(caster, corpse);

    bolt({ x: 5, y: 5 }, 10).applyEffect(caster, w, 0);
    expect(attacks).toHaveLength(0);
  });

  it('rolls a single crit for the whole blast (critChance 1 → all cells crit)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    const center = makeUnit('enemy', { x: 5, y: 5 });
    const ring = makeUnit('enemy', { x: 6, y: 5 });
    const attacks: GameEvents['unit:attacked'][] = [];
    const bus = new EventBus<GameEvents>();
    bus.on('unit:attacked', (p) => attacks.push(p));
    const w = new World(bus, new RNG(1));
    w.units.push(caster, center, ring);

    bolt({ x: 5, y: 5 }, 10, { critChance: 1, ringMultiplier: 0.5 }).applyEffect(caster, w, 0);

    // critMult applies BEFORE the per-cell multiplier + round.
    expect(center.currentHp).toBe(center.derived.maxHp - 10 * STATS.critMult);
    expect(ring.currentHp).toBe(ring.derived.maxHp - Math.round(10 * STATS.critMult * 0.5));
    expect(attacks.every((a) => a.crit)).toBe(true); // one roll, all flagged crit
  });

  it('credits the XP ledger for each enemy hit', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    const a = makeUnit('enemy', { x: 5, y: 5 });
    const b = makeUnit('enemy', { x: 6, y: 5 });
    const w = world([caster, a, b]);

    bolt({ x: 5, y: 5 }, 10, { ringMultiplier: 0.5 }).applyEffect(caster, w, 0);

    expect(w.damageDealtBy(caster.id)).toBe(10 + 5); // center + ring
  });

  it('is ground-targeted: an enemy that left the captured cell escapes the blast', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'mage');
    // Captured center is (5,5); the enemy is now far away (it "walked off"
    // during the charge). Same fixed center → out of radius → no hit.
    const escaped = makeUnit('enemy', { x: 9, y: 9 });
    const w = world([caster, escaped]);

    bolt({ x: 5, y: 5 }, 10).applyEffect(caster, w, 0);

    expect(escaped.currentHp).toBe(escaped.derived.maxHp);
  });
});

describe('MagicBoltAction serialization', () => {
  it('round-trips center + damage params through toData / fromData', () => {
    const original = new MagicBoltAction({ x: 3, y: 7 }, 12, 0.25, 1, 0.5);
    const restored = MagicBoltAction.fromData(original.toData());
    expect(restored.toData()).toEqual(original.toData());
    expect(restored.toData().center).toEqual({ x: 3, y: 7 });
  });

  it('toData returns a fresh center object each call (defensive copy)', () => {
    const action = new MagicBoltAction({ x: 3, y: 7 }, 12, 0, 1, 0.5);
    const a = action.toData();
    const b = action.toData();
    expect(a.center).not.toBe(b.center); // distinct references
    expect(a.center).toEqual(b.center); // same value
  });
});
