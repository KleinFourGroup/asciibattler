import { describe, expect, it } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { UnitStats } from './Unit';
import { createMovementBehavior } from './behaviors/registry';
import { rangeForArchetype } from './archetypes';
import abilitiesJson from '../../config/abilities.json';
import unitsJson from '../../config/units.json';

/**
 * The ronin's whirlwind: a burst on the ronin at every foe around it, on a
 * longer recharge than the katana and over its priority, so the ronin opens
 * with a spin and swings the katana between spins. The expectations are read
 * from the raw config, not from the code under test.
 */

const BASE: UnitStats = {
  constitution: 200, strength: 1, ranged: 0, magic: 0, luck: 0, defense: 0,
  speed: 0, mobility: 0, power: 1,
};

interface RawDef {
  cooldownSeconds: number;
  rangeCells: number;
  priority: number;
  target: { kind: string; radius?: number; anchor?: string; affects?: string };
}
const raw = abilitiesJson as unknown as Record<string, RawDef>;
const whirlwind = raw.whirlwind!;
const katana = raw.katana!;
const units = unitsJson as unknown as Record<string, { abilities: string[] }>;

describe("the ronin's whirlwind", () => {
  it("rides beside the katana, which keeps the ronin's reach", () => {
    expect(units.ronin!.abilities).toEqual(['katana', 'whirlwind']);
    expect(rangeForArchetype('ronin')).toBe(katana.rangeCells);
  });

  it('opens on every foe beside the ronin, none farther, and the katana swings between spins', () => {
    // The premises this layout rests on, from the config: a radius-1 burst on
    // the ronin, outranking the katana and recharging slower.
    expect(whirlwind.target).toMatchObject({ kind: 'aoe', radius: 1, anchor: 'caster', affects: 'enemies' });
    expect(whirlwind.priority).toBeGreaterThan(katana.priority);
    expect(whirlwind.cooldownSeconds).toBeGreaterThan(katana.cooldownSeconds);

    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1), 16, 16);
    const at = { x: 8, y: 8 };
    const ronin = world.spawnUnit({ archetype: 'ronin', level: 1, stats: BASE, xp: 0 }, 'player', at);
    world.wireSpawned(ronin, createMovementBehavior('ronin'), true);
    const foe = (x: number, y: number) =>
      world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, 'enemy', { x, y });
    // Three foes beside it and one two cells off. None is wired.
    const beside = [foe(at.x + 1, at.y), foe(at.x, at.y - 1), foe(at.x - 1, at.y + 1)];
    const farther = foe(at.x + 2, at.y + 2);

    const acts: string[] = [];
    const struck = new Map<string, number[]>();
    let current = '';
    bus.on('action:phase', (e) => {
      if (e.unitId !== ronin.id || e.phase !== 'impact') return;
      current = e.actionId;
      acts.push(e.actionId);
    });
    bus.on('unit:attacked', (e) => {
      if (e.attackerId !== ronin.id) return;
      struck.set(current, [...(struck.get(current) ?? []), e.targetId]);
    });
    for (let i = 0; i < 400 && acts.filter((a) => a === 'whirlwind').length < 2; i++) world.tick();

    expect(acts[0]).toBe('whirlwind');
    expect(acts.lastIndexOf('whirlwind')).toBeGreaterThan(0);
    // The katana swings between the first spin and the second.
    expect(acts.slice(1, acts.lastIndexOf('whirlwind'))).toContain('katana');
    // The first spin struck each foe beside the ronin once, and not the far one.
    const firstSpin = struck.get('whirlwind')!.slice(0, beside.length).sort((a, b) => a - b);
    expect(firstSpin).toEqual(beside.map((u) => u.id).sort((a, b) => a - b));
    expect([...struck.values()].flat()).not.toContain(farther.id);
  });
});
