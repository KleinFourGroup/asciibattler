import { describe, expect, it } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { Unit, UnitStats } from './Unit';
import { createMovementBehavior } from './behaviors/registry';
import { DRAFTABLE_ARCHETYPES, rangeForArchetype } from './archetypes';
import abilitiesJson from '../../config/abilities.json';
import unitsJson from '../../config/units.json';

/**
 * The banshee's Wail as a burst on the banshee: it walks into the line and
 * screams, panicking every foe within its radius of it, and scratches between
 * screams. The expectations are read from the raw config, not from the code
 * under test: the radius, the anchor and the status, and the two abilities'
 * ranks.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  speed: 0, mobility: 0, power: 1,
};

interface RawWail {
  rangeCells: number;
  cooldownSeconds: number;
  priority: number;
  target: { kind: string; radius: number; anchor: string; affects: string };
  timeline: { phase: string; seconds: number | string }[];
  effects: { op: { kind: string; statusId?: string; scaling?: string } }[];
}
const wail = (abilitiesJson as unknown as Record<string, RawWail>).wail!;
const scratch = (abilitiesJson as unknown as Record<string, RawWail>).scratch!;
const units = unitsJson as unknown as Record<string, { abilities: string[] }>;
const status = wail.effects.map((e) => e.op).find((op) => op.kind === 'applyStatus')!.statusId!;
const has = (u: Unit) => u.effects.some((e) => e.key === status);

describe("the banshee's Wail", () => {
  it('stays an enemy alone, and closes to its radius', () => {
    expect(DRAFTABLE_ARCHETYPES).not.toContain('banshee');
    expect(rangeForArchetype('banshee')).toBe(wail.target.radius);
  });

  it('panics every foe within its radius of the banshee, none beyond it, and no ally', () => {
    expect(wail.target).toMatchObject({ kind: 'aoe', anchor: 'caster', affects: 'enemies' });
    const r = wail.target.radius;
    expect(r).toBeGreaterThanOrEqual(2);

    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1), 16, 16);
    const at = { x: 8, y: 8 };
    const banshee = world.spawnUnit({ archetype: 'banshee', level: 1, stats: BASE, xp: 0 }, 'enemy', at);
    world.wireSpawned(banshee, createMovementBehavior('banshee'), true);
    const spawn = (team: 'player' | 'enemy', x: number, y: number) =>
      world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, { x, y });
    // Foes one cell off, at the radius's edge (off the banshee's row) and a
    // cell beyond it; an ally of the banshee's beside it. None is wired.
    const near = spawn('player', at.x + 1, at.y);
    const edge = spawn('player', at.x + 1, at.y - r);
    const beyond = spawn('player', at.x + r + 1, at.y);
    const ally = spawn('enemy', at.x - 1, at.y);

    let impacts = 0;
    bus.on('action:phase', (e) => {
      if (e.unitId === banshee.id && e.actionId === 'wail' && e.phase === 'impact') impacts++;
    });
    for (let i = 0; i < 120 && impacts < 1; i++) world.tick();
    expect(impacts).toBe(1);

    expect(banshee.position).toEqual(at);
    expect(has(near)).toBe(true);
    expect(has(edge)).toBe(true);
    expect(has(beyond)).toBe(false);
    expect(has(ally)).toBe(false);
    expect(has(banshee)).toBe(false);
  });

  it('scratches a foe beside it between Wails, the Wail first', () => {
    // The premises, from the config: the banshee carries both, the Wail
    // outranks the scratch, recharges slower and frees the banshee between
    // casts; the scratch is melee and scales with strength.
    expect(units.banshee!.abilities).toEqual(['scratch', 'wail']);
    expect(scratch.rangeCells).toBe(1);
    expect(scratch.effects.map((e) => e.op)).toContainEqual(expect.objectContaining({ kind: 'damage', scaling: 'strength' }));
    expect(wail.priority).toBeGreaterThan(scratch.priority);
    expect(wail.cooldownSeconds).toBeGreaterThan(scratch.cooldownSeconds);
    expect(typeof wail.timeline.find((p) => p.phase === 'recovery')!.seconds).toBe('number');

    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1), 16, 16);
    const banshee = world.spawnUnit({ archetype: 'banshee', level: 1, stats: BASE, xp: 0 }, 'enemy', { x: 8, y: 8 });
    world.wireSpawned(banshee, createMovementBehavior('banshee'), true);
    // A foe beside it, not wired, so the panic doesn't move it off.
    world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, 'player', { x: 9, y: 8 });

    const acts: string[] = [];
    bus.on('action:phase', (e) => {
      if (e.unitId === banshee.id && e.phase === 'impact') acts.push(e.actionId);
    });
    for (let i = 0; i < 400 && acts.filter((a) => a === 'wail').length < 2; i++) world.tick();

    expect(acts[0]).toBe('wail');
    expect(acts.lastIndexOf('wail')).toBeGreaterThan(0);
    expect(acts.slice(1, acts.lastIndexOf('wail'))).toContain('scratch');
  });
});
