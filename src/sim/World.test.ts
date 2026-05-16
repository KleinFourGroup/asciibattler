import { describe, it, expect, vi } from 'vitest';
import { World } from './World';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
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
