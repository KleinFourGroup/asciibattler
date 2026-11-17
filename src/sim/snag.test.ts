import { describe, expect, it } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { UnitStats } from './Unit';
import { createMovementBehavior } from './behaviors/registry';
import { minRangeForArchetype, rangeForArchetype } from './archetypes';
import abilitiesJson from '../../config/abilities.json';
import unitsJson from '../../config/units.json';

/**
 * The pull's first consumer: the adventurer's Snag, a whip crack that drags a
 * foe two or three cells off in beside it, after which the whip takes over.
 * The expectations are read from the raw config, not from the code under test.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 1, ranged: 0, magic: 0, luck: 0, defense: 0,
  speed: 0, mobility: 0, power: 1,
};

const raw = abilitiesJson as Record<string, { rangeCells: number; minRangeCells?: number }>;

describe("the adventurer's Snag", () => {
  it('carries the snag beside the whip', () => {
    expect((unitsJson as unknown as Record<string, { abilities: string[] }>).adventurer!.abilities).toEqual(['whip', 'snag']);
  });

  it("leaves the adventurer's reach its whip's, so it still closes to strike", () => {
    expect(rangeForArchetype('adventurer')).toBe(raw.whip!.rangeCells);
    expect(minRangeForArchetype('adventurer')).toBe(raw.whip!.minRangeCells ?? 0);
  });

  it('drags a foe three cells off in beside it, then whips it there', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1), 16, 16);
    const adv = world.spawnUnit({ archetype: 'adventurer', level: 1, stats: BASE, xp: 0 }, 'player', { x: 2, y: 8 });
    world.wireSpawned(adv, createMovementBehavior('adventurer'), true);
    const foe = world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, 'enemy', { x: 5, y: 8 });
    const impacts: string[] = [];
    bus.on('action:phase', (e) => {
      if (e.unitId === adv.id && e.phase === 'impact') impacts.push(`${e.actionId}@${foe.position.x},${foe.position.y}`);
    });
    for (let i = 0; i < 60 && impacts.length < 2; i++) world.tick();
    // The snag fires on the foe where it stood, and the whip on the cell beside the adventurer.
    expect(impacts.slice(0, 2)).toEqual(['snag@5,8', 'whip@3,8']);
    expect(adv.position).toEqual({ x: 2, y: 8 });
  });
});
