import { describe, it, expect, vi } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { rollUnit } from './archetypes';
import type { GameEvents } from '../core/events';

describe('World (Step 3.1 skeleton)', () => {
  it('starts at tick 0 with an empty unit list', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1));
    expect(w.currentTick).toBe(0);
    expect(w.units).toEqual([]);
  });

  it('uses the default grid size when none is provided', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1));
    expect(w.gridSize).toBe(12);
  });

  it('accepts an explicit grid size', () => {
    const w = new World(new EventBus<GameEvents>(), new RNG(1), 8);
    expect(w.gridSize).toBe(8);
  });

  it('tick() increments the counter and emits `tick` with the new value', () => {
    const bus = new EventBus<GameEvents>();
    const w = new World(bus, new RNG(1));
    const handler = vi.fn();
    bus.on('tick', handler);

    w.tick();
    w.tick();
    w.tick();

    expect(w.currentTick).toBe(3);
    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenNthCalledWith(1, { tick: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, { tick: 2 });
    expect(handler).toHaveBeenNthCalledWith(3, { tick: 3 });
  });
});

describe('World.spawnUnit', () => {
  it('adds the unit to the unit list, assigns it sequential ids, and emits unit:spawned', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const handler = vi.fn();
    bus.on('unit:spawned', handler);

    const a = w.spawnUnit(rollUnit('melee', rng), 'player', { x: 1, y: 2 });
    const b = w.spawnUnit(rollUnit('melee', rng), 'enemy', { x: 3, y: 4 });

    expect(w.units).toEqual([a, b]);
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(a.team).toBe('player');
    expect(b.team).toBe('enemy');
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, { unitId: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, { unitId: 2 });
  });

  it('derives glyph from the template archetype', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const m = w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 });
    const r = w.spawnUnit(rollUnit('ranged', rng), 'player', { x: 1, y: 0 });
    expect(m.glyph).toBe('M');
    expect(r.glyph).toBe('a');
  });
});

describe('World.findUnit', () => {
  it('returns the unit with the given id, or undefined', () => {
    const bus = new EventBus<GameEvents>();
    const rng = new RNG(1);
    const w = new World(bus, rng);
    const a = w.spawnUnit(rollUnit('melee', rng), 'player', { x: 0, y: 0 });
    expect(w.findUnit(a.id)).toBe(a);
    expect(w.findUnit(9999)).toBeUndefined();
  });
});
