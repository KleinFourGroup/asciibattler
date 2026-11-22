import { describe, expect, it } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { UnitStats } from './Unit';
import { createMovementBehavior } from './behaviors/registry';
import { DRAFTABLE_ARCHETYPES, minRangeForArchetype, rangeForArchetype } from './archetypes';
import { TICK_RATE } from '../config';
import abilitiesJson from '../../config/abilities.json';
import unitsJson from '../../config/units.json';

/**
 * The ice mage's ice storm as a special over a weak shot, the Icicle: the
 * storm recovers quickly and outranks the shot, so the ice mage shoots a foe
 * in its band between storms rather than standing until the storm
 * recharges. The expectations are read from the raw config, not from the
 * code under test: the storm's reach and floor, the two abilities' ranks and
 * recharges, and the shot's range, floor and scaling.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  speed: 0, mobility: 0, power: 1,
};

interface RawAbility {
  rangeCells: number;
  minRangeCells?: number;
  cooldownSeconds: number;
  priority: number;
  timeline: { phase: string; seconds: number | string }[];
  effects: { op: { kind: string; scaling?: string } }[];
}
const raw = abilitiesJson as unknown as Record<string, RawAbility>;
const storm = raw.ice_storm!;
const icicle = raw.icicle!;
const units = unitsJson as unknown as Record<string, { abilities: string[] }>;

describe("the ice mage's storm over the Icicle", () => {
  it('stays an enemy alone, and keeps the band the storm sets', () => {
    expect(DRAFTABLE_ARCHETYPES).not.toContain('ice_mage');
    // The shot is listed first and reaches as far as the storm, so its floor
    // would set the band's if it differed.
    expect(rangeForArchetype('ice_mage')).toBe(storm.rangeCells);
    expect(minRangeForArchetype('ice_mage')).toBe(storm.minRangeCells);
  });

  it('shoots a foe in its band between storms, the storm first, without moving', () => {
    // The premises, from the config: the ice mage carries both, the shot
    // first; the storm outranks the shot, recharges slower and frees the ice
    // mage between casts; the shot reaches no farther than the storm, holds
    // its floor, and scales on nothing.
    expect(units.ice_mage!.abilities).toEqual(['icicle', 'ice_storm']);
    expect(icicle.rangeCells).toBeLessThanOrEqual(storm.rangeCells);
    expect(icicle.minRangeCells).toBe(storm.minRangeCells);
    expect(icicle.effects.map((e) => e.op)).toContainEqual(expect.objectContaining({ kind: 'damage', scaling: 'none' }));
    expect(storm.priority).toBeGreaterThan(icicle.priority);
    expect(storm.cooldownSeconds).toBeGreaterThan(icicle.cooldownSeconds);
    expect(typeof storm.timeline.find((p) => p.phase === 'recovery')!.seconds).toBe('number');

    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1), 16, 16);
    const at = { x: 8, y: 8 };
    const mage = world.spawnUnit({ archetype: 'ice_mage', level: 1, stats: BASE, xp: 0 }, 'enemy', at);
    world.wireSpawned(mage, createMovementBehavior('ice_mage'), true);
    // A foe three cells off, inside the band; not wired, so it stands.
    world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, 'player', { x: at.x + 3, y: at.y });

    const acts: string[] = [];
    const stormTicks: number[] = [];
    let now = 0;
    bus.on('action:phase', (e) => {
      if (e.unitId !== mage.id || e.phase !== 'impact') return;
      acts.push(e.actionId);
      if (e.actionId === 'ice_storm') stormTicks.push(now);
    });
    for (now = 1; now <= 400 && stormTicks.length < 2; now++) world.tick();

    expect(acts[0]).toBe('ice_storm');
    expect(acts.lastIndexOf('ice_storm')).toBeGreaterThan(0);
    expect(acts.slice(1, acts.lastIndexOf('ice_storm'))).toContain('icicle');
    expect(mage.position).toEqual(at);
    // The shots never delay the storm: it lands again one flat recharge after
    // the first, since a shot frees the ice mage as quickly as the storm does.
    expect((stormTicks[1]! - stormTicks[0]!) / TICK_RATE).toBeCloseTo(storm.cooldownSeconds, 1);
  });
});
