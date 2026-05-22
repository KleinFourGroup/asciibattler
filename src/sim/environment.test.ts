import { describe, it, expect } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { findTarget } from './Targeting';
import { Unit, type UnitStats } from './Unit';
import { WALL_GLYPH, spawnWall } from './environment';
import type { GameEvents } from '../core/events';

describe('environment / spawnWall', () => {
  it('spawns as a neutral-team unit with the wall glyph', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const wall = spawnWall(w, { x: 5, y: 5 });

    expect(wall.team).toBe('neutral');
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

    expect(events).toEqual([{ unitId: wall.id }]);
  });

  it('is never picked as a target by findTarget', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const stats: UnitStats = {
      maxHp: 50,
      attackDamage: 10,
      attackRange: 1,
      attackCooldownTicks: 8,
      moveCooldownTicks: 5,
    };
    const player = new Unit({ id: 1, team: 'player', glyph: 'M', stats, position: { x: 0, y: 0 } });
    w.units.push(player);
    spawnWall(w, { x: 1, y: 1 }); // closer than any enemy
    const enemy = new Unit({ id: 3, team: 'enemy', glyph: 'M', stats, position: { x: 5, y: 5 } });
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
    expect(restored.units[0]!.glyph).toBe(WALL_GLYPH);
    expect(restored.units[0]!.position).toEqual({ x: 2, y: 3 });
    expect(restored.units[1]!.position).toEqual({ x: 4, y: 5 });
  });
});
