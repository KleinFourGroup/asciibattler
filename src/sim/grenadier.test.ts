import { describe, expect, it } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { UnitStats } from './Unit';
import { createMovementBehavior } from './behaviors/registry';
import { DRAFTABLE_ARCHETYPES, minRangeForArchetype, rangeForArchetype } from './archetypes';
import abilitiesJson from '../../config/abilities.json';
import unitsJson from '../../config/units.json';

/**
 * The grenadier: a draftable thrower whose grenade blasts the cells around
 * its target and knocks every foe there a cell away from the blast's centre.
 * The expectations are read from the raw config, not from the code under
 * test: the grenade's reach, floor, radius and push.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 1, magic: 0, luck: 0, defense: 0,
  speed: 0, mobility: 0, power: 1,
};

interface RawPush { kind: 'push'; cells: number; direction: string; from?: string }
interface RawGrenade {
  rangeCells: number;
  minRangeCells: number;
  target: { kind: string; radius: number; anchor: string };
  effects: { op: { kind: string } }[];
}
const grenade = (abilitiesJson as unknown as Record<string, RawGrenade>).grenade!;
const push = grenade.effects.map((e) => e.op).find((op) => op.kind === 'push') as RawPush;
const units = unitsJson as unknown as Record<string, { abilities: string[]; rarity?: string; draftable?: boolean }>;

describe('the grenadier', () => {
  it('carries the grenade, and is drafted at its rarity', () => {
    expect(units.grenadier!.abilities).toEqual(['grenade']);
    expect(units.grenadier!.draftable).not.toBe(false);
    expect(units.grenadier!.rarity).toBe('uncommon');
    expect(DRAFTABLE_ARCHETYPES).toContain('grenadier');
  });

  it('holds off at its throw: the grenade sets its reach and floor', () => {
    expect(rangeForArchetype('grenadier')).toBe(grenade.rangeCells);
    expect(minRangeForArchetype('grenadier')).toBe(grenade.minRangeCells);
  });

  it("knocks each foe in the blast a cell out from its centre, the centre's foe away from the thrower", () => {
    // The config's shape this layout assumes: a radius-1 blast on the target's
    // cell, pushing 1 cell away from its centre.
    expect(grenade.target).toMatchObject({ kind: 'aoe', radius: 1, anchor: 'targetCell' });
    expect(push).toMatchObject({ cells: 1, direction: 'away', from: 'center' });

    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1), 16, 16);
    const thrower = world.spawnUnit({ archetype: 'grenadier', level: 1, stats: BASE, xp: 0 }, 'player', { x: 2, y: 8 });
    world.wireSpawned(thrower, createMovementBehavior('grenadier'), true);
    // The target four cells east, at the grenade's reach, with foes on the
    // three ring cells beyond it, each a cell farther from the thrower, and one
    // due north of it, as near but off the thrower's row, so `nearest` takes
    // the target. The north foe tells a push from the centre (straight north)
    // from one from the thrower (north-east). Nothing else moves them: they
    // are not wired.
    const at = { x: 2 + grenade.rangeCells, y: 8 };
    const foe = (x: number, y: number) =>
      world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, 'enemy', { x, y });
    const centre = foe(at.x, at.y);
    const north = foe(at.x, at.y - 1);
    const northEast = foe(at.x + 1, at.y - 1);
    const east = foe(at.x + 1, at.y);
    const southEast = foe(at.x + 1, at.y + 1);

    let impacts = 0;
    bus.on('action:phase', (e) => {
      if (e.unitId === thrower.id && e.actionId === 'grenade' && e.phase === 'impact') impacts++;
    });
    for (let i = 0; i < 120 && impacts < 1; i++) world.tick();
    expect(impacts).toBe(1);
    for (let i = 0; i < 20; i++) world.tick(); // the slides land

    expect(thrower.position).toEqual({ x: 2, y: 8 });
    // The ring, each a cell further along its own line from the centre.
    expect(north.position).toEqual({ x: at.x, y: at.y - 1 - push.cells });
    expect(northEast.position).toEqual({ x: at.x + 1 + push.cells, y: at.y - 1 - push.cells });
    expect(east.position).toEqual({ x: at.x + 1 + push.cells, y: at.y });
    expect(southEast.position).toEqual({ x: at.x + 1 + push.cells, y: at.y + 1 + push.cells });
    // The centre's foe goes away from the thrower, into the cell the east foe
    // left: the farthest move first.
    expect(centre.position).toEqual({ x: at.x + push.cells, y: at.y });
  });
});
