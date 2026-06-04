import { describe, it, expect } from 'vitest';
import { SwapAction } from './SwapAction';
import { createAction } from './registry';
import { World } from '../World';
import type { UnitStats, UnitTemplate } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';

/**
 * GP5 #5 — SwapAction mechanic. The atomic position exchange that lets a boxed
 * fighter pass a yielding support in a 1-wide corridor (no double-occupancy
 * window). These pin the primitive with explicit inputs (no config / no
 * behavior), so they stay valid regardless of when the healer chooses to swap.
 */

const STATS: UnitStats = {
  constitution: 20, strength: 6, ranged: 0, magic: 0, luck: 0, agility: 5, mobility: 5, defense: 0,
};

function spawn(w: World, x: number, y: number) {
  const tmpl: UnitTemplate = { archetype: 'melee', level: 1, stats: STATS, xp: 0 };
  return w.spawnUnit(tmpl, 'player', { x, y });
}

function makeWorld(bus: EventBus<GameEvents> = new EventBus<GameEvents>()): World {
  return new World(bus, new RNG(1));
}

describe('SwapAction', () => {
  it('atomically exchanges the two units\' positions', () => {
    const w = makeWorld();
    const mover = spawn(w, 5, 5);
    const other = spawn(w, 4, 5);

    new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, other.id, 10).start(mover, w);

    expect(mover.position).toEqual({ x: 4, y: 5 });
    expect(other.position).toEqual({ x: 5, y: 5 });
  });

  it('emits unit:moved for BOTH units (so the renderer lerps each sprite)', () => {
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const mover = spawn(w, 5, 5);
    const other = spawn(w, 4, 5);
    const moves: { unitId: number; from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
    bus.on('unit:moved', (e) => moves.push({ unitId: e.unitId, from: e.from, to: e.to }));

    new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, other.id, 10).start(mover, w);

    expect(moves).toEqual([
      { unitId: mover.id, from: { x: 5, y: 5 }, to: { x: 4, y: 5 } },
      { unitId: other.id, from: { x: 4, y: 5 }, to: { x: 5, y: 5 } },
    ]);
  });

  it('degrades to a plain step when the partner is gone from the target cell', () => {
    // After a snapshot rehydrate the partner could have moved/died; the swap
    // then just relocates the mover onto the (now-free) cell, never desyncing.
    const w = makeWorld();
    const mover = spawn(w, 5, 5); // no unit with id 999 exists

    new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, 999, 10).start(mover, w);

    expect(mover.position).toEqual({ x: 4, y: 5 });
  });

  it('round-trips through the action registry', () => {
    const data = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, 2, 10).toData();
    const rebuilt = createAction('swap', data, makeWorld());
    expect(rebuilt).toBeInstanceOf(SwapAction);
    expect(rebuilt.toData()).toEqual(data);
  });
});
