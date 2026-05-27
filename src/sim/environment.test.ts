import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { findTarget } from './Targeting';
import { Unit } from './Unit';
import { WALL_GLYPH, spawnWall } from './environment';
import { deriveStats } from './stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import type { GameEvents } from '../core/events';

describe('environment / spawnWall', () => {
  it('spawns as a neutral-team unit with the wall glyph', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const wall = spawnWall(w, { x: 5, y: 5 });

    expect(wall.team).toBe('neutral');
    expect(wall.archetype).toBe('environment');
    expect(wall.glyph).toBe(WALL_GLYPH);
    expect(wall.position).toEqual({ x: 5, y: 5 });
    expect(wall.behaviors).toEqual([]);
    expect(wall.activeAction).toBeNull();
  });

  it('emits unit:spawned just like a combatant', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const events: GameEvents['unit:spawned'][] = [];
    bus.on('unit:spawned', (p) => events.push(p));

    const wall = spawnWall(w, { x: 0, y: 0 });

    expect(events).toEqual([{ unitId: wall.id, instant: true }]);
  });

  it('is never picked as a target by findTarget', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const stats = { ...ARCHETYPE_CONFIG.melee.baseStats };
    const derived = deriveStats(stats, 1);
    const player = new Unit({
      id: 1,
      team: 'player',
      archetype: 'melee',
      glyph: 'M',
      stats,
      derived,
      position: { x: 0, y: 0 },
    });
    w.units.push(player);
    spawnWall(w, { x: 1, y: 1 }); // closer than any enemy
    const enemy = new Unit({
      id: 3,
      team: 'enemy',
      archetype: 'melee',
      glyph: 'M',
      stats,
      derived,
      position: { x: 5, y: 5 },
    });
    w.units.push(enemy);

    expect(findTarget(player, w)?.id).toBe(enemy.id);
  });

  it('walls round-trip through the World snapshot path', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    spawnWall(w, { x: 2, y: 3 });
    spawnWall(w, { x: 4, y: 5 });

    const snap = w.toJSON();
    const restored = World.fromJSON(snap, new EventBus<GameEvents>());

    expect(restored.units).toHaveLength(2);
    expect(restored.units[0]!.team).toBe('neutral');
    expect(restored.units[0]!.archetype).toBe('environment');
    expect(restored.units[0]!.glyph).toBe(WALL_GLYPH);
    expect(restored.units[0]!.position).toEqual({ x: 2, y: 3 });
    expect(restored.units[1]!.position).toEqual({ x: 4, y: 5 });
  });

  it('spawns with the requested maxHp (E1: lives on derived, not stats)', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const wall = spawnWall(w, { x: 1, y: 1 }, 5);
    expect(wall.derived.maxHp).toBe(5);
    expect(wall.currentHp).toBe(5);
  });

  it('removes a wall when its HP drops to 0 and emits unit:died with team neutral', () => {
    // Nothing in the current codebase targets walls (Targeting filters
    // neutrals), so this test exercises the path E2's AoE damage will
    // light up: drop wall HP from outside, advance a tick, expect the
    // wall to be cleaned up just like any other dying Unit.
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const deaths: GameEvents['unit:died'][] = [];
    bus.on('unit:died', (p) => deaths.push(p));

    const wall = spawnWall(w, { x: 3, y: 3 }, 5);
    wall.currentHp = 0;

    w.tick();

    expect(w.findUnit(wall.id)).toBeUndefined();
    expect(deaths).toEqual([{ unitId: wall.id, team: 'neutral' }]);
  });
});
