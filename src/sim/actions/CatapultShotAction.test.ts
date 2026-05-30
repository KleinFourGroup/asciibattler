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
 * The catapult is HOMING (locks a live target), so the load-bearing contracts
 * here are: damage lands on the locked unit at impact; the shot fizzles
 * (no damage, no combatRng draw) if that unit died during the wind-up; and a
 * `catapult:fired` event fires ONCE per shot regardless (hit or abort) so the
 * fizzle isn't silent.
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

/** Build a shot; castPosition defaults to the target's current cell (what the
 *  ability captures at propose time). */
function shot(
  target: Unit | undefined,
  baseDamage: number,
  critChance: number,
  castPos: GridCoord = target?.position ?? { x: 0, y: 0 },
): CatapultShotAction {
  return new CatapultShotAction(target, baseDamage, critChance, castPos);
}

/** Capture a typed event stream off a fresh world. */
function withEvents(units: Unit[]): {
  w: World;
  attacks: GameEvents['unit:attacked'][];
  fired: GameEvents['catapult:fired'][];
} {
  const bus = new EventBus<GameEvents>();
  const attacks: GameEvents['unit:attacked'][] = [];
  const fired: GameEvents['catapult:fired'][] = [];
  bus.on('unit:attacked', (p) => attacks.push(p));
  bus.on('catapult:fired', (p) => fired.push(p));
  const w = new World(bus, new RNG(1));
  w.units.push(...units);
  return { w, attacks, fired };
}

describe('CatapultShotAction.applyEffect — single heavy hit', () => {
  it('lands full damage on the locked target at impact', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const w = world([caster, target]);

    shot(target, 14, 0).applyEffect(caster, w, 0);

    expect(target.currentHp).toBe(target.derived.maxHp - 14);
  });

  it('start is a no-op — the shot only lands at applyEffect (it is winding up)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const w = world([caster, target]);

    shot(target, 14, 0).start(caster, w);

    expect(target.currentHp).toBe(target.derived.maxHp); // unscathed during the charge
  });

  it('hits ONLY the locked target — a bystander beside it is untouched (single-target)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const bystander = makeUnit('enemy', { x: 6, y: 1 }); // adjacent, but not locked
    const w = world([caster, target, bystander]);

    shot(target, 14, 0).applyEffect(caster, w, 0);

    expect(target.currentHp).toBe(target.derived.maxHp - 14);
    expect(bystander.currentHp).toBe(bystander.derived.maxHp); // no splash
  });

  it('rolls one crit at impact (critChance 1 → critMult damage, crit flag set)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const { w, attacks } = withEvents([caster, target]);

    shot(target, 14, 1).applyEffect(caster, w, 0);

    expect(target.currentHp).toBe(target.derived.maxHp - 14 * STATS.critMult);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.crit).toBe(true);
  });

  it('emits unit:attacked once with the attacker, target, and dealt damage', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const { w, attacks } = withEvents([caster, target]);

    shot(target, 14, 0).applyEffect(caster, w, 0);

    expect(attacks).toEqual([
      { attackerId: caster.id, targetId: target.id, damage: 14, crit: false },
    ]);
  });

  it('credits the XP ledger for the damage dealt', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const w = world([caster, target]);

    shot(target, 14, 0).applyEffect(caster, w, 0);

    expect(w.damageDealtBy(caster.id)).toBe(14);
  });
});

describe('CatapultShotAction.applyEffect — fizzle (target died mid-charge)', () => {
  it('deals no damage, emits no unit:attacked, and makes no combatRng draw', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const corpse = makeUnit('enemy', { x: 6, y: 0 });
    corpse.currentHp = 0; // "died" during the wind-up
    const { w, attacks } = withEvents([caster, corpse]);
    const rngBefore = JSON.stringify(w.combatRng.toJSON());

    shot(corpse, 14, 1).applyEffect(caster, w, 0);

    expect(attacks).toHaveLength(0);
    // The crit roll is skipped on a fizzle (no draw), so combatRng is intact.
    expect(JSON.stringify(w.combatRng.toJSON())).toBe(rngBefore);
  });
});

describe('CatapultShotAction.applyEffect — catapult:fired (always, hit or abort)', () => {
  it('emits hit:true with the LIVE target cell on a hit', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 2 });
    const { w, fired } = withEvents([caster, target]);

    // castPosition deliberately differs from the current cell to prove the
    // hit reports the LIVE (homing) position, not the cast cell.
    shot(target, 14, 0, { x: 9, y: 9 }).applyEffect(caster, w, 0);

    expect(fired).toEqual([{ casterId: caster.id, impact: { x: 6, y: 2 }, hit: true }]);
  });

  it('emits hit:false with the target last cell on an abort (target dead but present)', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const corpse = makeUnit('enemy', { x: 7, y: 3 });
    corpse.currentHp = 0;
    const { w, fired } = withEvents([caster, corpse]);

    shot(corpse, 14, 0, { x: 9, y: 9 }).applyEffect(caster, w, 0);

    expect(fired).toEqual([{ casterId: caster.id, impact: { x: 7, y: 3 }, hit: false }]);
  });

  it('fires exactly once per applyEffect', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const { w, fired } = withEvents([caster, target]);

    shot(target, 14, 0).applyEffect(caster, w, 0);

    expect(fired).toHaveLength(1);
  });
});

describe('CatapultShotAction serialization', () => {
  it('round-trips targetId + damage params + castPosition through toData / fromData', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const w = world([caster, target]);

    const original = shot(target, 14, 0.25, { x: 3, y: 7 });
    const restored = CatapultShotAction.fromData(original.toData(), w);

    expect(restored.toData()).toEqual(original.toData());
    expect(restored.toData().targetId).toBe(target.id);
    expect(restored.toData().castPosition).toEqual({ x: 3, y: 7 });
  });

  it('re-resolves the live target via world.findUnit so a restored shot still lands', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const w = world([caster, target]);

    const restored = CatapultShotAction.fromData(shot(target, 14, 0).toData(), w);
    restored.applyEffect(caster, w, 0);

    expect(target.currentHp).toBe(target.derived.maxHp - 14);
  });

  it('aborts (no throw) after restore when the target is gone, lobbing to the cast cell', () => {
    const caster = makeUnit('player', { x: 0, y: 0 }, 'catapult');
    const target = makeUnit('enemy', { x: 6, y: 0 });
    const { w, fired } = withEvents([caster]); // target absent — findUnit → undefined

    const restored = CatapultShotAction.fromData(
      shot(target, 14, 0, { x: 4, y: 5 }).toData(),
      w,
    );
    expect(() => restored.applyEffect(caster, w, 0)).not.toThrow();
    // No live target → the dud lobs to the serialized cast cell, hit:false.
    expect(fired).toEqual([{ casterId: caster.id, impact: { x: 4, y: 5 }, hit: false }]);
  });
});
