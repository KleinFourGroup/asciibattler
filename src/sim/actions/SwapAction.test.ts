import { describe, it, expect } from 'vitest';
import { SwapAction, isReservedSwapPartner, isSwappablePartner } from './SwapAction';
import { MoveAction } from './MoveAction';
import { createAction } from './registry';
import { World } from '../World';
import type { Unit, UnitStats, UnitTemplate } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';

/**
 * GP5 #5 / 56c2 — SwapAction, the DEFERRED atomic position exchange (§36b
 * twin): `start` emits the render event only; the logical exchange lands in
 * `applyEffect` at the impact boundary, where all validation now lives (a
 * live-tick propose→start is synchronous behind the proposers' own gates, and
 * a rehydrated action never re-runs `start` — the flip is the one place stale
 * state can appear). These pin the primitive with explicit inputs (no config
 * / no behavior), so they stay valid regardless of who proposes the swap.
 */

const STATS: UnitStats = {
  constitution: 20, strength: 6, ranged: 0, magic: 0, luck: 0, defense: 0, precision: 5, evasion: 5, speed: 5, mobility: 5, power: 1,
};

function spawn(w: World, x: number, y: number) {
  const tmpl: UnitTemplate = { archetype: 'mercenary', level: 1, stats: STATS, xp: 0 };
  return w.spawnUnit(tmpl, 'player', { x, y });
}

function makeWorld(bus: EventBus<GameEvents> = new EventBus<GameEvents>()): World {
  return new World(bus, new RNG(1));
}

/** Seat `unit` mid-move to `to` the way World.executeActions does — active
 *  action + destination claim, pre-flip (the movement.test.ts §45a helper). */
function seatMove(world: World, unit: Unit, to: { x: number; y: number }, travel: number) {
  const durationTicks = travel * 2;
  unit.activeAction = {
    action: new MoveAction(unit.position, to, durationTicks),
    startTick: world.currentTick,
    finishTick: world.currentTick + durationTicks,
    phases: [
      { phase: 'travel', ticks: travel },
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: durationTicks - travel },
    ],
  };
  world.claimCell(to, unit.id);
}

/** Seat an in-flight PRE-FLIP swap on `actor` (the 56c2 deferred timeline). */
function seatSwap(world: World, actor: Unit, action: SwapAction, durationTicks: number) {
  const travel = Math.floor(durationTicks / 2);
  actor.activeAction = {
    action,
    startTick: world.currentTick,
    finishTick: world.currentTick + durationTicks,
    phases: [
      { phase: 'travel', ticks: travel },
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: durationTicks - travel },
    ],
  };
}

describe('SwapAction (deferred, 56c2)', () => {
  it('start emits ONE unit:swapped and moves NOBODY (the flip is deferred)', () => {
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const mover = spawn(w, 5, 5);
    const other = spawn(w, 4, 5);
    const swaps: GameEvents['unit:swapped'][] = [];
    const moves: GameEvents['unit:moved'][] = [];
    bus.on('unit:swapped', (e) => swaps.push(e));
    bus.on('unit:moved', (e) => moves.push(e));

    new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, other.id, 10).start(mover, w);

    expect(mover.position).toEqual({ x: 5, y: 5 }); // still pre-flip
    expect(other.position).toEqual({ x: 4, y: 5 });
    expect(moves).toEqual([]);
    expect(swaps).toEqual([
      { unitA: mover.id, unitB: other.id, cellA: { x: 5, y: 5 }, cellB: { x: 4, y: 5 }, durationTicks: 10 },
    ]);
  });

  it('applyEffect performs the atomic exchange (silent — the start event promised it)', () => {
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const mover = spawn(w, 5, 5);
    const other = spawn(w, 4, 5);
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, other.id, 10);
    action.start(mover, w);
    const events: string[] = [];
    bus.on('unit:moved', () => events.push('moved'));
    bus.on('unit:moveAborted', () => events.push('aborted'));

    action.applyEffect(mover, w, 5);

    expect(mover.position).toEqual({ x: 4, y: 5 });
    expect(other.position).toEqual({ x: 5, y: 5 });
    expect(events).toEqual([]);
  });

  it('degrades to a silent plain step at the flip when the partner is gone and the cell is free', () => {
    // Post-rehydrate / partner-died-mid-window shape: nobody on `to` by flip
    // time → the actor just arrives (the start event already showed it
    // sliding there; a dead partner's sprite belongs to the death anim).
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const mover = spawn(w, 5, 5); // no unit with id 999 exists
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, 999, 10);
    action.start(mover, w);
    const events: string[] = [];
    bus.on('unit:moved', () => events.push('moved'));
    bus.on('unit:moveAborted', () => events.push('aborted'));

    action.applyEffect(mover, w, 5);

    expect(mover.position).toEqual({ x: 4, y: 5 });
    expect(events).toEqual([]);
  });

  it('aborts at the flip when the cell is occupied by a third party (§36c shape)', () => {
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const mover = spawn(w, 5, 5);
    const third = spawn(w, 4, 5); // NOT the named partner — a usurper
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, 999, 10);
    seatSwap(w, mover, action, 10);
    const aborts: GameEvents['unit:moveAborted'][] = [];
    bus.on('unit:moveAborted', (e) => aborts.push(e));

    action.applyEffect(mover, w, 5);

    expect(mover.position).toEqual({ x: 5, y: 5 }); // stayed home
    expect(third.position).toEqual({ x: 4, y: 5 }); // untouched
    expect(aborts).toEqual([{ unitId: mover.id, from: { x: 5, y: 5 }, to: { x: 4, y: 5 } }]);
    expect(mover.activeAction).toBeNull(); // lockout released for the retry
    expect(mover.actionCooldowns.get('swap')).toBe(0); // cooldown reset
  });

  it('aborts at the flip when the partner is present but mid-action (never relocate in-flight units)', () => {
    // The partner started something mid-window (only reachable post-rehydrate
    // — live play reserves partners for the whole window via the World.tick
    // skip). Its own body makes `to` non-free, so the abort branch catches it.
    const bus = new EventBus<GameEvents>();
    const w = makeWorld(bus);
    const mover = spawn(w, 5, 5);
    const other = spawn(w, 4, 5);
    seatMove(w, other, { x: 3, y: 5 }, 4);
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, other.id, 10);
    seatSwap(w, mover, action, 10);
    const aborts: GameEvents['unit:moveAborted'][] = [];
    bus.on('unit:moveAborted', (e) => aborts.push(e));

    action.applyEffect(mover, w, 5);

    expect(mover.position).toEqual({ x: 5, y: 5 });
    expect(other.position).toEqual({ x: 4, y: 5 }); // its own move still owns it
    expect(aborts).toHaveLength(1);
  });

  it('round-trips through the action registry', () => {
    const data = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, 2, 10).toData();
    const rebuilt = createAction('swap', data, makeWorld());
    expect(rebuilt).toBeInstanceOf(SwapAction);
    expect(rebuilt.toData()).toEqual(data);
  });
});

describe('the swap-partner reserve (56c2; full-window since 56e-pre)', () => {
  it('a named partner is reserved for the WHOLE window and freed when the action clears', () => {
    const w = makeWorld();
    const actor = spawn(w, 5, 5);
    const partner = spawn(w, 4, 5);
    const action = new SwapAction({ x: 5, y: 5 }, { x: 4, y: 5 }, partner.id, 10);
    seatSwap(w, actor, action, 10);

    // Pre-flip (offset 0 < travel 5): reserved.
    expect(isReservedSwapPartner(partner.id, w)).toBe(true);
    expect(isSwappablePartner(partner, w)).toBe(false);
    // The ACTOR is busy via its own activeAction, not the partner scan.
    expect(isReservedSwapPartner(actor.id, w)).toBe(false);
    expect(isSwappablePartner(actor, w)).toBe(false);

    // Post-flip, window still open (travel boundary in the past, finishTick
    // ahead): STILL reserved — the swap is the partner's action too, and the
    // renderer's dual lerp is mid-slide (the 56e mid-window re-grab).
    actor.activeAction = { ...actor.activeAction!, startTick: w.currentTick - 5 };
    expect(isReservedSwapPartner(partner.id, w)).toBe(true);
    expect(isSwappablePartner(partner, w)).toBe(false);

    // The window closes (the actor's action clears): the reserve drops.
    actor.activeAction = null;
    expect(isReservedSwapPartner(partner.id, w)).toBe(false);
    expect(isSwappablePartner(partner, w)).toBe(true);
  });
});
