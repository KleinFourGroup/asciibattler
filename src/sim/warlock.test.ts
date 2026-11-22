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
 * The warlock's hex as a special over a weak shot, the Jinx: the hex recovers
 * quickly and outranks the shot, so the warlock shoots a foe in its band
 * between hexes rather than standing until the hex recharges. The
 * expectations are read from the raw config, not from the code under test:
 * the hex's reach and floor, the two abilities' ranks and recharges, and the
 * shot's range, floor and scaling.
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
const hex = raw.hex!;
const jinx = raw.jinx!;
const units = unitsJson as unknown as Record<string, { abilities: string[] }>;

describe("the warlock's hex over the Jinx", () => {
  it('stays an enemy alone, and keeps the band the hex sets', () => {
    expect(DRAFTABLE_ARCHETYPES).not.toContain('warlock');
    // The shot is listed first and reaches as far as the hex, so its floor
    // would set the band's if it differed.
    expect(rangeForArchetype('warlock')).toBe(hex.rangeCells);
    expect(minRangeForArchetype('warlock')).toBe(hex.minRangeCells);
  });

  it('shoots a foe in its band between hexes, the hex first, without moving', () => {
    // The premises, from the config: the warlock carries both, the shot
    // first; the hex outranks the shot, recharges slower and frees the
    // warlock between casts; the shot reaches no farther than the hex, holds
    // its floor, and scales on nothing.
    expect(units.warlock!.abilities).toEqual(['jinx', 'hex']);
    expect(jinx.rangeCells).toBeLessThanOrEqual(hex.rangeCells);
    expect(jinx.minRangeCells).toBe(hex.minRangeCells);
    expect(jinx.effects.map((e) => e.op)).toContainEqual(expect.objectContaining({ kind: 'damage', scaling: 'none' }));
    expect(hex.priority).toBeGreaterThan(jinx.priority);
    expect(hex.cooldownSeconds).toBeGreaterThan(jinx.cooldownSeconds);
    expect(typeof hex.timeline.find((p) => p.phase === 'recovery')!.seconds).toBe('number');

    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1), 16, 16);
    const at = { x: 8, y: 8 };
    const warlock = world.spawnUnit({ archetype: 'warlock', level: 1, stats: BASE, xp: 0 }, 'enemy', at);
    world.wireSpawned(warlock, createMovementBehavior('warlock'), true);
    // A foe three cells off, inside the band; not wired, so the confusion
    // doesn't walk it about.
    world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, 'player', { x: at.x + 3, y: at.y });

    const acts: string[] = [];
    const hexTicks: number[] = [];
    let now = 0;
    bus.on('action:phase', (e) => {
      if (e.unitId !== warlock.id || e.phase !== 'impact') return;
      acts.push(e.actionId);
      if (e.actionId === 'hex') hexTicks.push(now);
    });
    for (now = 1; now <= 400 && hexTicks.length < 2; now++) world.tick();

    expect(acts[0]).toBe('hex');
    expect(acts.lastIndexOf('hex')).toBeGreaterThan(0);
    expect(acts.slice(1, acts.lastIndexOf('hex'))).toContain('jinx');
    expect(warlock.position).toEqual(at);
    // The shots never delay the hex: it lands again one flat recharge after
    // the first, since a shot frees the warlock as quickly as the hex does.
    expect((hexTicks[1]! - hexTicks[0]!) / TICK_RATE).toBeCloseTo(hex.cooldownSeconds, 1);
  });
});
