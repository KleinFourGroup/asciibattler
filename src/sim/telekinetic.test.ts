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
 * The telekinetic: a draftable caster whose one ability, Repulse, is a burst
 * on itself that throws every foe beside it away. The expectations are read
 * from the raw config, not from the code under test: the burst's radius, its
 * anchor and its push.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 1, luck: 0, defense: 0,
  speed: 0, mobility: 0, power: 1,
};

interface RawPush { kind: 'push'; cells: number; direction: string; from?: string }
interface RawRepulse {
  minRangeCells?: number;
  target: { kind: string; radius: number; anchor: string; affects: string };
  effects: { op: { kind: string } }[];
}
const repulse = (abilitiesJson as unknown as Record<string, RawRepulse>).repulse!;
const push = repulse.effects.map((e) => e.op).find((op) => op.kind === 'push') as RawPush;
const units = unitsJson as unknown as Record<string, { abilities: string[]; rarity?: string; draftable?: boolean }>;

describe('the telekinetic', () => {
  it('carries Repulse alone, and is drafted at its rarity', () => {
    expect(units.telekinetic!.abilities).toEqual(['repulse']);
    expect(units.telekinetic!.draftable).not.toBe(false);
    expect(units.telekinetic!.rarity).toBe('rare');
    expect(DRAFTABLE_ARCHETYPES).toContain('telekinetic');
  });

  it("closes to its burst: the reach is Repulse's radius, with no floor", () => {
    expect(rangeForArchetype('telekinetic')).toBe(repulse.target.radius);
    expect(minRangeForArchetype('telekinetic')).toBe(repulse.minRangeCells ?? 0);
  });

  it('throws every foe beside it away, and leaves itself, its ally and a farther foe be', () => {
    // The config's shape this layout assumes: a radius-1 burst on the caster
    // that hits enemies and pushes them 2 cells away from it.
    expect(repulse.target).toMatchObject({ kind: 'aoe', radius: 1, anchor: 'caster', affects: 'enemies' });
    expect(push).toMatchObject({ cells: 2, direction: 'away' });
    expect(push.from ?? 'caster').toBe('caster');

    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1), 16, 16);
    const at = { x: 8, y: 8 };
    const tk = world.spawnUnit({ archetype: 'telekinetic', level: 1, stats: BASE, xp: 0 }, 'player', at);
    world.wireSpawned(tk, createMovementBehavior('telekinetic'), true);
    const spawn = (team: 'player' | 'enemy', x: number, y: number) =>
      world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, { x, y });
    // Three foes beside it, an ally beside it, and a foe two cells off on no
    // foe's line of flight. None is wired, so only the burst moves them.
    const east = spawn('enemy', at.x + 1, at.y);
    const north = spawn('enemy', at.x, at.y - 1);
    const southWest = spawn('enemy', at.x - 1, at.y + 1);
    const ally = spawn('player', at.x, at.y + 1);
    const farther = spawn('enemy', at.x + 2, at.y + 2);
    const tkHp = tk.currentHp;

    let impacts = 0;
    bus.on('action:phase', (e) => {
      if (e.unitId === tk.id && e.actionId === 'repulse' && e.phase === 'impact') impacts++;
    });
    for (let i = 0; i < 120 && impacts < 1; i++) world.tick();
    expect(impacts).toBe(1);
    for (let i = 0; i < 20; i++) world.tick(); // the slides land

    const n = push.cells;
    expect(east.position).toEqual({ x: at.x + 1 + n, y: at.y });
    expect(north.position).toEqual({ x: at.x, y: at.y - 1 - n });
    expect(southWest.position).toEqual({ x: at.x - 1 - n, y: at.y + 1 + n });
    expect(tk.position).toEqual(at);
    expect(tk.currentHp).toBe(tkHp);
    expect(ally.position).toEqual({ x: at.x, y: at.y + 1 });
    expect(farther.position).toEqual({ x: at.x + 2, y: at.y + 2 });
  });
});
