import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { Unit, UnitStats } from './Unit';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { createMovementBehavior } from './behaviors/registry';
import { createAbility } from './abilities/registry';
import { STATS } from '../config/stats';

/**
 * The cavalier, its expectations read from the raw config files: draftable
 * and rare, a one-cell sabre and the charge. Three cells off a foe it rushes
 * to the foe's side, strikes harder for the two cells it ran and knocks the
 * foe a cell back, then closes and fights with the sabre; two cells off it
 * never charges. A wolf, whose harry springs back from a foe beside it,
 * takes the blow, since the cavalier arrives only as it strikes.
 */

type RawOp = { kind: string; mode?: string; might?: number; mightPerCell?: number; cells?: number; direction?: string };
type RawUnit = { abilities: string[]; baseStats: UnitStats; rarity?: string; draftable?: boolean; glyph: string };
type RawAbility = { rangeCells: number; minRangeCells?: number; target: { kind: string }; effects: { op: RawOp }[] };
const RAW_UNITS = JSON.parse(readFileSync('config/units.json', 'utf8')) as Record<string, RawUnit>;
const RAW_ABILITIES = JSON.parse(readFileSync('config/abilities.json', 'utf8')) as Record<string, RawAbility>;
const RAW_ENCOUNTERS = readFileSync('config/encounters.json', 'utf8');

const CAVALIER = RAW_UNITS.cavalier!;
const [SABRE, CHARGE] = CAVALIER.abilities.map((id) => RAW_ABILITIES[id]!);
const STRENGTH = CAVALIER.baseStats.strength;
const damageOp = (a: RawAbility): RawOp => a.effects.find((e) => e.op.kind === 'damage')!.op;

const FOE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  speed: 0, mobility: 0, power: 1,
};

/** An open board, a cavalier wired as a battle wires it and a foe with no
 *  behaviours of its own, every blow and shove recorded. */
function setup(cavalierAt: GridCoord, foeAt: GridCoord) {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1), 16, 16);
  const c = world.spawnUnit({ archetype: 'cavalier' as Unit['archetype'], level: 1, stats: CAVALIER.baseStats, xp: 0 }, 'player', cavalierAt);
  for (const id of CAVALIER.abilities) c.abilities.push(createAbility(id));
  c.behaviors.push(createMovementBehavior('cavalier' as Unit['archetype']), new AbilityBehavior());
  const f = world.spawnUnit({ archetype: 'mercenary', level: 1, stats: FOE, xp: 0 }, 'enemy', foeAt);
  const blows: { damage: number; crit: boolean; from: GridCoord; foe: GridCoord }[] = [];
  bus.on('unit:attacked', (e) => {
    if (e.attackerId === c.id && e.targetId === f.id) {
      blows.push({ damage: e.damage, crit: e.crit, from: { ...c.position }, foe: { ...f.position } });
    }
  });
  const shoved: { from: GridCoord; to: GridCoord }[] = [];
  bus.on('unit:shoved', (e) => {
    if (e.unitId === f.id) shoved.push({ from: e.from, to: e.to });
  });
  return { world, c, f, blows, shoved };
}

/** A blow's damage on a foe with no defense: `base`, or its crit. */
const dealt = (base: number, crit: boolean): number => (crit ? Math.round(base * STATS.critMult) : base);

describe('the cavalier, from the raw config', () => {
  it('is draftable and rare, carries a one-cell sabre and the charge, and rides with the Warband Vanguard', () => {
    expect(CAVALIER.draftable).not.toBe(false);
    expect(CAVALIER.rarity).toBe('rare');
    expect(CAVALIER.glyph.codePointAt(0)).toBe(0xe022);
    expect(CAVALIER.abilities).toHaveLength(2);
    expect(SABRE!.rangeCells).toBe(1);
    expect(CHARGE!.target.kind).toBe('enemyInRange');
    expect(CHARGE!.effects.map((e) => e.op.kind)).toEqual(['move', 'damage', 'push']);
    expect(CHARGE!.effects[0]!.op.mode).toBe('charge');
    expect(CHARGE!.minRangeCells).toBe(3);
    const vanguard = RAW_ENCOUNTERS.slice(RAW_ENCOUNTERS.indexOf('"id": "warband-vanguard"'));
    expect(vanguard.slice(0, vanguard.indexOf('"id":', 10))).toContain('"archetype": "cavalier"');
  });

  it('three cells off, charges, strikes for the cells it ran and knocks its foe back, then fights with the sabre', () => {
    const { world, f, blows, shoved } = setup({ x: 2, y: 8 }, { x: 5, y: 8 });
    for (let i = 0; i < 200 && blows.length < 3; i++) world.tick();
    expect(blows.length).toBe(3);
    // The charge: from beside the foe, two cells run (x 2 to 4).
    const [rush, ...swings] = blows;
    expect(rush!.from).toEqual({ x: 4, y: 8 });
    const op = damageOp(CHARGE!);
    expect(op.mightPerCell).toBeDefined();
    expect(rush!.damage).toBe(dealt(op.might! + 2 * op.mightPerCell! + STRENGTH, rush!.crit));
    // The knockback: the foe a cell farther along the line.
    const push = CHARGE!.effects.find((e) => e.op.kind === 'push')!.op;
    expect(shoved).toEqual([{ from: { x: 5, y: 8 }, to: { x: 5 + push.cells!, y: 8 } }]);
    // Then melee: beside the foe, at the sabre's damage.
    const sabre = damageOp(SABRE!).might! + STRENGTH;
    for (const s of swings) {
      expect(Math.max(Math.abs(s.from.x - s.foe.x), Math.abs(s.from.y - s.foe.y))).toBe(1);
      expect(s.damage).toBe(dealt(sabre, s.crit));
    }
    expect(f.position).toEqual({ x: 5 + push.cells!, y: 8 });
  });

  it("charges a wolf walking in, and the blow lands: the wolf's harry cannot spring away first", () => {
    for (const start of [7, 8, 9, 10]) {
      const bus = new EventBus<GameEvents>();
      const world = new World(bus, new RNG(1), 16, 16);
      const wire = (archetype: string, team: 'player' | 'enemy', x: number): Unit => {
        const raw = RAW_UNITS[archetype]!;
        const u = world.spawnUnit({ archetype: archetype as Unit['archetype'], level: 1, stats: raw.baseStats, xp: 0 }, team, { x, y: 8 });
        for (const id of raw.abilities) u.abilities.push(createAbility(id));
        u.behaviors.push(createMovementBehavior(archetype as Unit['archetype']), new AbilityBehavior());
        return u;
      };
      const c = wire('cavalier', 'player', 2);
      const wolf = wire('wolf', 'enemy', start);
      let rushed = false;
      let landed = false;
      bus.on('unit:shoved', (e) => {
        if (e.unitId === c.id) rushed = true;
      });
      bus.on('unit:attacked', (e) => {
        if (e.attackerId === c.id && e.targetId === wolf.id && c.activeAction?.action.id === 'charge') landed = true;
      });
      for (let i = 0; i < 200 && !landed && (!rushed || c.activeAction?.action.id === 'charge'); i++) world.tick();
      expect(rushed, `from ${start}`).toBe(true);
      expect(landed, `from ${start}`).toBe(true);
    }
  });

  it('two cells off, never charges: it steps in and swings the sabre', () => {
    const { world, blows, shoved } = setup({ x: 2, y: 8 }, { x: 4, y: 8 });
    for (let i = 0; i < 200 && blows.length < 2; i++) world.tick();
    expect(blows.length).toBe(2);
    const sabre = damageOp(SABRE!).might! + STRENGTH;
    for (const b of blows) expect(b.damage).toBe(dealt(sabre, b.crit));
    expect(shoved).toEqual([]);
  });
});
