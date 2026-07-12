import { describe, it, expect } from 'vitest';
import { EventBus } from './EventBus';
import type { GameEvents } from './events';

type TestEvents = {
  foo: { x: number };
  bar: { name: string };
};

describe('EventBus', () => {
  it('delivers payload to a subscriber', () => {
    const bus = new EventBus<TestEvents>();
    let received: { x: number } | null = null;
    bus.on('foo', (payload) => {
      received = payload;
    });
    bus.emit('foo', { x: 42 });
    expect(received).toEqual({ x: 42 });
  });

  it('isolates events from each other', () => {
    const bus = new EventBus<TestEvents>();
    let fooCount = 0;
    bus.on('foo', () => {
      fooCount++;
    });
    bus.emit('bar', { name: 'hi' });
    expect(fooCount).toBe(0);
  });

  it('does not invoke a handler after its unsubscribe is called', () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    const off = bus.on('foo', () => {
      count++;
    });
    bus.emit('foo', { x: 1 });
    off();
    bus.emit('foo', { x: 2 });
    expect(count).toBe(1);
  });

  it('delivers to every subscriber on the same event', () => {
    const bus = new EventBus<TestEvents>();
    let a = 0;
    let b = 0;
    bus.on('foo', () => {
      a++;
    });
    bus.on('foo', () => {
      b++;
    });
    bus.emit('foo', { x: 1 });
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('emit is a no-op when no one is subscribed', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit('foo', { x: 1 })).not.toThrow();
  });

  it('snapshot semantics: handlers added during dispatch do not fire this emit', () => {
    const bus = new EventBus<TestEvents>();
    let lateFired = false;
    bus.on('foo', () => {
      bus.on('foo', () => {
        lateFired = true;
      });
    });
    bus.emit('foo', { x: 1 });
    expect(lateFired).toBe(false);
  });

  it('handler can unsubscribe itself during dispatch without breaking iteration', () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    const off = bus.on('foo', () => {
      count++;
      off();
    });
    bus.emit('foo', { x: 1 });
    bus.emit('foo', { x: 2 });
    expect(count).toBe(1);
  });

  it('exceptions from a handler propagate to the caller', () => {
    const bus = new EventBus<TestEvents>();
    bus.on('foo', () => {
      throw new Error('boom');
    });
    expect(() => bus.emit('foo', { x: 1 })).toThrow(/boom/);
  });

  /**
   * Compile-time check: every event in the GameEvents catalog must be
   * emittable with its declared payload shape. If a payload type drifts,
   * this test fails at `tsc --noEmit` before `npm test` ever runs.
   */
  it('GameEvents catalog payloads all type-check', () => {
    const bus = new EventBus<GameEvents>();
    bus.emit('tick', { tick: 1 });
    bus.emit('battle:started', {
      worldSeed: 42,
      encounter: {
        worldSeed: 42,
        terrainSeed: 7,
        layoutId: null,
        gridW: 10,
        gridH: 10,
        theme: 'grassland',
        playerTeam: [],
        enemyTeam: [],
      },
    });
    bus.emit('battle:ended', { winner: 'player', xpAwards: [] });
    bus.emit('unit:spawned', { unitId: 1, instant: true });
    bus.emit('unit:moved', {
      unitId: 1,
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      durationTicks: 5,
    });
    bus.emit('unit:attacked', { attackerId: 1, targetId: 2, damage: 3, crit: false });
    bus.emit('unit:died', { unitId: 1, team: 'player' });
    bus.emit('run:started', { seed: 42 });
    bus.emit('run:nodeEntered', { nodeId: 0 });
    bus.emit('run:victory', {});
    bus.emit('run:defeated', {});
    const stubStats = {
      constitution: 1,
      strength: 1,
      ranged: 1,
      magic: 1,
      luck: 1,
      defense: 1,
      precision: 1,
      evasion: 1,
      speed: 1,
      mobility: 1,
      power: 1,
    };
    bus.emit('recruit:offered', {
      units: [{ archetype: 'mercenary', level: 1, stats: stubStats, xp: 0 }],
    });
    bus.emit('recruit:chosen', {
      unitTemplate: { archetype: 'ranged', level: 1, stats: stubStats, xp: 0 },
    });
    // Reaching this line means every catalog entry compiles.
    expect(true).toBe(true);
  });
});
