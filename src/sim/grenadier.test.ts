import { describe, expect, it } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { UnitStats } from './Unit';
import { createMovementBehavior } from './behaviors/registry';
import { DRAFTABLE_ARCHETYPES, minRangeForArchetype, rangeForArchetype } from './archetypes';
import abilitiesJson from '../../config/abilities.json';
import statusesJson from '../../config/statuses.json';
import unitsJson from '../../config/units.json';
import type { Unit } from './Unit';

/**
 * The grenadier: a draftable thrower whose grenade blasts the cells around
 * its target, knocks every foe there a cell away from the blast's centre and
 * stuns them, then frees the thrower to move between throws. The
 * expectations are read from the raw config, not from the code under test:
 * the grenade's reach, floor, radius, push, status and recovery.
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
  timeline: { phase: string; seconds: number | string }[];
  effects: { op: { kind: string; statusId?: string } }[];
}
const grenade = (abilitiesJson as unknown as Record<string, RawGrenade>).grenade!;
const push = grenade.effects.map((e) => e.op).find((op) => op.kind === 'push') as RawPush;
const stunId = grenade.effects.map((e) => e.op).find((op) => op.kind === 'applyStatus')?.statusId;
const stun = (statusesJson as unknown as Record<string, { durationSeconds: number; behavior?: Record<string, unknown> }>)[
  stunId ?? ''
];
const units = unitsJson as unknown as Record<
  string,
  { abilities: string[]; rarity?: string; draftable?: boolean; baseStats: UnitStats }
>;
const TICKS_PER_SECOND = 20;
const stunned = (u: Unit) => u.effects.some((e) => e.key === stunId);

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
    let thrownFrom: { x: number; y: number } | undefined;
    bus.on('action:phase', (e) => {
      if (e.unitId === thrower.id && e.actionId === 'grenade' && e.phase === 'impact') {
        impacts++;
        thrownFrom = { ...thrower.position };
      }
    });
    for (let i = 0; i < 120 && impacts < 1; i++) world.tick();
    expect(impacts).toBe(1);
    for (let i = 0; i < 20; i++) world.tick(); // the slides land

    // Thrown from where it stood; after it, the thrower is free to move.
    expect(thrownFrom).toEqual({ x: 2, y: 8 });
    // The ring, each a cell further along its own line from the centre.
    expect(north.position).toEqual({ x: at.x, y: at.y - 1 - push.cells });
    expect(northEast.position).toEqual({ x: at.x + 1 + push.cells, y: at.y - 1 - push.cells });
    expect(east.position).toEqual({ x: at.x + 1 + push.cells, y: at.y });
    expect(southEast.position).toEqual({ x: at.x + 1 + push.cells, y: at.y + 1 + push.cells });
    // The centre's foe goes away from the thrower, into the cell the east foe
    // left: the farthest move first.
    expect(centre.position).toEqual({ x: at.x + push.cells, y: at.y });
  });

  it("stuns every foe in the blast, moved or not, for the status's time, and no one beyond it", () => {
    expect(stun, 'the grenade applies a status from the catalog').toBeDefined();
    expect(stun!.behavior).toMatchObject({ preventsAttack: true, preventsMove: true });
    expect(grenade.target).toMatchObject({ kind: 'aoe', radius: 1, anchor: 'targetCell' });

    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1), 16, 16);
    const thrower = world.spawnUnit({ archetype: 'grenadier', level: 1, stats: BASE, xp: 0 }, 'player', { x: 2, y: 8 });
    world.wireSpawned(thrower, createMovementBehavior('grenadier'), true);
    const at = { x: 2 + grenade.rangeCells, y: 8 };
    const foe = (x: number, y: number) =>
      world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, 'enemy', { x, y });
    const centre = foe(at.x, at.y);
    const east = foe(at.x + 1, at.y);
    // The north foe can't be knocked: a foe stands on the cell beyond it,
    // outside the blast. A far foe stands well clear.
    const north = foe(at.x, at.y - 1);
    const blocker = foe(at.x, at.y - 2);
    const far = foe(at.x, at.y + 5);

    let impactTick = -1;
    bus.on('action:phase', (e) => {
      if (e.unitId === thrower.id && e.actionId === 'grenade' && e.phase === 'impact' && impactTick < 0) {
        impactTick = world.currentTick;
      }
    });
    for (let i = 0; i < 120 && impactTick < 0; i++) world.tick();
    expect(impactTick).toBeGreaterThanOrEqual(0);

    const northAt = { ...north.position };
    for (const u of [centre, east, north]) expect(stunned(u)).toBe(true);
    for (const u of [blocker, far, thrower]) expect(stunned(u)).toBe(false);
    expect(north.position).toEqual(northAt);

    // Still stunned just short of the status's time, gone just past it.
    const ticks = stun!.durationSeconds * TICKS_PER_SECOND;
    while (world.currentTick < impactTick + ticks - 2) world.tick();
    expect(stunned(north)).toBe(true);
    while (world.currentTick < impactTick + ticks + 2) world.tick();
    expect(stunned(north)).toBe(false);
  });

  it('falls back from a foe beside it soon after a grenade lands, rather than standing out the recharge', () => {
    const recovery = grenade.timeline.find((p) => p.phase === 'recovery')!.seconds;
    expect(typeof recovery, 'a fixed recovery, not the whole recharge').toBe('number');

    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1), 16, 16);
    const stats = units.grenadier!.baseStats;
    const thrower = world.spawnUnit({ archetype: 'grenadier', level: 1, stats, xp: 0 }, 'player', { x: 4, y: 8 });
    world.wireSpawned(thrower, createMovementBehavior('grenadier'), true);
    const target = world.spawnUnit(
      { archetype: 'mercenary', level: 1, stats: BASE, xp: 0 },
      'enemy',
      { x: 4 + grenade.minRangeCells + 1, y: 8 },
    );

    let impactTick = -1;
    bus.on('action:phase', (e) => {
      if (e.unitId === thrower.id && e.actionId === 'grenade' && e.phase === 'impact' && impactTick < 0) {
        impactTick = world.currentTick;
      }
    });
    for (let i = 0; i < 120 && impactTick < 0; i++) world.tick();
    expect(impactTick).toBeGreaterThanOrEqual(0);
    expect(target.currentHp).toBeGreaterThan(0);

    // A foe steps in beside the thrower, inside its floor. Not wired, so it
    // stands; the thrower must move off it.
    const from = { ...thrower.position };
    const inside = world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, 'enemy', {
      x: from.x - 1,
      y: from.y,
    });
    const gap = () =>
      Math.max(Math.abs(thrower.position.x - inside.position.x), Math.abs(thrower.position.y - inside.position.y));
    expect(gap()).toBe(1);
    const by = impactTick + Math.round(((recovery as number) + 0.5) * TICKS_PER_SECOND);
    while (world.currentTick < by && gap() < grenade.minRangeCells) world.tick();
    expect(gap(), 'back at its floor within its recovery and half a second').toBeGreaterThanOrEqual(
      grenade.minRangeCells,
    );
  });
});
