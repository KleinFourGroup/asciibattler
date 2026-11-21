import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';
import type { Team, Unit, UnitStats } from './Unit';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { createAbility } from './abilities/registry';
import { STATS } from '../config/stats';

/**
 * The puma's pounce, its expectations read from the raw config files rather
 * than through the parsed catalog: a puma at its pounce's floor from a foe
 * leaps to it and strikes as it lands, with the pounce's might and the
 * puma's strength; one a cell nearer than the floor, and out of its swipe's
 * reach, does not leap. The fox, which shares the swipe, keeps its dash.
 */

const RAW_UNITS = JSON.parse(readFileSync('config/units.json', 'utf8')) as Record<string, { abilities: string[]; baseStats: UnitStats }>;
const RAW_ABILITIES = JSON.parse(readFileSync('config/abilities.json', 'utf8')) as Record<
  string,
  { minRangeCells?: number; rangeCells: number; target: { kind: string }; effects: { op: { kind: string; mode?: string; might?: number } }[] }
>;

const FOE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  speed: 0, mobility: 0, power: 1,
};

function setup() {
  const world = new World(new EventBus<GameEvents>(), new RNG(1), 16, 16);
  /** A puma with its catalog abilities and an ability behaviour, nothing to
   *  move it but its pounce. */
  const puma = (pos: GridCoord): Unit => {
    const u = world.spawnUnit({ archetype: 'puma', level: 1, stats: RAW_UNITS.puma!.baseStats, xp: 0 }, 'enemy', pos);
    for (const id of RAW_UNITS.puma!.abilities) u.abilities.push(createAbility(id));
    u.behaviors.push(new AbilityBehavior());
    return u;
  };
  const foe = (team: Team, pos: GridCoord): Unit =>
    world.spawnUnit({ archetype: 'mercenary', level: 1, stats: FOE, xp: 0 }, team, pos);
  return { world, puma, foe };
}

describe("the puma's pounce, from the raw config", () => {
  const pounce = RAW_ABILITIES.pounce!;
  const floor = pounce.minRangeCells!;

  it('the puma carries the swipe and the pounce, a leap with a hit from a floor of three or more; the fox the swipe and the dash', () => {
    expect(RAW_UNITS.puma!.abilities).toEqual(['swipe', 'pounce']);
    expect(RAW_UNITS.fox!.abilities).toEqual(['swipe', 'dash']);
    expect(pounce.target.kind).toBe('self');
    expect(pounce.effects.map((e) => e.op.kind + (e.op.mode ? `:${e.op.mode}` : ''))).toEqual(['move:advance', 'damage']);
    expect(floor).toBeGreaterThanOrEqual(3);
  });

  it('a puma at its floor from a foe leaps beside it and strikes as it lands', () => {
    const { world, puma, foe } = setup();
    const p = puma({ x: 4, y: 8 });
    const f = foe('player', { x: 4 + floor, y: 8 });
    const hp = f.currentHp;
    for (let i = 0; i < 40 && f.currentHp === hp; i++) world.tick();
    expect(p.position).toEqual({ x: 4 + floor - 1, y: 8 });
    const might = pounce.effects.find((e) => e.op.kind === 'damage')?.op.might;
    expect(might).toBeDefined();
    const base = might! + RAW_UNITS.puma!.baseStats.strength;
    expect([base, Math.round(base * STATS.critMult)]).toContain(hp - f.currentHp);
  });

  it('a puma a cell inside its floor, out of its swipe\'s reach, does not leap', () => {
    const { world, puma, foe } = setup();
    const p = puma({ x: 4, y: 8 });
    foe('player', { x: 4 + floor - 1, y: 8 });
    for (let i = 0; i < 40; i++) world.tick();
    expect(p.position).toEqual({ x: 4, y: 8 });
  });
});
