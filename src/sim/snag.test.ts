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

  /**
   * The adventurer at (2,8), its foe three cells east at (5,8), and an idle
   * ally of the adventurer's on `allyAt`. The pull's walk goes west from the
   * foe: its first cell is (4,8), its second (3,8). Returns the adventurer's
   * actions in order, `move` for a step and `snag@x,y` for a snag's impact
   * with the foe's cell then, and every cell the foe was shoved to.
   */
  function snagWithAllyAt(allyAt: { x: number; y: number }) {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1), 16, 16);
    const adv = world.spawnUnit({ archetype: 'adventurer', level: 1, stats: BASE, xp: 0 }, 'player', { x: 2, y: 8 });
    world.wireSpawned(adv, createMovementBehavior('adventurer'), true);
    world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, 'player', allyAt);
    const foe = world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, 'enemy', { x: 5, y: 8 });
    const acts: string[] = [];
    const shovedTo: string[] = [];
    bus.on('unit:moved', (e) => {
      if (e.unitId === adv.id) acts.push('move');
    });
    bus.on('action:phase', (e) => {
      if (e.unitId === adv.id && e.phase === 'impact' && e.actionId === 'snag') acts.push(`snag@${foe.position.x},${foe.position.y}`);
    });
    bus.on('unit:shoved', (e) => {
      if (e.unitId === foe.id) shovedTo.push(`${e.to.x},${e.to.y}`);
    });
    for (let i = 0; i < 60 && acts.length < 1; i++) world.tick();
    for (let i = 0; i < 20; i++) world.tick();
    return { acts, shovedTo };
  }

  it("holds the snag while its pull's first cell is taken, and steps instead", () => {
    // An ally on (4,8): the pull would drag nothing, so the snag waits and the
    // adventurer's first act is a step toward its foe.
    const { acts } = snagWithAllyAt({ x: 4, y: 8 });
    expect(acts[0]).toBe('move');
  });

  it('still snags when only the second cell is taken, and drags the foe one cell', () => {
    // An ally on (3,8): the first cell is free, so the snag fires where the foe
    // stands and the walk ends on (4,8), short of the ally.
    const { acts, shovedTo } = snagWithAllyAt({ x: 3, y: 8 });
    expect(acts[0]).toBe('snag@5,8');
    expect(shovedTo).toEqual(['4,8']);
  });
});
