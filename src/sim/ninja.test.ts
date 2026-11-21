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
 * The ninja, its expectations read from the raw config files: draftable,
 * a one-cell blade and the blink. With its blink ready and a foe across a
 * chasm no route crosses, it walks to the near bank, blinks over within
 * the blink's range and strikes; a rogue in its place, whose dash walks the
 * route, never reaches the foe.
 */

type RawUnit = { abilities: string[]; baseStats: UnitStats; rarity?: string; draftable?: boolean; glyph: string };
type RawAbility = { rangeCells: number; target: { kind: string }; effects: { op: { kind: string; mode?: string; might?: number } }[] };
const RAW_UNITS = JSON.parse(readFileSync('config/units.json', 'utf8')) as Record<string, RawUnit>;
const RAW_ABILITIES = JSON.parse(readFileSync('config/abilities.json', 'utf8')) as Record<string, RawAbility>;
const RAW_ENCOUNTERS = readFileSync('config/encounters.json', 'utf8');

const FOE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  speed: 0, mobility: 0, power: 1,
};

/** A board with a chasm two columns wide (x 6 and 7) from edge to edge. */
function setup() {
  const world = new World(new EventBus<GameEvents>(), new RNG(1), 16, 16);
  for (const x of [6, 7]) for (let y = 0; y < 16; y++) world.tileGrid.setKind({ x, y }, 'chasm');
  /** A unit of `archetype` with its catalog abilities, movement and ability
   *  behaviours, as a battle wires it. */
  const fighter = (archetype: string, pos: GridCoord): Unit => {
    const raw = RAW_UNITS[archetype]!;
    const u = world.spawnUnit({ archetype: archetype as Unit['archetype'], level: 1, stats: raw.baseStats, xp: 0 }, 'player', pos);
    for (const id of raw.abilities) u.abilities.push(createAbility(id));
    u.behaviors.push(createMovementBehavior(archetype as Unit['archetype']), new AbilityBehavior());
    return u;
  };
  const foe = (pos: GridCoord): Unit =>
    world.spawnUnit({ archetype: 'mercenary', level: 1, stats: FOE, xp: 0 }, 'enemy', pos);
  return { world, fighter, foe };
}

describe('the ninja, from the raw config', () => {
  it('is draftable, carries a one-cell blade and the blink, and fights among the Miscreants', () => {
    const ninja = RAW_UNITS.ninja!;
    expect(ninja.draftable).not.toBe(false);
    expect(ninja.glyph).toBe('n');
    expect(ninja.abilities).toHaveLength(2);
    const [blade, blink] = ninja.abilities.map((id) => RAW_ABILITIES[id]!);
    expect(blade!.rangeCells).toBe(1);
    expect(blink!.target.kind).toBe('self');
    expect(blink!.effects.map((e) => e.op.mode)).toEqual(['blink']);
    const miscreants = RAW_ENCOUNTERS.slice(RAW_ENCOUNTERS.indexOf('"id": "miscreants"'));
    expect(miscreants.slice(0, miscreants.indexOf('"id":', 10))).toContain('"archetype": "ninja"');
  });

  it('crosses a chasm with its blink to a foe beyond it, and strikes', () => {
    const { world, fighter, foe } = setup();
    const n = fighter('ninja', { x: 2, y: 8 });
    const f = foe({ x: 10, y: 8 });
    const hp = f.currentHp;
    for (let i = 0; i < 400 && f.currentHp === hp; i++) world.tick();
    expect(n.position.x).toBeGreaterThanOrEqual(9); // across, beside the foe
    const blade = RAW_ABILITIES[RAW_UNITS.ninja!.abilities[0]!]!;
    const might = blade.effects.find((e) => e.op.kind === 'damage')?.op.might;
    expect(might).toBeDefined();
    const base = might! + RAW_UNITS.ninja!.baseStats.strength;
    expect([base, Math.round(base * STATS.critMult)]).toContain(hp - f.currentHp);
  });

  it('a rogue in its place, whose dash walks the route, never reaches the foe', () => {
    const { world, fighter, foe } = setup();
    const r = fighter('rogue', { x: 2, y: 8 });
    const f = foe({ x: 10, y: 8 });
    for (let i = 0; i < 400; i++) world.tick();
    expect(r.position.x).toBeLessThan(6);
    expect(f.currentHp).toBe(f.derived.maxHp);
  });
});
