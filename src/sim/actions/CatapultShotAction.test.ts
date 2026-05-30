import { describe, it, expect } from 'vitest';
import { CatapultShotAction } from './CatapultShotAction';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats } from '../stats';
import { STATS } from '../../config/stats';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';

/**
 * E7.D — CatapultShotAction MECHANIC tests. Per the project convention,
 * mechanic/primitive tests use EXPLICIT inputs (no shipped config), so the
 * single-hit shape stays pinned even if `config/abilities.json` retunes the
 * catapult. The propose-path wiring (range, cadence, no-LOS gate) is covered
 * separately in `abilities/catapult.test.ts`.
 *
 * The catapult is HOMING (locks a live target), so the load-bearing contract
 * here is: damage lands on the locked unit at impact, and the shot fizzles
 * (silently, no combatRng draw) if that unit died during the wind-up.
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

describe('CatapultShotAction.applyEffect — single heavy hit', () => {
  it('lands full damage on the locked target at impact', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const w = world([caster, target]);

    new CatapultShotAction(target, 14, 0).applyEffect(caster, w, 0);

    expect(target.currentHp).toBe(target.derived.maxHp - 14);
  });

  it('start is a no-op — the shot only lands at applyEffect (it is winding up)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const w = world([caster, target]);

    new CatapultShotAction(target, 14, 0).start(caster, w);

    expect(target.currentHp).toBe(target.derived.maxHp); // unscathed during the charge
  });

  it('hits ONLY the locked target — a bystander beside it is untouched (single-target)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const bystander = makeUnit('enemy', { x: 6, y: 1 }); // adjacent, but not locked
    const w = world([caster, target, bystander]);

    new CatapultShotAction(target, 14, 0).applyEffect(caster, w, 0);

    expect(target.currentHp).toBe(target.derived.maxHp - 14);
    expect(bystander.currentHp).toBe(bystander.derived.maxHp); // no splash
  });

  it('rolls one crit at impact (critChance 1 → critMult damage, crit flag set)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const attacks: GameEvents['unit:attacked'][] = [];
    const bus = new EventBus<GameEvents>();
    bus.on('unit:attacked', (p) => attacks.push(p));
    const w = new World(bus, new RNG(1));
    w.units.push(caster, target);

    new CatapultShotAction(target, 14, 1).applyEffect(caster, w, 0);

    expect(target.currentHp).toBe(target.derived.maxHp - 14 * STATS.critMult);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.crit).toBe(true);
  });

  it('emits unit:attacked once with the attacker, target, and dealt damage', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const attacks: GameEvents['unit:attacked'][] = [];
    const bus = new EventBus<GameEvents>();
    bus.on('unit:attacked', (p) => attacks.push(p));
    const w = new World(bus, new RNG(1));
    w.units.push(caster, target);

    new CatapultShotAction(target, 14, 0).applyEffect(caster, w, 0);

    expect(attacks).toEqual([
      { attackerId: caster.id, targetId: target.id, damage: 14, crit: false },
    ]);
  });

  it('fizzles if the locked target died mid-charge: no damage, no event, no combatRng draw', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const corpse = makeUnit('enemy', { x: 6, y: 0 });
    corpse.currentHp = 0; // "died" during the wind-up
    const attacks: GameEvents['unit:attacked'][] = [];
    const bus = new EventBus<GameEvents>();
    bus.on('unit:attacked', (p) => attacks.push(p));
    const w = new World(bus, new RNG(1));
    w.units.push(caster, corpse);
    const rngBefore = JSON.stringify(w.combatRng.toJSON());

    new CatapultShotAction(corpse, 14, 1).applyEffect(caster, w, 0);

    expect(attacks).toHaveLength(0);
    // The crit roll is skipped on a fizzle (no draw), so combatRng is intact.
    expect(JSON.stringify(w.combatRng.toJSON())).toBe(rngBefore);
  });

  it('credits the XP ledger for the damage dealt', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const w = world([caster, target]);

    new CatapultShotAction(target, 14, 0).applyEffect(caster, w, 0);

    expect(w.damageDealtBy(caster.id)).toBe(14);
  });
});

describe('CatapultShotAction serialization', () => {
  it('round-trips targetId + damage params through toData / fromData', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const w = world([caster, target]);

    const original = new CatapultShotAction(target, 14, 0.25);
    const restored = CatapultShotAction.fromData(original.toData(), w);

    expect(restored.toData()).toEqual(original.toData());
    expect(restored.toData().targetId).toBe(target.id);
  });

  it('re-resolves the live target via world.findUnit so a restored shot still lands', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const w = world([caster, target]);

    const restored = CatapultShotAction.fromData(
      new CatapultShotAction(target, 14, 0).toData(),
      w,
    );
    restored.applyEffect(caster, w, 0);

    expect(target.currentHp).toBe(target.derived.maxHp - 14);
  });

  it('fizzles after restore when the target no longer exists in the world', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const w = world([caster]); // target absent — findUnit returns undefined

    const restored = CatapultShotAction.fromData(
      new CatapultShotAction(target, 14, 0).toData(),
      w,
    );
    // No throw, no effect — the homing reference resolved to undefined.
    expect(() => restored.applyEffect(caster, w, 0)).not.toThrow();
  });
});
